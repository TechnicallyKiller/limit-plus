import { Connection } from "@solana/web3.js";
import { rpcFetch } from "@limit-plus/sdk";

export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "";
export const CLUSTER = process.env.NEXT_PUBLIC_CLUSTER ?? "devnet";
export const hasChain = RPC_URL.length > 0;
/** How often pages re-read the chain. Public networks rate limit, and every visitor polls from their own browser. */
export const POLL_MS = CLUSTER === "localnet" ? 2000 : 5000;
const local = /^https?:\/\/(127\.0\.0\.1|localhost)/.test(RPC_URL || "http://127.0.0.1:8899");
/** Paced, retries 429 and 5xx, and no websocket: the same connection settings the worker uses. */
export const CONNECTION_CONFIG = { commitment: "confirmed" as const, fetch: rpcFetch({ minGapMs: local ? 0 : 150 }), disableRetryOnRateLimit: true };
let conn: Connection | null = null;
export function connection(): Connection {
  if (!conn) conn = new Connection(RPC_URL || "http://127.0.0.1:8899", CONNECTION_CONFIG);
  return conn;
}
