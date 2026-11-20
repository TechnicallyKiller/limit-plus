import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { confirmByPolling, rpcFetch } from "../packages/sdk/src";
import * as fs from "fs";
import * as os from "os";

export function arg(name: string, def?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : def;
  if (v === undefined) throw new Error(`missing --${name}`);
  return v;
}

export function loadKeypair(p: string): Keypair {
  const file = p.replace(/^~/, os.homedir());
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(file, "utf8"))));
}

/** Loads keys/<name>.json or creates it (keys/ is gitignored). */
export function loadOrCreateKeypair(name: string): Keypair {
  fs.mkdirSync("keys", { recursive: true });
  const file = `keys/${name}.json`;
  if (fs.existsSync(file)) return loadKeypair(file);
  const kp = Keypair.generate();
  fs.writeFileSync(file, JSON.stringify(Array.from(kp.secretKey)), { mode: 0o600 });
  return kp;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Judge-facing log lines start with "»" and avoid jargon. */
export const say = (msg: string) => console.log(`» ${msg}`);
export const debug = (msg: string) => console.log(`  ${msg}`);

/**
 * A Connection that survives a busy public RPC: paced, retries 429 and 5xx, and never opens a websocket. web3.js throws a
 * 429 from a background callback as an uncaught exception, which would kill the process. Local validators are not paced.
 */
export function makeConnection(url: string, log?: (m: string) => void): Connection {
  const local = /^https?:\/\/(127\.0\.0\.1|localhost)/.test(url);
  let lastLog = 0;
  const onRetry = (m: string) => { if (log && Date.now() - lastLog > 10_000) { lastLog = Date.now(); log(`${m} (RPC is busy, backing off)`); } };
  return new Connection(url, { commitment: "confirmed", fetch: rpcFetch({ minGapMs: local ? 0 : 120, onRetry }), disableRetryOnRateLimit: true });
}

const clockCache = new WeakMap<Connection, { offset: number; at: number }>();

/**
 * Cluster time (what the program sees), falling back to wall-clock. Two RPC calls per read is a lot on a rate limited
 * endpoint, so the offset between chain time and our clock is cached for 20 seconds; the difference is far below a second.
 */
export async function chainNow(c: Connection): Promise<number> {
  const nowMs = Date.now();
  const hit = clockCache.get(c);
  if (hit && nowMs - hit.at < 20_000) return Math.floor(nowMs / 1000) + hit.offset;
  try {
    const slot = await c.getSlot("confirmed");
    const t = await c.getBlockTime(slot);
    if (t) { clockCache.set(c, { offset: t - Math.floor(nowMs / 1000), at: nowMs }); return t; }
  } catch { /* fall through */ }
  return hit ? Math.floor(Date.now() / 1000) + hit.offset : Math.floor(Date.now() / 1000);
}

/** Signs, sends and waits by polling over HTTP. The first signer pays. Preflight runs, so program errors carry their logs. */
export async function send(c: Connection, ixs: TransactionInstruction[], signers: Keypair[]): Promise<string> {
  const tx = new Transaction().add(...ixs);
  tx.feePayer = signers[0].publicKey;
  tx.recentBlockhash = (await c.getLatestBlockhash("confirmed")).blockhash;
  tx.sign(...signers);
  const sig = await c.sendRawTransaction(tx.serialize(), { skipPreflight: false, preflightCommitment: "confirmed" });
  await confirmByPolling(c, sig);
  return sig;
}

/** Retries with exponential backoff. `isDone` lets callers treat "someone else already did it" as success. */
export async function retry<T>(fn: () => Promise<T>, tries = 4, baseMs = 500): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) { last = e; await sleep(baseMs * 2 ** i); }
  }
  throw last;
}

export const errText = (e: any): string => `${e?.message ?? e} ${(e?.logs ?? []).join(" ")}`;
export const explorer = (sig: string, cluster = "devnet") =>
  `https://explorer.solana.com/tx/${sig}${cluster === "mainnet-beta" ? "" : `?cluster=${cluster}`}`;
export type Pk = PublicKey;
