import { extractDates, isoDay, nextFridayClose, parseHitDate, startOfUtcDay } from "./dates";
import type { EventKind, RadarEvent, RadarSnapshot, RiskLevel, SearchHit } from "./types";

const DAY = 86_400_000;

/** Dashes in source titles are replaced so UI text never contains an em or en dash. */
export const clean = (s: string) => s.replace(/\s*[–—]\s*/g, " - ").replace(/\s+/g, " ").trim();

export function domainOf(url: string): string {
  try {
    const labels = new URL(url).hostname.replace(/^www\./, "").split(".");
    const twoPart = ["co", "com", "org", "gov"].includes(labels[labels.length - 2] ?? "") && labels[labels.length - 1].length === 2;
    return labels.slice(twoPart ? -3 : -2).join(".");
  } catch { return url; }
}

const nameOf = (h: SearchHit) => h.site_name ? domainOf(`https://${h.site_name}`) : domainOf(h.url);
const text = (h: SearchHit) => `${h.title} ${h.snippet}`;
export const fmtDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export interface EarningsPick {
  /** The most agreed-on upcoming date, ISO. */
  next?: { date: string; domains: string[]; hit: SearchHit };
  /** Sources that named different upcoming dates. */
  conflict: boolean;
  dates: string[];
}

/**
 * The next earnings date strictly in the future. Past dates in a page (last quarter's report) are ignored, and each hit
 * contributes its earliest upcoming date, because that is the next report. The date most distinct sites agree on wins.
 */
export function pickEarnings(hits: SearchHit[], nowMs: number): EarningsPick {
  const today = startOfUtcDay(nowMs);
  const votes = new Map<string, { domains: Set<string>; hit: SearchHit }>();
  for (const h of hits) {
    if (!/earnings|quarterly results|report(s|ing)? (its )?(results|quarter)/i.test(text(h))) continue;
    const future = extractDates(text(h)).map((d) => d.getTime()).filter((t) => t >= today && t <= today + 370 * DAY).sort((a, b) => a - b);
    if (!future.length) continue;
    const key = isoDay(future[0]);
    const v = votes.get(key) ?? { domains: new Set<string>(), hit: h };
    v.domains.add(nameOf(h));
    votes.set(key, v);
  }
  const ranked = [...votes.entries()].sort((a, b) => b[1].domains.size - a[1].domains.size || a[0].localeCompare(b[0]));
  const dates = ranked.map(([d]) => d);
  if (!ranked.length) return { conflict: false, dates };
  const [date, v] = ranked[0];
  return { next: { date, domains: [...v.domains], hit: v.hit }, conflict: ranked.length > 1, dates };
}

