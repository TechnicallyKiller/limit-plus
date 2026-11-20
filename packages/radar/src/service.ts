import { runRadar, type RadarSearch } from "./tinyfish";
import type { RadarSnapshot } from "./types";

const HOUR = 3_600_000;

export interface ServiceOptions {
  tickers: string[];
  /** Pause between stocks so a refresh never bursts. */
  gapMs?: number;
  /** A failed refresh keeps the last good snapshot for this long. */
  keepStaleMs?: number;
  log?: (msg: string) => void;
  now?: () => number;
}

/** Holds the latest radar snapshot per stock and refreshes them from TinyFish in the background. */
export class RadarService {
  private cache = new Map<string, RadarSnapshot>();
  private timer?: NodeJS.Timeout;
  lastRunAt?: string;
  lastError?: string;

  constructor(private search: RadarSearch, private o: ServiceOptions) {}
  private now() { return this.o.now ? this.o.now() : Date.now(); }
  private log(m: string) { this.o.log?.(`[radar] ${m}`); }

  get(ticker: string): RadarSnapshot | undefined { return this.cache.get(ticker); }
  all(): RadarSnapshot[] { return [...this.cache.values()]; }
  seed(s: RadarSnapshot[]) { for (const x of s) if (!this.cache.has(x.ticker)) this.cache.set(x.ticker, x); }

  async refresh(ticker: string, windowEndMs?: number): Promise<RadarSnapshot> {
    const next = await runRadar(this.search, ticker, { nowMs: this.now(), windowEndMs, log: (m) => this.log(m) });
    const prev = this.cache.get(ticker);
    const prevAge = prev ? this.now() - Date.parse(prev.asOf) : Infinity;
    if (next.level === "unknown" && prev && prev.level !== "unknown" && prevAge < (this.o.keepStaleMs ?? 6 * HOUR)) {
      this.log(`${ticker}: refresh incomplete (${next.failures.join(", ") || "no results"}), keeping the snapshot from ${prev.asOf}`);
      return prev;
    }
    this.cache.set(ticker, next);
    this.log(`${ticker}: ${next.level}. ${next.headline}`);
    return next;
  }

  async refreshAll(): Promise<void> {
    for (const t of this.o.tickers) {
      try { await this.refresh(t); this.lastError = undefined; }
      catch (e: any) { this.lastError = String(e?.message ?? e); this.log(`${t}: ${this.lastError}`); }
      await new Promise((r) => setTimeout(r, this.o.gapMs ?? 1500));
    }
    this.lastRunAt = new Date(this.now()).toISOString();
  }

  start(intervalMs = 30 * 60_000) {
    void this.refreshAll();
    this.timer = setInterval(() => void this.refreshAll(), intervalMs);
    this.timer.unref?.();
  }
  stop() { if (this.timer) clearInterval(this.timer); }
}
