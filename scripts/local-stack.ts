/**
 * Brings up the whole demo backend on this machine: a local validator with the (mock-oracle) program, the mock mints and
 * config, and the worker (keeper, market-maker bots, faucet, radar). Prints the environment the web app needs, then keeps
 * running until you press Ctrl-C.
 *
 *   yarn ts-node -P tsconfig.json scripts/local-stack.ts [--out /tmp/limitplus-local.json] [--worker-port 8787]
 *
 * Then build and start the app against it:
 *   NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8899 NEXT_PUBLIC_DEMO=1 WORKER_URL=http://127.0.0.1:8787 WORKER_SHARED_SECRET=... yarn workspace app build
 */
import { ChildProcess, spawn } from "child_process";
import { Connection, Keypair } from "@solana/web3.js";
import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { PROGRAM_ID } from "../packages/sdk/src";
import { airdrop } from "./lib";
import { setupChain } from "./setup-devnet";
import { arg, sleep } from "../bots/common";

const RPC = "http://127.0.0.1:8899";

async function startValidator(): Promise<ChildProcess> {
  const ledger = fs.mkdtempSync(path.join(os.tmpdir(), "limitplus-stack-"));
  const out = fs.openSync(path.join(os.tmpdir(), "limitplus-stack-validator.log"), "w");
  const p = spawn("solana-test-validator", ["--reset", "--ledger", ledger, "--bpf-program", PROGRAM_ID.toBase58(), path.join(__dirname, "../target/deploy/limit_plus.so")], { stdio: ["ignore", out, out] });
  const c = new Connection(RPC, "confirmed");
  for (let i = 0; i < 90; i++) {
    try { await c.getVersion(); if ((await c.getSlot("finalized")) > 2) return p; } catch { /* not up yet */ }
    await sleep(1000);
  }
  p.kill();
  throw new Error("validator did not start");
}

(async () => {
  const outFile = arg("out", "/tmp/limitplus-local.json");
  const workerPort = arg("worker-port", "8787");
  const validator = await startValidator();
  let worker: ChildProcess | undefined;
  const stop = () => { worker?.kill(); validator.kill(); };
  process.on("exit", stop);
  process.on("SIGINT", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));

  const c = new Connection(RPC, "confirmed");
  const admin = Keypair.generate();
  await airdrop(c, admin.publicKey, 500);
  const chain = await setupChain(c, admin, {}, console.log);
  const secret = crypto.randomBytes(16).toString("hex");

  const env = {
    ...process.env,
    PORT: workerPort, SOLANA_RPC_URL: RPC, CLUSTER: "localnet", ADMIN_KEYPAIR: JSON.stringify(Array.from(admin.secretKey)),
    QUOTE_MINT: chain.quoteMint.toBase58(), UNDERLYING_MINT: chain.underlyingMint.toBase58(), WORKER_SHARED_SECRET: secret,
    // No TinyFish key here: the radar serves the saved snapshot, so this stack never needs the network.
    TINYFISH_API_KEY: process.env.STACK_TINYFISH_API_KEY ?? "",
  };
  worker = spawn("yarn", ["-s", "ts-node", "-P", "tsconfig.json", "bots/worker.ts"], { cwd: path.join(__dirname, ".."), env, stdio: "inherit" });
  worker.on("exit", (code) => { console.log(`worker exited with ${code}`); process.exit(code ?? 1); });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`http://127.0.0.1:${workerPort}/health`)).ok) break; } catch { /* starting */ }
    await sleep(1000);
    if (i === 59) throw new Error("worker did not start");
  }
  fs.writeFileSync(outFile, JSON.stringify({
    rpc: RPC, workerUrl: `http://127.0.0.1:${workerPort}`, workerSecret: secret, quoteMint: chain.quoteMint.toBase58(),
    underlyingMint: chain.underlyingMint.toBase58(), programId: PROGRAM_ID.toBase58(), admin: admin.publicKey.toBase58(),
  }, null, 2));
  console.log(`\nSTACK_READY ${outFile}`);
  await new Promise(() => undefined); // run until killed
})().catch((e) => { console.error(e); process.exit(1); });
