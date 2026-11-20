/**
 * End-to-end test of the worker against a real local validator: HTTP API, faucet, two full demo weeks (the user buys, then
 * the user gets their money back), a service restart in the middle of the second week with the bots' local files deleted,
 * and the failure paths (bad input, rate limits, busy, missing secret).
 *
 *   yarn ts-node -P tsconfig.json scripts/worker-e2e.ts          (needs the mock-oracle .so: scripts/test.sh builds it)
 */
import { ChildProcess, spawn } from "child_process";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { LimitPlusClient, PROGRAM_ID, getProgram, phaseOf } from "../packages/sdk/src";
import { COMPANIES, RadarService, type RadarSnapshot } from "../packages/radar/src";
import snapshot from "../packages/radar/src/snapshot.json";
import { airdrop } from "./lib";
import { claimAll } from "../app/lib/actions";
import { setupChain } from "./setup-devnet";
import { Director } from "../bots/director";
import { createServer } from "../bots/server";
import { chainNow, send, sleep } from "../bots/common";

const RPC = "http://127.0.0.1:8899";
const SECRET = "test-secret";
const results: string[] = [];
const ok = (name: string) => { results.push(name); console.log(`ok   ${name}`); };

const ledgerRoot = process.env.LIMITPLUS_LEDGER_DIR ?? path.join(os.homedir(), ".cache", "limitplus");
let ledgerDir = "";

async function startValidator(): Promise<ChildProcess> {
  fs.mkdirSync(ledgerRoot, { recursive: true });
  const ledger = ledgerDir = fs.mkdtempSync(path.join(ledgerRoot, "e2e-"));
  const logFile = path.join(ledger, "validator.out");
  const out = fs.openSync(logFile, "w");
  console.log(`validator log: ${logFile}`);
  const p = spawn("solana-test-validator", ["--reset", "--limit-ledger-size", "10000", "--ledger", ledger, "--bpf-program", PROGRAM_ID.toBase58(), path.join(__dirname, "../target/deploy/limit_plus.so")], { stdio: ["ignore", out, out] });
  p.on("exit", (code) => console.log(`validator exited with code ${code}`));
  const c = new Connection(RPC, "confirmed");
  for (let i = 0; i < 90; i++) {
    try {
      await c.getVersion();
      // web3.js asks for a fresh *finalized* blockhash when it resends or caches out, and a new test validator reports
      // finalized slot 0 for its first ~13 seconds. Wait until finalization is moving, or setup fails with "Unable to obtain a new blockhash".
      if ((await c.getSlot("finalized")) > 2) return p;
    } catch { /* not up yet */ }
    await sleep(1000);
  }
  p.kill();
  throw new Error("validator did not start");
}

const FAST = { bidSecs: 30, candleSecs: 8, revealSecs: 14, expirySecs: 12, exerciseSecs: 25 };

