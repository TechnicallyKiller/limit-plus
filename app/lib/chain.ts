import { Connection } from "@solana/web3.js";

export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "";
export const CLUSTER = process.env.NEXT_PUBLIC_CLUSTER ?? "devnet";
export const hasChain = RPC_URL.length > 0;
let conn: Connection | null = null;
export function connection(): Connection {
  if (!conn) conn = new Connection(RPC_URL || "http://127.0.0.1:8899", "confirmed");
  return conn;
}
