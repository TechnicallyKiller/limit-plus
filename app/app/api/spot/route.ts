import { NextResponse } from "next/server";
import { fetchSpot } from "@limit-plus/pricing/src/spot";

/**
 * Live stock price, fetched on the server. The browser used to call Pyth's Hermes API directly every two seconds; that is
 * rate limited, and Hermes now answers 401 to anonymous callers without CORS headers, which filled the console with errors.
 * Here one upstream call is shared by every visitor through the CDN cache, the fallback chain lives in one tested place
 * (packages/pricing/src/spot.ts), and the browser only talks to our own origin.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const feed = q.get("feed") ?? "";
  const symbol = q.get("symbol") ?? "";
  if (feed && !/^[0-9a-fA-F]{64}$/.test(feed)) return NextResponse.json({ error: "bad feed id" }, { status: 400 });
  if (symbol && !/^[A-Za-z]{1,6}$/.test(symbol)) return NextResponse.json({ error: "bad symbol" }, { status: 400 });
  if (!feed && !symbol) return NextResponse.json({ error: "give a feed or a symbol" }, { status: 400 });
  try {
    const s = await fetchSpot({ feedHex: feed || undefined, symbol: symbol || undefined });
    return NextResponse.json(s, { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=60" } });
  } catch {
    return NextResponse.json({ error: "price unavailable" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
