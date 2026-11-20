/**
 * The long-running service (Render): Risk Radar refresher, demo director and keeper/bot runner behind one small HTTP API.
 *
 * Environment:
 *   PORT                  listen port (Render sets it)
 *   SOLANA_RPC_URL        RPC endpoint
 *   CLUSTER               label only, default devnet
 *   ADMIN_KEYPAIR         JSON array of the demo admin secret key (mint authority, round admin, keeper payer). Devnet only.
 *   QUOTE_MINT, UNDERLYING_MINT   from config/addresses.<cluster>.json when unset
 *   TINYFISH_API_KEY      enables live radar refreshes; without it the saved snapshot is served
 *   WORKER_SHARED_SECRET  required in x-limitplus-key for POST routes
 *   DEMO_ENABLED          "0" turns the demo and faucet off
 */
import { Keypair, PublicKey } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import { COMPANIES, RadarService, tinyfishSearch, type RadarSnapshot } from "../packages/radar/src";
import snapshot from "../packages/radar/src/snapshot.json";
import { makeConnection } from "./common";
import { Director } from "./director";
import { createServer } from "./server";

const log = (m: string) => console.log(`${new Date().toISOString()} ${m}`);

// web3.js can throw a rate limit error from a background callback, which Node treats as fatal. A service that has other work
// in flight (a demo week, the radar) should log it and carry on rather than die; the loops retry on their own.
process.on("uncaughtException", (e) => log(`uncaught exception, carrying on: ${String((e as any)?.message ?? e).slice(0, 200)}`));
process.on("unhandledRejection", (e) => log(`unhandled rejection, carrying on: ${String((e as any)?.message ?? e).slice(0, 200)}`));

(async () => {
  const cluster = process.env.CLUSTER ?? "devnet";
  const radar = new RadarService(process.env.TINYFISH_API_KEY ? tinyfishSearch(undefined, { log }) : async () => { throw new Error("TINYFISH_API_KEY is not set"); }, { tickers: Object.keys(COMPANIES), log });
  radar.seed(snapshot as RadarSnapshot[]);

  let director: Director | undefined;
  let adminSol: (() => Promise<number>) | undefined;
  if (process.env.DEMO_ENABLED !== "0" && process.env.ADMIN_KEYPAIR && process.env.SOLANA_RPC_URL) {
    const cfg = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, `../config/addresses.${cluster}.json`), "utf8")); } catch { return {}; } })();
    const quote = process.env.QUOTE_MINT ?? cfg.quote_mint?.address, underlying = process.env.UNDERLYING_MINT ?? cfg.underlying_mint?.address;
    if (!quote || !underlying) throw new Error("QUOTE_MINT and UNDERLYING_MINT are not set and not in the config file. Run scripts/setup-devnet.ts first.");
    const connection = makeConnection(process.env.SOLANA_RPC_URL, log);
    const admin = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.ADMIN_KEYPAIR)));
    // Public networks rate limit hard, so the bots look at the chain every 4 seconds there instead of every 1.5.
    const pollMs = Number(process.env.POLL_MS ?? (cluster === "localnet" ? 1500 : 4000));
    director = new Director({ connection, admin, quoteMint: new PublicKey(quote), underlyingMint: new PublicKey(underlying), pollMs, log });
    adminSol = async () => (await connection.getBalance(admin.publicKey)) / 1e9;
    log(`Demo enabled on ${cluster}. Admin ${admin.publicKey.toBase58()}`);
    if (await director.resume()) log("Resumed an unfinished demo week.");
  } else log("Demo and faucet are off (set ADMIN_KEYPAIR and SOLANA_RPC_URL to turn them on).");

  const server = createServer({ radar, director, cluster, sharedSecret: process.env.WORKER_SHARED_SECRET, adminSol, log });
  const port = Number(process.env.PORT ?? 8787);
  server.listen(port, () => log(`Worker listening on :${port}`));
  if (process.env.TINYFISH_API_KEY) radar.start(30 * 60_000); else log("TINYFISH_API_KEY not set: serving the saved radar snapshot only.");

  // A free Render web service sleeps after 15 minutes without inbound traffic, and a sleeping worker cannot crank rounds.
  // Calling our own public URL counts as traffic. RENDER_EXTERNAL_URL is set by Render and absent everywhere else.
  if (process.env.RENDER_EXTERNAL_URL) {
    const self = `${process.env.RENDER_EXTERNAL_URL.replace(/\/$/, "")}/health`;
    setInterval(() => { fetch(self, { signal: AbortSignal.timeout(10_000) }).catch((e) => log(`keep-alive ping failed: ${String(e?.message ?? e).slice(0, 80)}`)); }, 10 * 60_000).unref();
  }

  const bye = () => { log("Shutting down."); radar.stop(); director?.shutdown(); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); };
  process.on("SIGTERM", bye); process.on("SIGINT", bye);
})().catch((e) => { console.error(e); process.exit(1); });