(async () => {
  process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), "limitplus-cwd-")));
  const validator = await startValidator();
  let server: ReturnType<typeof createServer> | undefined;
  const cleanup = () => { try { server?.close(); } catch { /* ignore */ } validator.kill(); try { fs.rmSync(ledgerDir, { recursive: true, force: true }); } catch { /* best effort */ } };
  process.on("exit", cleanup);
  try {
    const c = new Connection(RPC, "confirmed");
    const client = new LimitPlusClient(getProgram(c));
    const admin = Keypair.generate();
    await airdrop(c, admin.publicKey, 200);
    const chain = await setupChain(c, admin, {}, () => {});
    const again = await setupChain(c, admin, { quote: chain.quoteMint.toBase58(), underlying: chain.underlyingMint.toBase58() }, () => {});
    assert.equal(again.createdConfig, false); assert.equal(again.quoteMint.toBase58(), chain.quoteMint.toBase58());
    ok("chain setup creates mints and config, and re-running reuses them");

    const mkDirector = () => new Director({ connection: c, admin, quoteMint: chain.quoteMint, underlyingMint: chain.underlyingMint, spot: async () => 180, timings: FAST, pollMs: 1000, log: () => {} });
    let director = mkDirector();
    const radar = new RadarService(async () => { throw new Error("no network in this test"); }, { tickers: Object.keys(COMPANIES) });
    radar.seed(snapshot as RadarSnapshot[]);
    let adminSol = 0;
    const mkServer = (d: Director) => createServer({ radar, director: d, cluster: "localnet", sharedSecret: SECRET, adminSol: async () => (adminSol = (await c.getBalance(admin.publicKey)) / 1e9) });
    server = mkServer(director);
    await new Promise<void>((r) => server!.listen(0, "127.0.0.1", r));
    const base = () => `http://127.0.0.1:${(server!.address() as any).port}`;
    // key: undefined sends the right secret, null sends none, a string sends that string.
    // The worker rate-limits per client address (x-forwarded-for behind a proxy), so each scenario acts as its own visitor.
    let clientIp = "10.0.0.1";
    const call = async (method: string, p: string, body?: unknown, key: string | null = SECRET) => {
      const res = await fetch(base() + p, { method, headers: { "content-type": "application/json", "x-forwarded-for": clientIp, ...(key !== null ? { "x-limitplus-key": key } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
      return { status: res.status, json: await res.json().catch(() => ({})), headers: res.headers };
    };

    // ---- read routes and input handling
    assert.equal((await call("GET", "/health")).status, 200);
    const st = await call("GET", "/status");
    assert.equal(st.status, 200); assert.equal(st.json.ok, true); assert.ok(st.json.adminSol > 100); assert.equal(st.json.radar.count, 9);
    assert.equal((await call("GET", "/radar/NVDAx")).json.ticker, "NVDA");
    assert.equal((await call("GET", "/radar/ZZZ")).status, 404);
    assert.equal((await call("GET", "/nope")).status, 404);
    assert.equal((await call("GET", "/faucet")).status, 405);
    assert.equal((await call("POST", "/health")).status, 405);
    ok("health, status, radar and unknown routes behave");

    assert.equal((await call("POST", "/faucet", { wallet: Keypair.generate().publicKey.toBase58() }, null)).status, 401);
    assert.equal((await call("POST", "/faucet", { wallet: Keypair.generate().publicKey.toBase58() }, "wrong")).status, 401);
    assert.equal((await call("POST", "/faucet", { wallet: "not-a-wallet" })).status, 400);
    assert.equal((await call("POST", "/faucet", {})).status, 400);
    assert.equal((await call("POST", "/demo/start", { outcome: "sideways" })).status, 400);
    assert.equal((await call("POST", "/demo/start", { outcome: "buy", depositSecs: 5 })).status, 400);
    const raw = await fetch(base() + "/faucet", { method: "POST", headers: { "x-limitplus-key": SECRET, "content-type": "application/json" }, body: "{nope" });
    assert.equal(raw.status, 400);
    const big = await fetch(base() + "/faucet", { method: "POST", headers: { "x-limitplus-key": SECRET, "content-type": "application/json" }, body: JSON.stringify({ wallet: "x".repeat(5000) }) }).catch(() => ({ status: 413 }));
    assert.ok([400, 413].includes(big.status));
    ok("secret, bad wallet, bad outcome, bad deposit time, bad JSON and oversized bodies are rejected");

    // ---- rate limiting: a burst from one address is slowed down, a different address is unaffected
    clientIp = "10.0.0.2";
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) codes.push((await call("POST", "/faucet", { wallet: "bad" })).status);
    assert.equal(codes.filter((x) => x === 400).length, 10, JSON.stringify(codes));
    assert.deepEqual(codes.slice(10), [429, 429]);
    const slowed = await call("POST", "/faucet", { wallet: "bad" });
    assert.equal(slowed.status, 429); assert.ok(Number(slowed.headers.get("retry-after")) > 0);
    clientIp = "10.0.0.3";
    assert.equal((await call("POST", "/faucet", { wallet: "bad" })).status, 400);
    for (let i = 0; i < 130; i++) if ((await call("GET", "/health")).status === 429) { assert.ok(i >= 119, `read limit hit too early at ${i}`); break; }
    ok("a burst of writes or reads from one address gets 429 with Retry-After, while other addresses are unaffected");

    // ---- the human
    clientIp = "10.0.0.4";
    let human = Keypair.generate();
    const f1 = await call("POST", "/faucet", { wallet: human.publicKey.toBase58() });
    assert.equal(f1.status, 200); assert.equal(f1.json.usdc, 1000);
    let usdcAta = getAssociatedTokenAddressSync(chain.quoteMint, human.publicKey, true, TOKEN_PROGRAM_ID);
    let nvdaAta = getAssociatedTokenAddressSync(chain.underlyingMint, human.publicKey, true, TOKEN_2022_PROGRAM_ID);
    const usdc = async () => Number((await c.getTokenAccountBalance(usdcAta)).value.amount) / 1e6;
    const nvda = async () => { try { return Number((await c.getTokenAccountBalance(nvdaAta)).value.amount) / 1e8; } catch { return 0; } };
    assert.equal(await usdc(), 1000); assert.ok((await c.getBalance(human.publicKey)) >= 0.02 * 1e9);
    assert.equal((await call("POST", "/faucet", { wallet: human.publicKey.toBase58() })).status, 429);
    ok("faucet funds a wallet with 1000 mock USDC and SOL, and refuses a second call");

    const playWeek = async (outcome: "buy" | "skip", restartMidway: boolean, freshVisitor = false) => {
      if (freshVisitor) {
        // A different person arrives: the first one spent their dollars on the stock.
        clientIp = "10.0.0.5";
        human = Keypair.generate();
        usdcAta = getAssociatedTokenAddressSync(chain.quoteMint, human.publicKey, true, TOKEN_PROGRAM_ID);
        nvdaAta = getAssociatedTokenAddressSync(chain.underlyingMint, human.publicKey, true, TOKEN_2022_PROGRAM_ID);
        assert.equal((await call("POST", "/faucet", { wallet: human.publicKey.toBase58() })).status, 200);
      }
      const before = { usdc: await usdc(), nvda: await nvda() };
      const s = await call("POST", "/demo/start", { outcome, depositSecs: 20 });
      assert.equal(s.status, 202, JSON.stringify(s.json));
      const roundKey = new PublicKey(s.json.roundKey);
      assert.equal((await call("POST", "/demo/start", { outcome })).status, 409);
      ok(`${outcome}: a second start while one runs is refused with 409`);

      // the human deposits during the deposit window, exactly as the app does
      let r = await client.fetchRound(roundKey);
      const strikePerContract = Number(r.strikePerContract.toString()) / 1e6;
      const contracts = Math.floor(1000 / strikePerContract);
      await send(c, [await client.deposit(human.publicKey, roundKey, r, contracts)], [human]);
      assert.ok(Math.abs((await usdc()) - (before.usdc - contracts * strikePerContract)) < 1e-6, "deposit moved exactly the collateral out of the wallet");
      ok(`${outcome}: deposited ${contracts} contracts, USDC left the wallet`);

      // wait for bidding, then (optionally) restart the service and wipe the bots' files
      if (restartMidway) {
        for (;;) { r = await client.fetchRound(roundKey); if (phaseOf(r, await chainNow(c)) === "bidding") break; await sleep(500); }
        await sleep(6000); // let the bots commit
        const bids = await client.fetchBidsForRound(roundKey);
        assert.ok(bids.length >= 1, "bots should have committed by now");
        director.shutdown();
        server!.close();
        fs.rmSync(path.join(process.cwd(), ".bids"), { recursive: true, force: true });
        director = mkDirector();
        server = mkServer(director);
        await new Promise<void>((res) => server!.listen(0, "127.0.0.1", res));
        assert.equal(await director.resume(), true);
        assert.equal((await call("GET", "/demo")).json.roundKey, roundKey.toBase58());
        ok(`${outcome}: service restarted mid-week with the bots' files deleted, and picked the round back up`);
      }

      // The app's own claim code, signing as the human, exactly as the portfolio page would.
      const humanSend = (tx: Transaction, conn: Connection) => conn.sendTransaction(tx, [human]);

      // wait for the week to finish, collecting "paid now" as soon as the auction has cleared
      const t0 = Date.now();
      let paidEarly = 0;
      for (;;) {
        const d = (await call("GET", "/demo")).json;
        if (d.status === "failed") throw new Error(`demo failed: ${d.error}`);
        if (!paidEarly) {
          const rr = await client.fetchRound(roundKey);
          if (["cleared", "settled"].includes(Object.keys(rr.state)[0])) {
            const b0 = await usdc();
            await claimAll(c, human.publicKey, humanSend, roundKey.toBase58());
            paidEarly = (await usdc()) - b0;
            assert.ok(paidEarly > 0, "claiming right after the auction pays the premium");
            ok(`${outcome}: paid now, claimed right after the auction: +$${paidEarly.toFixed(4)} USDC`);
          }
        }
        if (d.status === "finished") { assert.equal(d.outcome, outcome); break; }
        if (Date.now() - t0 > 240_000) throw new Error(`demo did not finish: ${JSON.stringify(d).slice(0, 400)}`);
        await sleep(2000);
      }
      assert.ok(paidEarly > 0, "the week finished without the cleared state ever being observed");
      r = await client.fetchRound(roundKey);
      assert.equal(phaseOf(r, await chainNow(c)), "finalized");
      assert.equal(r.inTheMoney, outcome === "buy");
      ok(`${outcome}: round finalized, in the money = ${outcome === "buy"}`);

      // final claim, again through the app's code
      await claimAll(c, human.publicKey, humanSend, roundKey.toBase58());
      const after = { usdc: await usdc(), nvda: await nvda() };
      const paid = Number(r.premiumToUsers.toString()) / 1e6;
      const share = contracts / Number(r.totalContracts.toString());
      assert.ok(paid > 0, "the market makers paid a premium");
      assert.ok(Math.abs(paidEarly - paid * share) < 0.001, `paid now matches the user's share of the premium: ${paidEarly} vs ${paid * share}`);
      if (outcome === "skip") {
        assert.equal(after.nvda, before.nvda, "skip: no stock changes hands");
        assert.ok(Math.abs(after.usdc - before.usdc - paid * share) < 0.001, `skip: money back plus the premium, ${before.usdc} -> ${after.usdc}`);
      } else {
        assert.ok(after.nvda > before.nvda, "buy: the user received the stock token");
        const exercisedShare = Number(r.exercisedContracts.toString()) / Math.max(Number(r.totalContracts.toString()), 1);
        assert.ok(Math.abs(after.nvda - before.nvda - contracts * 0.01 * exercisedShare) < 1e-6, `buy: stock received (${after.nvda - before.nvda}) matches the exercised share (${contracts * 0.01 * exercisedShare})`);
        assert.ok(after.usdc < before.usdc + paid * share, "buy: USDC went into the stock purchase");
      }
      ok(`${outcome}: claimed. USDC ${before.usdc.toFixed(2)} -> ${after.usdc.toFixed(2)}, NVDAx ${before.nvda.toFixed(4)} -> ${after.nvda.toFixed(4)}, premium ${paid.toFixed(4)} total, yours ${paidEarly.toFixed(4)}`);
      const claimedAgain = await claimAll(c, human.publicKey, humanSend, roundKey.toBase58()).then(() => true, () => false);
      assert.equal(claimedAgain, false);
      assert.deepEqual({ usdc: await usdc(), nvda: await nvda() }, after, "a refused second claim moves nothing");
      ok(`${outcome}: a second claim is refused and moves nothing`);
    };

    await playWeek("buy", false);
    await sleep(1100); // round ids are per second
    await playWeek("skip", true, true);

    assert.ok((await call("GET", "/status")).json.adminSol > 0);
    console.log(`\nWORKER_E2E_OK (${results.length} checks)`);
  } finally { cleanup(); }
})().then(() => process.exit(0)).catch((e) => { console.error("\nWORKER_E2E_FAILED", e); process.exit(1); });
