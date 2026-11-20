const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5,
  jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

function valid(y: number, m: number, d: number): Date | null {
  if (y < 2000 || y > 2100 || m < 0 || m > 11 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m && dt.getUTCDate() === d ? dt : null;
}

/**
 * Every calendar date mentioned in the text, as UTC midnight. Understands "Feb 24, 2027", "24 February 2027",
 * "2027-02-24" and "11/17/2026". For "24/02/2027" the first number is a day because it cannot be a month; when both
 * numbers could be months the US order (month first) wins.
 */
export function extractDates(text: string): Date[] {
  const out = new Map<number, Date>();
  const add = (d: Date | null) => { if (d) out.set(d.getTime(), d); };
  const mon = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

  for (const m of text.matchAll(new RegExp(`\\b${mon}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(20\\d{2})\\b`, "gi")))
    add(valid(+m[3], MONTHS[m[1].toLowerCase()], +m[2]));
  for (const m of text.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${mon}\\.?,?\\s+(20\\d{2})\\b`, "gi")))
    add(valid(+m[3], MONTHS[m[2].toLowerCase()], +m[1]));
  for (const m of text.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)) add(valid(+m[1], +m[2] - 1, +m[3]));
  for (const m of text.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/g)) {
    const a = +m[1], b = +m[2];
    if (a > 12 && b <= 12) add(valid(+m[3], b - 1, a));
    else add(valid(+m[3], a - 1, b));
  }
  return [...out.values()];
}

export const startOfUtcDay = (ms: number) => Math.floor(ms / 86_400_000) * 86_400_000;
export const isoDay = (d: Date | number) => new Date(typeof d === "number" ? d : d.getTime()).toISOString().slice(0, 10);
export const daysBetween = (fromMs: number, toMs: number) => Math.round((startOfUtcDay(toMs) - startOfUtcDay(fromMs)) / 86_400_000);

const NY = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "numeric", day: "numeric", weekday: "short", hour: "numeric", hourCycle: "h23" });
const nyParts = (ms: number) => {
  const p = Object.fromEntries(NY.formatToParts(ms).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, hour: +p.hour, weekday: p.weekday };
};

/**
 * The next official US close, Friday 4:00 pm New York time (21:00 UTC in winter, 20:00 UTC in summer), at or after
 * `nowMs`. On a Friday before the close it is that same day; after the close it is a week later.
 */
export function nextFridayClose(nowMs: number): number {
  for (let add = 0; add <= 7; add++) {
    const day = nyParts(nowMs + add * 86_400_000);
    if (day.weekday !== "Fri") continue;
    // 12:00 UTC is 7 or 8 in the morning in New York, so the gap to noon tells us the UTC offset on that date.
    const offset = 12 - nyParts(Date.UTC(day.y, day.m - 1, day.d, 12)).hour;
    const close = Date.UTC(day.y, day.m - 1, day.d, 16 + offset);
    if (close >= nowMs) return close;
  }
  throw new Error("no Friday close found within 8 days");
}

const UNIT_MS: Record<string, number> = { second: 1000, minute: 60_000, hour: 3_600_000, day: 86_400_000, week: 7 * 86_400_000, month: 30 * 86_400_000 };

/**
 * A search hit's publish time in epoch ms, or undefined when it cannot be known. TinyFish returns ISO strings, RFC 2822
 * ("Wed, 18 Nov 2026 14:05:00 GMT") and relative text ("15 hours ago", "a day ago", "yesterday").
 */
export function parseHitDate(date: string | undefined, nowMs: number): number | undefined {
  if (!date) return undefined;
  const s = date.trim().toLowerCase();
  const rel = s.match(/^(an?|\d+)\s+(second|minute|hour|day|week|month)s?\s+ago$/);
  if (rel) return nowMs - (rel[1].startsWith("a") ? 1 : +rel[1]) * UNIT_MS[rel[2]];
  if (s === "yesterday") return nowMs - UNIT_MS.day;
  if (s === "today" || s === "just now") return nowMs;
  const t = Date.parse(date);
  return Number.isNaN(t) ? undefined : t;
}
