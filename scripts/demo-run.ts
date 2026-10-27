/**
 * End-to-end compressed round on a local validator with the mock oracle (test X4: under 10 minutes).
 * Needs the mock-oracle build:  anchor build -- --features mock-oracle
 * Usage: yarn ts-node scripts/demo-run.ts [--keep]   (--keep leaves the validator running)
 */
import { ChildProcess, spawn } from "child_process";
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { LimitPlusClient, PROGRAM_ID, getProgram, mockPricePda, phaseOf, positionPda } from "../packages/sdk/src";
import { chainNow, say, send, sleep } from "../bots/common";
import { runKeeper } from "../bots/keeper";
import { runMmBot } from "../bots/mm-bot";
import { airdrop, buildRound, createMint, fund, sendCreateRound } from "./lib";

const FEED = Uint8Array.from(Buffer.from("b1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593", "hex"));
const RPC = "http://127.0.0.1:8899";

async function startValidator(): Promise<ChildProcess> {
  const ledger = fs.mkdtempSync(path.join(os.tmpdir(), "limitplus-ledger-"));
  const so = path.join(__dirname, "../target/deploy/limit_plus.so");
  const p = spawn("solana-test-validator", ["--reset", "--quiet", "--limit-ledger-size", "5000", "--ledger", ledger, "--bpf-program", PROGRAM_ID.toBase58(), so], { stdio: "ignore" });
  const c = new Connection(RPC, "confirmed");
  for (let i = 0; i < 90; i++) {
    try { await c.getVersion(); return p; } catch { await sleep(1000); }
  }
  p.kill();
  throw new Error("validator did not start");
}

const usd = (x: bigint | number) => `$${(Number(x) / 1e6).toFixed(4)}`;

