/**
 * Live stock price with fallbacks. Pyth's public Hermes endpoint now answers 401 to anonymous callers, so it is tried first
 * (it works with a key or if access returns) and Yahoo Finance's chart endpoint is the fallback. Every answer is sanity
 * checked. Throws when no source gives a plausible price, so callers decide what to show instead of getting a made-up number.
 */
export interface Spot { price: number; source: "pyth" | "yahoo"; asOfMs?: number }
export interface SpotQuery { /** Pyth price feed id, 64 hex characters, no 0x. */ feedHex?: string; /** Ticker for the fallback, e.g. NVDA. */ symbol?: string }

const plausible = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x) && x >= 0.5 && x <= 100_000;

async function pyth(feedHex: string, f: typeof fetch, apiKey?: string): Promise<Spot> {
  const res = await f(`https://hermes.pyth.network/v2/updates/price/latest?ids[]=0x${feedHex}&parsed=true`, {
    signal: AbortSignal.timeout(3500), headers: apiKey ? { "x-api-key": apiKey } : undefined,
  });
  if (!res.ok) throw new Error(`pyth ${res.status}`);
  const p = (await res.json())?.parsed?.[0]?.price;
  const price = Number(p?.price) * 10 ** Number(p?.expo);
  if (!plausible(price)) throw new Error("pyth: no plausible price");
  return { price, source: "pyth", asOfMs: p.publish_time ? Number(p.publish_time) * 1000 : undefined };
}

async function yahoo(symbol: string, f: typeof fetch): Promise<Spot> {
  if (!/^[A-Za-z.\-]{1,8}$/.test(symbol)) throw new Error("bad symbol");
  const res = await f(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`, { signal: AbortSignal.timeout(4000), headers: { "user-agent": "Mozilla/5.0 (compatible; limit-plus)" } });
  if (!res.ok) throw new Error(`yahoo ${res.status}`);
  const m = (await res.json())?.chart?.result?.[0]?.meta;
  const price = m?.regularMarketPrice;
  if (!plausible(price)) throw new Error("yahoo: no plausible price");
  return { price, source: "yahoo", asOfMs: m.regularMarketTime ? Number(m.regularMarketTime) * 1000 : undefined };
}

export async function fetchSpot(q: SpotQuery, f: typeof fetch = fetch, env: Record<string, string | undefined> = process.env): Promise<Spot> {
  const errors: string[] = [];
  if (q.feedHex) { try { return await pyth(q.feedHex, f, env.PYTH_API_KEY); } catch (e: any) { errors.push(String(e?.message ?? e)); } }
  if (q.symbol) { try { return await yahoo(q.symbol, f); } catch (e: any) { errors.push(String(e?.message ?? e)); } }
  throw new Error(`no price source answered: ${errors.join("; ") || "nothing to try"}`);
}
