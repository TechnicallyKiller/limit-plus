/**
 * Local live demo: starts a validator with the mock-oracle build, creates mock USDC + NVDAx, one round with a long deposit
 * window (so you can deposit from the UI), funds YOUR wallet, and runs two market-maker bots + a keeper.
 * Usage: yarn ts-node -P tsconfig.json scripts/seed-localnet.ts --user <PHANTOM_PUBKEY> [--otm]
 * Then open the app built with NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8899 and set Phantom to Localnet.
 */
import { ChildProcess, spawn } from "child_process";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { LimitPlusClient, PROGRAM_ID, getProgram, phaseOf } from "../packages/sdk/src";
import { arg, chainNow, say, send, sleep } from "../bots/common";
import { runKeeper } from "../bots/keeper";
import { runMmBot } from "../bots/mm-bot";
import { airdrop, buildRound, createMint, fund, sendCreateRound } from "./lib";

const FEED = Uint8Array.from(Buffer.from("b1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593", "hex"));
const RPC = "http://127.0.0.1:8899";

async function startValidator(): Promise<ChildProcess> {
  const ledger = fs.mkdtempSync(path.join(os.tmpdir(), "limitplus-seed-"));
  const so = path.join(__dirname, "../target/deploy/limit_plus.so");
  const p = spawn("solana-test-validator", ["--reset", "--quiet", "--limit-ledger-size", "5000", "--ledger", ledger, "--bpf-program", PROGRAM_ID.toBase58(), so], { stdio: "ignore" });
  const c = new Connection(RPC, "confirmed");
  for (let i = 0; i < 90; i++) { try { await c.getVersion(); return p; } catch { await sleep(1000); } }
  p.kill(); throw new Error("validator did not start");
}

(async () => {
  const user = new PublicKey(arg("user"));
  const itm = !process.argv.includes("--otm");
  const t0 = Date.now();
  const stamp = () => `[${Math.round((Date.now() - t0) / 1000)}s]`;
  const log = (m: string) => say(`${stamp()} ${m}`);
  const validator = await startValidator();
  process.on("exit", () => validator.kill());
  process.on("SIGINT", () => { validator.kill(); process.exit(0); });

  const c = new Connection(RPC, "confirmed");
  const client = new LimitPlusClient(getProgram(c));
  const admin = Keypair.generate();
  await airdrop(c, admin.publicKey, 100);
  await airdrop(c, user, 10);
  const quote = await createMint(c, admin, 6, "classic");
  const underlying = await createMint(c, admin, 8, "token2022-scaled");
  const treasury = await fund(c, admin, quote, TOKEN_PROGRAM_ID, Keypair.generate().publicKey, 0n);
  await send(c, [await client.initializeConfig(admin.publicKey, 1000, 100, quote, treasury)], [admin]);

  // your wallet: 10,000 mock USDC and the stock token account so claims work
  await fund(c, admin, quote, TOKEN_PROGRAM_ID, user, 10_000_000_000n);
  await fund(c, admin, underlying, TOKEN_2022_PROGRAM_ID, user, 0n);

  const keeperWallet = Keypair.generate(); await airdrop(c, keeperWallet.publicKey, 5);
  const bots = [{ name: "alpha", edge: 0.1, size: 400, kp: Keypair.generate() }, { name: "beta", edge: 0.2, size: 400, kp: Keypair.generate() }];
  for (const b of bots) {
    await airdrop(c, b.kp.publicKey, 5);
    await fund(c, admin, quote, TOKEN_PROGRAM_ID, b.kp.publicKey, 1_000_000_000n);
    await fund(c, admin, underlying, TOKEN_2022_PROGRAM_ID, b.kp.publicKey, BigInt(b.size) * 1_000_000n * 2n);
  }
  const demoUsers = [Keypair.generate(), Keypair.generate()];
  for (const u of demoUsers) { await airdrop(c, u.publicKey, 5); await fund(c, admin, quote, TOKEN_PROGRAM_ID, u.publicKey, 1_000_000_000n); await fund(c, admin, underlying, TOKEN_2022_PROGRAM_ID, u.publicKey, 0n); }

  const built = await buildRound({
    roundId: 1, side: "buyLower", spot: 180, pct: 0.05, vol: 0.5, yearsOverride: 5 / 365, feedId: FEED, now: await chainNow(c),
    timings: { depositSecs: 240, bidSecs: 70, candleSecs: 20, revealSecs: 30, expirySecs: 30, exerciseSecs: 60 },
  });
  const { _meta, ...args } = built;
  const round = await sendCreateRound(c, client, admin, underlying, quote, args);
  const r0 = await client.fetchRound(round);
  for (const u of demoUsers) await send(c, [await client.deposit(u.publicKey, round, r0, 150)], [u]);

  fs.writeFileSync(".local-demo.json", JSON.stringify({ round: round.toBase58(), quote: quote.toBase58(), underlying: underlying.toBase58(), user: user.toBase58() }, null, 2));
  console.log("\n==============================================================");
  console.log(`ROUND PAGE:  http://localhost:3000/round/${round.toBase58()}`);
  console.log(`Your wallet ${user.toBase58()} has 10,000 mock USDC and 10 SOL on this local chain.`);
  console.log(`Deposit window closes in ~4 minutes: deposit from the UI before then.`);
  console.log("==============================================================\n");

  const signal = { stop: false };
  const botRuns = bots.map((b) => runMmBot({ connection: c, wallet: b.kp, name: b.name, edge: b.edge, size: b.size, round, pollMs: 3000, signal, log }));
  const keeper = runKeeper({ connection: c, payer: keeperWallet, round, oracle: "mock", pollMs: 3000, signal, log });
  const price = (async () => {
    for (;;) { const r = await client.fetchRound(round); if (["cleared", "awaitingSettle"].includes(phaseOf(r, await chainNow(c)))) break; await sleep(3000); }
    const r = await client.fetchRound(round);
    await send(c, [await client.setMockPrice(admin.publicKey, FEED, itm ? 16_500_000 : 19_500_000, -5, 1000, Number(r.expiryTs.toString()))], [admin]);
    log(itm ? "Friday close price: $165.00 (below your price, so you buy)." : "Friday close price: $195.00 (above your price, so you get your money back).");
  })();
  await keeper; signal.stop = true; await Promise.all([price, ...botRuns]);
  log("Round is final. Claim from the Portfolio page. Leave this running; Ctrl-C stops the chain.");
  await new Promise(() => {});
})().catch((e) => { console.error(e); process.exit(1); });
