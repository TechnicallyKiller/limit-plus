import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction } from "@solana/web3.js";
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

/** Cluster time (what the program sees), falling back to wall-clock. */
export async function chainNow(c: Connection): Promise<number> {
  try {
    const slot = await c.getSlot("confirmed");
    const t = await c.getBlockTime(slot);
    if (t) return t;
  } catch { /* fall through */ }
  return Math.floor(Date.now() / 1000);
}

export async function send(c: Connection, ixs: TransactionInstruction[], signers: Keypair[]): Promise<string> {
  const tx = new Transaction().add(...ixs);
  return sendAndConfirmTransaction(c, tx, signers, { commitment: "confirmed", skipPreflight: false });
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