(async () => {
  const t0 = Date.now();
  const stamp = () => `[${Math.round((Date.now() - t0) / 1000)}s]`;
  const log = (m: string) => say(`${stamp()} ${m}`);
  const validator = await startValidator();
  const killValidator = () => { if (!process.argv.includes("--keep")) validator.kill(); };
  process.on("exit", killValidator);
  try {
    const c = new Connection(RPC, "confirmed");
    const client = new LimitPlusClient(getProgram(c));
    const admin = Keypair.generate();
    await airdrop(c, admin.publicKey, 100);
    const quote = await createMint(c, admin, 6, "classic");
    const underlying = await createMint(c, admin, 8, "token2022-scaled");
    const treasuryOwner = Keypair.generate();
    const treasury = await fund(c, admin, quote, TOKEN_PROGRAM_ID, treasuryOwner.publicKey, 0n);
    await send(c, [await client.initializeConfig(admin.publicKey, 1000, 100, quote, treasury)], [admin]);

    const keeperWallet = Keypair.generate();
    await airdrop(c, keeperWallet.publicKey, 5);

    const users = [Keypair.generate(), Keypair.generate(), Keypair.generate()];
    const sizes = [4, 3, 3];
    const bots = [{ name: "alpha", edge: 0.1, size: 6, kp: Keypair.generate() }, { name: "beta", edge: 0.2, size: 6, kp: Keypair.generate() }];
    for (const k of [...users, ...bots.map((b) => b.kp)]) await airdrop(c, k.publicKey, 5);

    // fund everyone
    for (let i = 0; i < users.length; i++) await fund(c, admin, quote, TOKEN_PROGRAM_ID, users[i].publicKey, 1_000_000_000n);
    for (const u of users) await fund(c, admin, underlying, TOKEN_2022_PROGRAM_ID, u.publicKey, 0n);
    for (const b of bots) {
      await fund(c, admin, quote, TOKEN_PROGRAM_ID, b.kp.publicKey, 1_000_000_000n);
      await fund(c, admin, underlying, TOKEN_2022_PROGRAM_ID, b.kp.publicKey, BigInt(b.size) * 1_000_000n * 2n);
    }


    const built = await buildRound({
      roundId: 1, side: "buyLower", spot: 180, pct: 0.05, vol: 0.5, yearsOverride: 5 / 365, feedId: FEED, now: await chainNow(c),
      timings: { depositSecs: 25, bidSecs: 40, candleSecs: 10, revealSecs: 20, expirySecs: 15, exerciseSecs: 30 },
    });
    const { _meta, ...args } = built;
    const round = await sendCreateRound(c, client, admin, underlying, quote, args);
    log(`Round created. You name your price: NVDAx at $${(_meta.strikeUsd / 0.01).toFixed(2)} (spot $180). Fair pay-now per contract: $${_meta.fairUsd.toFixed(4)}.`);


    const r0 = await client.fetchRound(round);
    for (let i = 0; i < users.length; i++) {
      await send(c, [await client.deposit(users[i].publicKey, round, r0, sizes[i])], [users[i]]);
      log(`User ${i + 1} deposited ${sizes[i]} contracts.`);
    }

    const signal = { stop: false };
    const botLog = (m: string) => say(`${stamp()} ${m}`);
    const botRuns = bots.map((b) => runMmBot({ connection: c, wallet: b.kp, name: `${b.name}-${round.toBase58().slice(0, 4)}`, edge: b.edge, size: b.size, round, pollMs: 3000, signal, log: botLog }));
    const keepers = [0, 1].map(() => runKeeper({ connection: c, payer: keeperWallet, round, oracle: "mock", pollMs: 3000, signal, log: botLog }));

    // Admin posts the Friday close once the auction has cleared (mock oracle).
    const priceTask = (async () => {
      for (;;) {
        const r = await client.fetchRound(round);
        const ph = phaseOf(r, await chainNow(c));
        if (["cleared", "awaitingSettle"].includes(ph)) break;
        await sleep(3000);
      }
      const r = await client.fetchRound(round);
      await send(c, [await client.setMockPrice(admin.publicKey, FEED, 16_500_000, -5, 1000, Number(r.expiryTs.toString()))], [admin]);
      log("Friday close price: $165.00 (below your price, so you buy).");
    })();

    // users claim premium as soon as it is available
    const premiumTask = (async () => {
      for (;;) {
        const r = await client.fetchRound(round);
        if (["cleared", "settled", "finalized"].includes(Object.keys(r.state)[0])) {
          for (const u of users) await send(c, [await client.claimPremium(u.publicKey, round, r)], [u]);
          log(`Users were paid ${usd(r.premiumToUsers.toString())} up front (split pro-rata).`);
          return;
        }
        await sleep(3000);
      }
    })();

    const keeperStats = await Promise.all(keepers);
    signal.stop = true;
    await Promise.all([priceTask, premiumTask, ...botRuns]);

    // final claims
    const rf = await client.fetchRound(round);
    for (let i = 0; i < users.length; i++) {
      await send(c, [await client.claim(users[i].publicKey, round, rf)], [users[i]]);
    }
    const rows = [];
    for (let i = 0; i < users.length; i++) {
      const q = await c.getTokenAccountBalance(getAssociatedTokenAddressSync(quote, users[i].publicKey, true, TOKEN_PROGRAM_ID));
      const u = await c.getTokenAccountBalance(getAssociatedTokenAddressSync(underlying, users[i].publicKey, true, TOKEN_2022_PROGRAM_ID));
      rows.push({ user: i + 1, contracts: sizes[i], usdc: q.value.uiAmountString, nvdax: u.value.uiAmountString });
    }
    console.table(rows);
    const secs = Math.round((Date.now() - t0) / 1000);
    log(`Done in ${secs}s. Keepers: ${JSON.stringify(keeperStats.map((s) => ({ did: s.done.length, alreadyDone: s.noops.length })))}`);
    if (secs > 600) throw new Error(`X4 failed: took ${secs}s`);
    const final = phaseOf(await client.fetchRound(round), await chainNow(c));
    if (final !== "finalized") throw new Error(`round ended in ${final}`);
    console.log("DEMO_RUN_OK");
  } finally {
    killValidator();
  }
})().catch((e) => { console.error(e); process.exit(1); });