interface Rule { re: RegExp; severity: 1 | 2; kind: EventKind; label: string; also?: RegExp; when?: (h: SearchHit) => boolean }
/** Words that mean something is being announced or decided, as opposed to an article explaining a topic. */
const ANNOUNCE = /\b(announc\w*|approv\w*|declar\w*|authoriz\w*|board|effective|will (split|buy|repurchase)|plans? to|set to|to (split|buy back|repurchase))\b/i;
const ANALYST = /\b(analyst|rating|price target|wall street|brokerage|investment bank)\b/i;
/** Evergreen and explainer pages keep matching risk words forever, so they are never treated as news. */
const EXPLAINER = /what (investors|you|to)|everything (you|to)|need to know|history|explained|explainer|guide|how (to|does|do)\b|should you|\bfaq\b|prediction|price forecast|could (it|\w+) split|will \w+ (stock )?split\?|when (is|will)|outlook for/i;
const MOVE = "\\b(?:plunge|tumble|slump|sink|crash|soar|surge|jump|spike|rall|fall|drop|slide|slip|climb|rise|gain|lose|sell[- ]?off|dive|rocket|skid|slash)\\w*";
/** The largest percentage tied to a price-move verb in the headline ("Sinks 8%", "8% drop"), or 0. Revenue growth and similar do not count. */
const movePct = (title: string) => Math.max(0, ...[
  ...title.matchAll(new RegExp(`${MOVE}[^%.;:]{0,25}?(\\d+(?:\\.\\d+)?)\\s?%`, "gi")),
  ...title.matchAll(new RegExp(`(\\d+(?:\\.\\d+)?)\\s?%\\s+${MOVE}`, "gi")),
].map((m) => +m[1]));
/** "in 3 months", "year to date" and similar describe a trend, not a sharp move before this Friday. */
const LONG_TERM = /\b(in|over|past|last)\s+(the\s+|a\s+)?(\d+\s+|three\s+|six\s+|twelve\s+|several\s+)?(months?|quarters?|years?)\b|\b\d+[- ]year\b|year[- ]to[- ]date|\bytd\b|this year|since (january|last year)/i;
const SHARP_MOVE = (h: SearchHit) => movePct(h.title) >= 5 && !LONG_TERM.test(h.title);
const RULES: Rule[] = [
  { re: /trading (was |is |has been )?halt|halted|suspends? trading/i, severity: 2, kind: "halt", label: "Trading halt reported" },
  { re: /delist/i, severity: 2, kind: "corporate_action", label: "Delisting in the news", also: ANNOUNCE },
  { re: /bankrupt|chapter 11/i, severity: 2, kind: "news", label: "Bankruptcy in the news" },
  { re: /\b(sec|doj|ftc)\b[^.]{0,40}(probe|investigat|charges?|subpoena|sues?|lawsuit)/i, severity: 2, kind: "news", label: "Regulator action reported" },
  { re: /profit warning|(cuts?|lowers?|slashes?) (its )?(guidance|forecast|outlook)/i, severity: 2, kind: "news", label: "Guidance cut reported" },
  { re: /(reverse |stock |share )split/i, severity: 2, kind: "corporate_action", label: "Stock split announced", also: ANNOUNCE },
  { re: /downgrad/i, severity: 1, kind: "news", label: "Analyst downgrade", also: ANALYST },
  { re: /upgrad/i, severity: 1, kind: "news", label: "Analyst upgrade", also: ANALYST },
  { re: /buyback|repurchase/i, severity: 1, kind: "corporate_action", label: "Buyback announced", also: ANNOUNCE },
  { re: /acquisition|acquires?|merger|takeover/i, severity: 1, kind: "news", label: "Deal news", also: ANNOUNCE },
  { re: new RegExp(MOVE, "i"), severity: 1, kind: "news", label: "Sharp price move reported", when: SHARP_MOVE },
];

