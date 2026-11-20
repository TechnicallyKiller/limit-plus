import { NextResponse } from "next/server";
import { callWorker, readBody } from "@/lib/worker";

export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const body = await readBody(req);
  const wallet = typeof body?.wallet === "string" ? body.wallet : "";
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) return NextResponse.json({ error: "That is not a valid wallet address." }, { status: 400 });
  return callWorker(req, "/faucet", { method: "POST", body: { wallet } });
}
