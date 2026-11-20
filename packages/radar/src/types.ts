export type RiskLevel = "calm" | "watch" | "high" | "unknown";
export type EventKind = "earnings" | "corporate_action" | "halt" | "news";

/** One search hit as TinyFish Search returns it. */
export interface SearchHit {
  title: string;
  snippet: string;
  url: string;
  site_name?: string;
  /** ISO timestamp of the page, when the search provider knows it. */
  date?: string;
}

export interface RadarEvent {
  kind: EventKind;
  /** Plain sentence for the UI. Never contains em or en dashes. */
  label: string;
  /** ISO date (YYYY-MM-DD) when the event has a date. */
  date?: string;
  /** 0 info, 1 worth a look, 2 can move the price before the close. */
  severity: 0 | 1 | 2;
  sourceName: string;
  sourceUrl: string;
}

export interface RadarSnapshot {
  ticker: string;
  company: string;
  /** ISO timestamp of the TinyFish run these results come from. */
  asOf: string;
  /** The window the radar judged: now until the round's official close. */
  windowEnd: string;
  level: RiskLevel;
  headline: string;
  events: RadarEvent[];
  /** Distinct sources the verdict rests on. */
  sources: { name: string; url: string }[];
  /** Earnings sources that named different upcoming dates. */
  conflict: boolean;
  /** Where these numbers came from. "snapshot" means a saved earlier run, not a live one. */
  provider: "tinyfish" | "snapshot";
  /** Searches that failed. Non-empty means the verdict may be incomplete. */
  failures: string[];
}