/** Recent, dated news about the company that matches a risk rule. Undated hits are skipped, since staleness is unknowable. */
export function classifyNews(hits: SearchHit[], ticker: string, company: string, nowMs: number): RadarEvent[] {
  const first = company.split(/\s+/)[0].replace(/[^A-Za-z0-9]/g, "");
  const mention = new RegExp(`\\b(${ticker}|${first})\\b`, "i");
  const out: RadarEvent[] = [];
  const seen = new Set<string>();
  for (const h of hits) {
    if (!mention.test(text(h))) continue;
    const t = parseHitDate(h.date, nowMs);
    if (t === undefined || t < nowMs - 7 * DAY || t > nowMs + DAY) continue;
    if (EXPLAINER.test(text(h))) continue;
    const rule = RULES.find((r) => r.re.test(text(h)) && (!r.also || r.also.test(text(h))) && (!r.when || r.when(h)));
    if (!rule) continue;
    const key = `${rule.label}|${nameOf(h)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ kind: rule.kind, label: `${rule.label}: ${clean(h.title).slice(0, 110)}`, date: isoDay(t), severity: rule.severity, sourceName: nameOf(h), sourceUrl: h.url });
  }
  return out.sort((a, b) => b.severity - a.severity).slice(0, 4);
}

/** An ex-dividend date that falls inside the window changes what a holder is owed, so it is worth a look. */
export function pickDividend(hits: SearchHit[], nowMs: number, windowEndMs: number): RadarEvent | undefined {
  for (const h of hits) {
    if (!/ex-?dividend/i.test(text(h))) continue;
    const d = extractDates(text(h)).map((x) => x.getTime()).filter((t) => t >= startOfUtcDay(nowMs) && t <= windowEndMs).sort((a, b) => a - b)[0];
    if (d !== undefined) return { kind: "corporate_action", label: `Ex-dividend on ${fmtDate(isoDay(d))}, before this round closes`, date: isoDay(d), severity: 1, sourceName: nameOf(h), sourceUrl: h.url };
  }
}

export interface BuildInput {
  ticker: string;
  company: string;
  earnings: SearchHit[];
  news: SearchHit[];
  actions: SearchHit[];
  nowMs: number;
  /** Official close of the round being judged. Defaults to the next Friday close. */
  windowEndMs?: number;
  failures?: string[];
  provider?: RadarSnapshot["provider"];
}

const SEV_LEVEL: Record<number, RiskLevel> = { 0: "calm", 1: "watch", 2: "high" };

export function buildSnapshot(i: BuildInput): RadarSnapshot {
  const windowEnd = i.windowEndMs ?? nextFridayClose(i.nowMs);
  const failures = i.failures ?? [];
  const events: RadarEvent[] = [];

  const e = pickEarnings(i.earnings, i.nowMs);
  const endDay = startOfUtcDay(windowEnd);
  if (e.next) {
    const day = Date.parse(`${e.next.date}T00:00:00Z`);
    const before = day < endDay;
    const same = day === endDay;
    events.push({
      kind: "earnings", date: e.next.date, severity: before ? 2 : same ? 1 : 0,
      label: `Earnings on ${fmtDate(e.next.date)}${before ? ", before this round closes" : same ? ", the day this round closes" : ", after this round closes"}`,
      sourceName: e.next.domains[0], sourceUrl: e.next.hit.url,
    });
  }
  const conflictMatters = e.conflict && e.dates.some((d) => Date.parse(`${d}T00:00:00Z`) <= endDay);
  if (e.conflict) {
    const sorted = [...e.dates].sort();
    events.push(conflictMatters
      ? { kind: "earnings", severity: 1, sourceName: "several sources", sourceUrl: i.earnings.find((h) => h.url)?.url ?? "",
          label: `Sources disagree on the earnings date: ${sorted.slice(0, 3).map(fmtDate).join(" or ")}` }
      : { kind: "earnings", severity: 0, sourceName: e.next!.domains[0], sourceUrl: e.next!.hit.url,
          label: `Next earnings expected ${fmtDate(sorted[0])} to ${fmtDate(sorted[sorted.length - 1])}, after this round closes` });
  }
  const div = pickDividend(i.actions.concat(i.news), i.nowMs, windowEnd);
  if (div) events.push(div);
  events.push(...classifyNews(i.news.concat(i.actions), i.ticker, i.company, i.nowMs));

  events.sort((a, b) => b.severity - a.severity);
  const top = events.reduce((m, ev) => Math.max(m, ev.severity), 0);
  const totalHits = i.earnings.length + i.news.length + i.actions.length;
  let level: RiskLevel = SEV_LEVEL[top];
  if (!totalHits || (failures.length > 0 && top < 1)) level = "unknown";

  const headline =
    level === "unknown" ? "Some checks failed, so there is no all-clear yet"
    : level === "calm" ? (e.next ? `No catalysts before this round closes. ${e.conflict ? "Next earnings expected" : "Next earnings"} ${e.conflict ? `${fmtDate([...e.dates].sort()[0])} or later` : fmtDate(e.next.date)}.` : "No scheduled catalysts found before this round closes")
    : events[0].label;

  const sources = [...new Map(events.filter((x) => x.sourceUrl).map((x) => [x.sourceUrl, { name: x.sourceName, url: x.sourceUrl }])).values()];
  return {
    ticker: i.ticker, company: i.company, asOf: new Date(i.nowMs).toISOString(), windowEnd: new Date(windowEnd).toISOString(),
    level, headline, events, sources, conflict: conflictMatters, provider: i.provider ?? "tinyfish", failures,
  };
}
