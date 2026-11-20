import { NextResponse } from "next/server";
import { callWorker, readBody } from "@/lib/worker";

export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const body = await readBody(req);
  if (!body || (body.outcome !== "buy" && body.outcome !== "skip")) return NextResponse.json({ error: "Pick whether the stock falls or rises." }, { status: 400 });
  const depositSecs = body.depositSecs === undefined ? undefined : Number(body.depositSecs);
  if (depositSecs !== undefined && (!Number.isFinite(depositSecs) || depositSecs < 20 || depositSecs > 300)) return NextResponse.json({ error: "The deposit window must be between 20 and 300 seconds." }, { status: 400 });
  return callWorker(req, "/demo/start", { method: "POST", body: { outcome: body.outcome, depositSecs } });
}
