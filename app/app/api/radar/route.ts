import { NextResponse } from "next/server";
import snapshots from "@limit-plus/radar/src/snapshot.json";
import { normalizeTicker } from "@limit-plus/radar/src/tickers";
import type { RadarSnapshot } from "@limit-plus/radar/src/types";

/**
 * The Risk Radar for one stock. Never calls TinyFish itself: a TinyFish run can outlast a serverless request, and the
 * key must not live in the web tier. The live numbers come from the worker (RADAR_UPSTREAM_URL), which refreshes them
 * in the background. If the worker is unreachable or slow, the saved snapshot is served and labelled "snapshot".
 */
export const dynamic = "force-dynamic";

const LEVELS = new Set(["calm", "watch", "high", "unknown"]);
const isSnapshot = (x: any): x is RadarSnapshot =>
  x && typeof x.ticker === "string" && LEVELS.has(x.level) && typeof x.headline === "string" && Array.isArray(x.events) && typeof x.asOf === "string" && !Number.isNaN(Date.parse(x.asOf));

async function live(ticker: string): Promise<RadarSnapshot | null> {
  const base = process.env.RADAR_UPSTREAM_URL;
  if (!base) return null;
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/radar/${ticker}`, { signal: AbortSignal.timeout(4000), headers: { accept: "application/json" }, cache: "no-store" });
    if (!res.ok) return null;
    const j = await res.json();
    return isSnapshot(j) ? j : null;
  } catch { return null; }
}

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("ticker") ?? "";
  const ticker = normalizeTicker(raw);
  if (!ticker) return NextResponse.json({ error: "unknown ticker" }, { status: 404 });
  const snap = (await live(ticker)) ?? (snapshots as RadarSnapshot[]).find((s) => s.ticker === ticker);
  if (!snap) return NextResponse.json({ error: "no radar data yet" }, { status: 503, headers: { "Retry-After": "60" } });
  return NextResponse.json(snap, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } });
}
