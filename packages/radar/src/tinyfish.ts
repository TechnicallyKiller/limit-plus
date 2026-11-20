import { buildSnapshot } from "./classify";
import { COMPANIES } from "./tickers";
import type { RadarSnapshot, SearchHit } from "./types";

export interface SearchParams { query: string; after_date?: string }
export type RadarSearch = (p: SearchParams) => Promise<SearchHit[]>;

const SEARCH_URL = "https://api.search.tinyfish.ai";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const MAX_WAIT_MS = 75_000;

export interface SearchDeps { fetchImpl?: typeof fetch; sleepImpl?: (ms: number) => Promise<void>; nowImpl?: () => number; log?: (m: string) => void }

/**
 * TinyFish Search over plain HTTP (GET with an X-API-Key header). The key comes from TINYFISH_API_KEY and stays server
 * side. TinyFish allows about 30 requests per window and says so in X-RateLimit-* headers, so calls are queued one at a
 * time and the limiter waits for the window to reset instead of bursting into a 429. A 429 waits for Retry-After and
 * tries again; a 5xx or network error retries once; any other failure throws so the caller records it instead of
 * treating an empty answer as an all-clear.
 */
export function tinyfishSearch(apiKey = process.env.TINYFISH_API_KEY, deps: SearchDeps = {}): RadarSearch {
  if (!apiKey) throw new Error("TINYFISH_API_KEY is not set");
  const fetchImpl = deps.fetchImpl ?? fetch;
  const wait = deps.sleepImpl ?? sleep;
  const now = deps.nowImpl ?? Date.now;
  let remaining = Infinity;
  let resetAtMs = 0;
  let queue: Promise<unknown> = Promise.resolve();

  const waitForWindow = async () => {
    if (remaining <= 1 && resetAtMs > now()) {
      const ms = Math.min(resetAtMs - now() + 500, MAX_WAIT_MS);
      deps.log?.(`TinyFish rate limit reached, waiting ${Math.ceil(ms / 1000)}s for the window to reset`);
      await wait(ms);
      remaining = Infinity;
    }
  };
  const learn = (res: Response) => {
    const rem = res.headers?.get?.("x-ratelimit-remaining");
    const reset = res.headers?.get?.("x-ratelimit-reset");
    if (rem != null && !Number.isNaN(+rem)) remaining = +rem;
    if (reset != null && !Number.isNaN(+reset)) resetAtMs = +reset * 1000;
  };

  const one = async (p: SearchParams): Promise<SearchHit[]> => {
    const qs = new URLSearchParams({ query: p.query });
    if (p.after_date) qs.set("after_date", p.after_date);
    const url = `${SEARCH_URL}?${qs}`;
    let lastErr: unknown;
    let throttled = 0;
    for (let attempt = 0; attempt < 4; attempt++) {
      await waitForWindow();
      try {
        const res = await fetchImpl(url, { headers: { "X-API-Key": apiKey }, signal: AbortSignal.timeout(20_000) });
        learn(res);
        if (res.status === 429) {
          if (++throttled > 2) throw new Error("TinyFish search 429");
          const ra = Number(res.headers?.get?.("retry-after"));
          const ms = Math.min(Number.isFinite(ra) && ra > 0 ? ra * 1000 : Math.max(resetAtMs - now(), 2000) + 500, MAX_WAIT_MS);
          deps.log?.(`TinyFish 429, retrying in ${Math.ceil(ms / 1000)}s`);
          await wait(ms);
          remaining = Infinity;
          continue;
        }
        if (res.status >= 500) { lastErr = new Error(`TinyFish search ${res.status}`); if (attempt >= 1) break; continue; }
        if (!res.ok) throw new Error(`TinyFish search ${res.status}`);
        const j = (await res.json()) as { results?: any[] };
        if (!Array.isArray(j.results)) throw new Error("TinyFish search returned no results field");
        return j.results.map((r) => ({ title: String(r.title ?? ""), snippet: String(r.snippet ?? ""), url: String(r.url ?? ""), site_name: r.site_name, date: r.date }));
      } catch (e) {
        lastErr = e;
        if (e instanceof Error && /TinyFish search (4\d\d)|no results field/.test(e.message)) throw e;
        if (attempt >= 1) break;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("TinyFish search failed");
  };

  // One request at a time keeps the shared limit honest even when three searches are started together.
  return (p) => {
    const run = queue.then(() => one(p));
    queue = run.catch(() => undefined);
    return run;
  };
}

export interface RunOptions { nowMs?: number; windowEndMs?: number; log?: (m: string) => void }

/** One radar pass for one stock: three TinyFish searches in parallel, then the pure verdict logic. Never throws. */
export async function runRadar(search: RadarSearch, ticker: string, opts: RunOptions = {}): Promise<RadarSnapshot> {
  const company = COMPANIES[ticker] ?? ticker;
  const nowMs = opts.nowMs ?? Date.now();
  const weekAgo = new Date(nowMs - 7 * 86_400_000).toISOString().slice(0, 10);
  const jobs = {
    earnings: () => search({ query: `${company} ${ticker} next earnings date` }),
    news: () => search({ query: `${company} ${ticker} stock news`, after_date: weekAgo }),
    actions: () => search({ query: `${company} ${ticker} ex-dividend date stock split trading halt` }),
  };
  const names = Object.keys(jobs) as (keyof typeof jobs)[];
  const settled = await Promise.allSettled(names.map((n) => jobs[n]()));
  const hits: Record<string, SearchHit[]> = {};
  const failures: string[] = [];
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") hits[names[i]] = s.value;
    else { hits[names[i]] = []; failures.push(names[i]); opts.log?.(`${ticker} ${names[i]} search failed: ${s.reason?.message ?? s.reason}`); }
  });
  return buildSnapshot({ ticker, company, earnings: hits.earnings, news: hits.news, actions: hits.actions, nowMs, windowEndMs: opts.windowEndMs, failures });
}
