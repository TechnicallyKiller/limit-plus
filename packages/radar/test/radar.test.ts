import { expect } from "chai";
import { buildSnapshot, classifyNews, clean, extractDates, isoDay, nextFridayClose, normalizeTicker, pickEarnings } from "../src";
import type { SearchHit } from "../src";

const NOW = Date.parse("2026-11-20T15:00:00Z");
const iso = (d: Date) => isoDay(d);

// Real TinyFish Search results for "NVIDIA NVDA next earnings date" on 2026-11-20.
const NVDA_EARNINGS: SearchHit[] = [
  { title: "NVIDIA Earnings Dates & Report (NVDA) - Investing.com UK", url: "https://uk.investing.com/equities/nvidia-corp-earnings", site_name: "uk.investing.com", date: "2026-11-19T20:59:59Z",
    snippet: "### When Is The Next NVIDIA (NVDA) Earnings Date?\nNVIDIA will release its next earnings report on 24/02/2027, according to their financial calendar." },
  { title: "NVIDIA Earnings Date (NVDA) - Investing.com Canada", url: "https://ca.investing.com/equities/nvidia-corp-earnings", site_name: "ca.investing.com", date: "2026-11-19T16:53:09Z",
    snippet: "NVIDIA will release its next earnings report on Feb 24, 2027." },
  { title: "What date does NVIDIA's (NVDA) report Earnings", url: "https://zacks.com/stock/research/NVDA/earnings-calendar", site_name: "zacks.com", date: "2026-11-17T08:01:37Z",
    snippet: "NVIDIA Corporation (NVDA) has announced they will report their next quarter earnings on November 17, 2026." },
  { title: "NVDA earnings", url: "https://wallstreethorizon.com/x", site_name: "wallstreethorizon.com", date: "2026-11-16T00:00:00Z",
    snippet: "NVDA's next earnings date is CONFIRMED for Tuesday 11/17/2026 After Market." },
];

const hit = (title: string, snippet: string, date?: string, site = "reuters.com"): SearchHit => ({ title, snippet, date, url: `https://${site}/a`, site_name: site });

describe("radar dates", () => {
  it("parses the common formats", () => {
    expect(extractDates("on Feb 24, 2027.").map(iso)).to.deep.equal(["2027-02-24"]);
    expect(extractDates("24 February 2027").map(iso)).to.deep.equal(["2027-02-24"]);
    expect(extractDates("2027-02-24").map(iso)).to.deep.equal(["2027-02-24"]);
    expect(extractDates("11/17/2026").map(iso)).to.deep.equal(["2026-11-17"]);
  });
  it("reads a first number above 12 as a day, otherwise month first", () => {
    expect(extractDates("24/02/2027").map(iso)).to.deep.equal(["2027-02-24"]);
    expect(extractDates("03/04/2027").map(iso)).to.deep.equal(["2027-03-04"]);
  });
  it("rejects impossible dates and returns each date once", () => {
    expect(extractDates("Feb 30, 2027")).to.have.length(0);
    expect(extractDates("Feb 24, 2027 and 2027-02-24")).to.have.length(1);
  });
  it("next Friday close is 4pm New York: 21:00 UTC in winter, 20:00 UTC in summer", () => {
    expect(new Date(nextFridayClose(Date.parse("2026-11-16T12:00:00Z"))).toISOString()).to.equal("2026-11-20T21:00:00.000Z"); // EST
    expect(new Date(nextFridayClose(Date.parse("2026-07-13T12:00:00Z"))).toISOString()).to.equal("2026-07-17T20:00:00.000Z"); // EDT
  });
  it("on a Friday it is that day before the close and the next week after it", () => {
    expect(new Date(nextFridayClose(Date.parse("2026-11-20T15:00:00Z"))).toISOString()).to.equal("2026-11-20T21:00:00.000Z");
    expect(new Date(nextFridayClose(Date.parse("2026-11-20T21:00:00Z"))).toISOString()).to.equal("2026-11-20T21:00:00.000Z");
    expect(new Date(nextFridayClose(Date.parse("2026-11-20T21:00:01Z"))).toISOString()).to.equal("2026-11-27T21:00:00.000Z");
    expect(new Date(nextFridayClose(Date.parse("2026-11-21T03:00:00Z"))).toISOString()).to.equal("2026-11-27T21:00:00.000Z");
  });
  it("handles the daylight saving changeovers", () => {
    // US clocks go back on 2026-11-01 and forward on 2026-03-08.
    expect(new Date(nextFridayClose(Date.parse("2026-10-30T12:00:00Z"))).toISOString()).to.equal("2026-10-30T20:00:00.000Z"); // still EDT
    expect(new Date(nextFridayClose(Date.parse("2026-11-02T12:00:00Z"))).toISOString()).to.equal("2026-11-06T21:00:00.000Z"); // EST
    expect(new Date(nextFridayClose(Date.parse("2026-03-06T12:00:00Z"))).toISOString()).to.equal("2026-03-06T21:00:00.000Z"); // EST
    expect(new Date(nextFridayClose(Date.parse("2026-03-09T12:00:00Z"))).toISOString()).to.equal("2026-03-13T20:00:00.000Z"); // EDT
  });
  it("is always a Friday within a week and never in the past", () => {
    for (let h = 0; h < 24 * 14; h += 5) {
      const now = Date.parse("2026-11-01T00:00:00Z") + h * 3_600_000;
      const t = nextFridayClose(now);
      expect(t).to.be.at.least(now);
      expect(t - now).to.be.at.most(7 * 86_400_000);
      expect(new Date(t).getUTCDay()).to.equal(5);
    }
  });
});

describe("radar earnings", () => {
  it("ignores last quarter's date and picks the next one (real NVDA data)", () => {
    const e = pickEarnings(NVDA_EARNINGS, NOW);
    expect(e.next?.date).to.equal("2027-02-24");
    expect(e.conflict).to.equal(false);
  });
  it("flags sources that name different upcoming dates", () => {
    const e = pickEarnings([...NVDA_EARNINGS, hit("NVDA earnings", "NVIDIA next earnings report on Mar 3, 2027", undefined, "other.com")], NOW);
    expect(e.conflict).to.equal(true);
    expect(e.next?.date).to.equal("2027-02-24"); // more distinct sites agree
  });
  it("returns nothing when only past dates appear", () => {
    expect(pickEarnings(NVDA_EARNINGS.slice(2), NOW).next).to.equal(undefined);
  });
});

describe("radar news", () => {
  const recent = "2026-11-19T10:00:00Z";
  it("flags a recent trading halt as severe", () => {
    const ev = classifyNews([hit("Trading halted in NVIDIA shares", "NVDA stock trading halted pending news", recent)], "NVDA", "NVIDIA", NOW);
    expect(ev).to.have.length(1);
    expect(ev[0].severity).to.equal(2);
    expect(ev[0].kind).to.equal("halt");
  });
  it("ignores old, undated and unrelated articles", () => {
    expect(classifyNews([hit("NVIDIA stock split", "NVDA stock split", "2026-10-01T00:00:00Z")], "NVDA", "NVIDIA", NOW)).to.have.length(0);
    expect(classifyNews([hit("NVIDIA stock split", "NVDA stock split")], "NVDA", "NVIDIA", NOW)).to.have.length(0);
    expect(classifyNews([hit("Tesla stock split", "TSLA stock split", recent)], "NVDA", "NVIDIA", NOW)).to.have.length(0);
  });
  it("treats an analyst downgrade as worth a look, not severe", () => {
    const ev = classifyNews([hit("Analyst downgrades NVIDIA", "NVDA downgrade by a bank", recent)], "NVDA", "NVIDIA", NOW);
    expect(ev[0].severity).to.equal(1);
  });
  it("removes em and en dashes from source titles", () => {
    expect(clean("NVIDIA — shares – fall")).to.equal("NVIDIA - shares - fall");
  });
});

describe("radar verdict", () => {
  const close = Date.parse("2026-11-20T21:00:00Z");
  const base = { ticker: "NVDA", company: "NVIDIA", news: [], actions: [], nowMs: NOW, windowEndMs: close };
  it("is calm when earnings land after the round closes", () => {
    const s = buildSnapshot({ ...base, earnings: NVDA_EARNINGS });
    expect(s.level).to.equal("calm");
    expect(s.headline).to.contain("Feb 24, 2027");
    expect(s.provider).to.equal("tinyfish");
  });
  it("is high when earnings land before the round closes", () => {
    const s = buildSnapshot({ ...base, windowEndMs: Date.parse("2027-03-05T21:00:00Z"), earnings: NVDA_EARNINGS });
    expect(s.level).to.equal("high");
    expect(s.headline).to.contain("before this round closes");
  });
  it("is watch on the day the round closes, and when sources disagree", () => {
    const sameDay = buildSnapshot({ ...base, windowEndMs: Date.parse("2027-02-24T21:00:00Z"), earnings: NVDA_EARNINGS });
    expect(sameDay.level).to.equal("watch");
    // The better-supported date is after the window, but a rival date falls inside it: that is worth a look.
    const mixed = [
      hit("NVDA earnings", "NVIDIA next earnings report on Mar 3, 2027", undefined, "a.com"),
      hit("NVDA earnings", "NVIDIA next earnings report on Mar 3, 2027", undefined, "b.com"),
      hit("NVDA earnings", "NVIDIA next earnings report on Feb 24, 2027", undefined, "c.com"),
    ];
    const conflict = buildSnapshot({ ...base, windowEndMs: Date.parse("2027-02-26T21:00:00Z"), earnings: mixed });
    expect(conflict.level).to.equal("watch");
    expect(conflict.conflict).to.equal(true);
    expect(conflict.headline).to.contain("disagree");
  });
  it("stays calm when sources differ but every candidate date is after the round closes", () => {
    const s = buildSnapshot({ ...base, earnings: [...NVDA_EARNINGS, hit("NVDA earnings", "NVIDIA next earnings report on Mar 3, 2027", undefined, "other.com")] });
    expect(s.level).to.equal("calm");
    expect(s.conflict).to.equal(false);
    expect(s.headline).to.contain("Feb 24, 2027");
    expect(s.events.some((e) => /expected Feb 24, 2027 to Mar 3, 2027/.test(e.label))).to.equal(true);
  });
  it("never says calm when a search failed or nothing came back", () => {
    expect(buildSnapshot({ ...base, earnings: [], failures: ["earnings", "news", "actions"] }).level).to.equal("unknown");
    expect(buildSnapshot({ ...base, earnings: NVDA_EARNINGS, failures: ["news"] }).level).to.equal("unknown");
    expect(buildSnapshot({ ...base, earnings: [] }).level).to.equal("unknown");
  });
  it("keeps UI text free of em and en dashes", () => {
    const s = buildSnapshot({ ...base, earnings: NVDA_EARNINGS, news: [hit("NVIDIA — Halted", "NVDA trading halted", "2026-11-19T10:00:00Z")] });
    expect(JSON.stringify(s)).to.not.match(/[–—]/);
  });
  it("maps tickers from x tokens", () => {
    expect(normalizeTicker("NVDAx")).to.equal("NVDA");
    expect(normalizeTicker("amd")).to.equal("AMD");
    expect(normalizeTicker("XYZx")).to.equal(undefined);
  });
});

import { RadarService, runRadar } from "../src";
import type { RadarSearch } from "../src";

describe("radar runner and service", () => {
  const ok: RadarSearch = async (p) => (p.query.includes("earnings") ? NVDA_EARNINGS : []);
  it("runs three searches and returns a verdict", async () => {
    const s = await runRadar(ok, "NVDA", { nowMs: NOW, windowEndMs: Date.parse("2026-11-20T21:00:00Z") });
    expect(s.level).to.equal("calm");
    expect(s.failures).to.deep.equal([]);
  });
  it("reports failed searches and refuses an all-clear instead of throwing", async () => {
    const flaky: RadarSearch = async (p) => { if (p.query.includes("news")) throw new Error("boom"); return NVDA_EARNINGS; };
    const s = await runRadar(flaky, "NVDA", { nowMs: NOW, windowEndMs: Date.parse("2026-11-20T21:00:00Z") });
    expect(s.failures).to.deep.equal(["news"]);
    expect(s.level).to.equal("unknown");
    const dead: RadarSearch = async () => { throw new Error("down"); };
    expect((await runRadar(dead, "NVDA", { nowMs: NOW })).level).to.equal("unknown");
  });
  it("keeps the last good snapshot when a refresh comes back incomplete", async () => {
    let t = NOW;
    let broken = false;
    const search: RadarSearch = async (p) => { if (broken) throw new Error("down"); return p.query.includes("earnings") ? NVDA_EARNINGS : []; };
    const svc = new RadarService(search, { tickers: ["NVDA"], now: () => t });
    const first = await svc.refresh("NVDA", Date.parse("2026-11-20T21:00:00Z"));
    expect(first.level).to.equal("calm");
    broken = true; t += 3_600_000;
    const second = await svc.refresh("NVDA");
    expect(second.asOf).to.equal(first.asOf);
    t += 7 * 3_600_000; // older than the stale limit: now it must say unknown
    expect((await svc.refresh("NVDA")).level).to.equal("unknown");
  });
});

import { parseHitDate, tinyfishSearch } from "../src";

describe("radar hit dates and http adapter", () => {
  it("parses every date shape TinyFish returns", () => {
    expect(parseHitDate("2026-11-14T09:00:00Z", NOW)).to.equal(Date.parse("2026-11-14T09:00:00Z"));
    expect(parseHitDate("Wed, 18 Nov 2026 14:05:00 GMT", NOW)).to.equal(Date.parse("2026-11-18T14:05:00Z"));
    expect(parseHitDate("15 hours ago", NOW)).to.equal(NOW - 15 * 3_600_000);
    expect(parseHitDate("2 days ago", NOW)).to.equal(NOW - 2 * 86_400_000);
    expect(parseHitDate("1 day ago", NOW)).to.equal(NOW - 86_400_000);
    expect(parseHitDate("a day ago", NOW)).to.equal(NOW - 86_400_000);
    expect(parseHitDate("yesterday", NOW)).to.equal(NOW - 86_400_000);
    expect(parseHitDate(undefined, NOW)).to.equal(undefined);
    expect(parseHitDate("whenever", NOW)).to.equal(undefined);
  });
  it("counts news published hours ago and in RFC format", () => {
    const a = classifyNews([hit("Trading halted in NVIDIA", "NVDA halted", "15 hours ago")], "NVDA", "NVIDIA", NOW);
    const b = classifyNews([hit("Trading halted in NVIDIA", "NVDA halted", "Wed, 18 Nov 2026 14:05:00 GMT")], "NVDA", "NVIDIA", NOW);
    expect(a).to.have.length(1);
    expect(b).to.have.length(1);
    expect(classifyNews([hit("Trading halted in NVIDIA", "NVDA halted", "9 days ago")], "NVDA", "NVIDIA", NOW)).to.have.length(0);
  });

  const resp = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;
  it("sends the key as a header, never in the URL, and maps results", async () => {
    let seen: { url: string; headers: any } | undefined;
    const f = (async (url: string, init: any) => { seen = { url, headers: init.headers }; return resp(200, { results: [{ title: "t", snippet: "s", url: "https://x.com", site_name: "x.com", date: "2 days ago" }] }); }) as any;
    const out = await tinyfishSearch("k-123", { fetchImpl: f })({ query: "a b", after_date: "2026-11-13" });
    expect(out).to.deep.equal([{ title: "t", snippet: "s", url: "https://x.com", site_name: "x.com", date: "2 days ago" }]);
    expect(seen!.headers["X-API-Key"]).to.equal("k-123");
    expect(seen!.url).to.not.contain("k-123");
    expect(seen!.url).to.contain("query=a+b").and.contain("after_date=2026-11-13");
  });
  it("retries once on a 5xx, then succeeds", async () => {
    let n = 0;
    const f = (async () => (++n === 1 ? resp(503, {}) : resp(200, { results: [] }))) as any;
    expect(await tinyfishSearch("k", { fetchImpl: f, sleepImpl: async () => {} })({ query: "q" })).to.deep.equal([]);
    expect(n).to.equal(2);
  });
  it("fails loudly on a 4xx, a persistent 5xx, a network error, and a malformed body", async () => {
    let n = 0;
    await tinyfishSearch("k", { fetchImpl: (async () => { n++; return resp(401, {}); }) as any })({ query: "q" }).then(() => expect.fail(), (e) => expect(e.message).to.contain("401"));
    expect(n).to.equal(1); // no retry on a client error
    await tinyfishSearch("k", { fetchImpl: (async () => resp(500, {})) as any, sleepImpl: async () => {} })({ query: "q" }).then(() => expect.fail(), (e) => expect(e.message).to.contain("500"));
    await tinyfishSearch("k", { fetchImpl: (async () => { throw new Error("offline"); }) as any, sleepImpl: async () => {} })({ query: "q" }).then(() => expect.fail(), (e) => expect(e.message).to.equal("offline"));
    await tinyfishSearch("k", { fetchImpl: (async () => resp(200, { nope: 1 })) as any })({ query: "q" }).then(() => expect.fail(), (e) => expect(e.message).to.contain("no results field"));
  });
  const hdr = (h: Record<string, string>) => ({ get: (k: string) => h[k.toLowerCase()] ?? null });
  const resp2 = (status: number, body: unknown, h: Record<string, string> = {}) => ({ ok: status >= 200 && status < 300, status, headers: hdr(h), json: async () => body }) as unknown as Response;
  it("waits out a 429 using Retry-After, then succeeds", async () => {
    let n = 0; const waits: number[] = [];
    const f = (async () => (++n === 1 ? resp2(429, {}, { "retry-after": "7" }) : resp2(200, { results: [] }))) as any;
    expect(await tinyfishSearch("k", { fetchImpl: f, sleepImpl: async (ms) => { waits.push(ms); } })({ query: "q" })).to.deep.equal([]);
    expect(waits).to.deep.equal([7000]);
    expect(n).to.equal(2);
  });
  it("gives up after repeated 429s with a clear error", async () => {
    const f = (async () => resp2(429, {}, { "retry-after": "1" })) as any;
    await tinyfishSearch("k", { fetchImpl: f, sleepImpl: async () => {} })({ query: "q" }).then(() => expect.fail(), (e) => expect(e.message).to.contain("429"));
  });
  it("pauses before the window is exhausted instead of hitting a 429", async () => {
    let clock = 1_000_000; const waits: number[] = []; let calls = 0;
    const f = (async () => { calls++; return resp2(200, { results: [] }, { "x-ratelimit-remaining": calls === 1 ? "1" : "29", "x-ratelimit-reset": String((clock + 20_000) / 1000) }); }) as any;
    const search = tinyfishSearch("k", { fetchImpl: f, nowImpl: () => clock, sleepImpl: async (ms) => { waits.push(ms); clock += ms; } });
    await search({ query: "a" });
    await search({ query: "b" });
    expect(waits).to.have.length(1);
    expect(waits[0]).to.be.within(20_000, 21_000);
    expect(calls).to.equal(2);
  });
  it("runs overlapping searches one at a time", async () => {
    let active = 0, peak = 0;
    const f = (async () => { active++; peak = Math.max(peak, active); await new Promise((r) => setTimeout(r, 5)); active--; return resp2(200, { results: [] }); }) as any;
    const search = tinyfishSearch("k", { fetchImpl: f });
    await Promise.all([search({ query: "a" }), search({ query: "b" }), search({ query: "c" })]);
    expect(peak).to.equal(1);
  });
  it("refuses to start without a key", () => {
    expect(() => tinyfishSearch("")).to.throw("TINYFISH_API_KEY");
  });
});

describe("radar false positives seen in live TinyFish runs", () => {
  const recent = "15 hours ago";
  const n = (title: string, snippet = "") => classifyNews([hit(title, snippet || title, recent)], "NVDA", "NVIDIA", NOW);
  it("ignores evergreen explainers that merely mention a split or dividend", () => {
    expect(n("NVIDIA Stock Split: What Investors Need to Know")).to.have.length(0);
    expect(classifyNews([hit("Meta Stock Split: History and Future Outlook", "Meta stock split history", recent)], "META", "Meta Platforms", NOW)).to.have.length(0);
    expect(classifyNews([hit("AMD Stock Dividend History & AMD Dividend Yield", "AMD dividend history", recent, "investing.com")], "AMD", "Advanced Micro Devices", NOW)).to.have.length(0);
    expect(n("Will NVIDIA stock split again?")).to.have.length(0);
    expect(n("NVIDIA price forecast and prediction")).to.have.length(0);
  });
  it("still flags a real, announced split as severe", () => {
    const ev = n("NVIDIA announces 10-for-1 stock split effective next week");
    expect(ev).to.have.length(1);
    expect(ev[0].severity).to.equal(2);
    expect(ev[0].label).to.contain("Stock split announced");
  });
  it("needs analyst context for a rating change", () => {
    expect(n("NVIDIA upgrade your graphics card now")).to.have.length(0);
    expect(n("Analyst upgrades NVIDIA, raises price target")[0].severity).to.equal(1);
  });
  it("flags a dividend only through its ex-dividend date inside the window", () => {
    const close = Date.parse("2026-11-20T21:00:00Z");
    const s = buildSnapshot({ ticker: "AMD", company: "Advanced Micro Devices", nowMs: NOW, windowEndMs: close, earnings: NVDA_EARNINGS, news: [], actions: [hit("AMD dividend", "AMD ex-dividend date is Nov 19, 2026", undefined, "dividend.com")] });
    expect(s.events.some((e) => /Ex-dividend/.test(e.label))).to.equal(false); // Nov 19 is already past
    const s2 = buildSnapshot({ ticker: "AMD", company: "Advanced Micro Devices", nowMs: NOW, windowEndMs: close, earnings: NVDA_EARNINGS, news: [], actions: [hit("AMD dividend", "AMD ex-dividend date is Nov 20, 2026", undefined, "dividend.com")] });
    expect(s2.level).to.equal("watch");
    expect(s2.headline).to.contain("Ex-dividend on Nov 20, 2026");
  });
  it("only calls a price move sharp at 5 percent or more, and not when it is a multi-month trend", () => {
    expect(n("Amazon.com stock jumps 3.8%")).to.have.length(0);
    expect(classifyNews([hit("Meta Platforms Rises 12% in 3 Months: Buy, Sell, or Hold the Stock?", "Meta rises 12% in 3 months", recent)], "META", "Meta Platforms", NOW)).to.have.length(0);
    expect(n("NVIDIA stock soars 8% after the report")[0].label).to.contain("Sharp price move");
    expect(n("NVIDIA stock jumps without a number")).to.have.length(0);
    expect(classifyNews([hit("Meta Platforms (META) Surges as AI Ranking Models Accelerate U.S. Ad Revenue Growth to 31%", "Meta surges", recent)], "META", "Meta Platforms", NOW)).to.have.length(0);
    expect(classifyNews([hit("Amazon.com (NASDAQ:AMZN) Stock Jumps 3.8% - Here's Why", "Amazon jumps 3.8% and is up 12% this month", recent)], "AMZN", "Amazon", NOW)).to.have.length(0);
    expect(classifyNews([hit("Microsoft (MSFT) Stock Looks Like A Bargain On Its 60% 5 Year Run", "Microsoft bargain", recent)], "MSFT", "Microsoft", NOW)).to.have.length(0);
    expect(classifyNews([hit("Alphabet Drops 6% in a Month: Buy, Sell, or Hold the GOOGL Stock?", "Alphabet drops", recent)], "GOOGL", "Alphabet", NOW)).to.have.length(0);
    expect(classifyNews([hit("Coinbase Stocks Fall 7.54% as Bitcoin Slides Toward $64,000", "Coinbase falls", recent)], "COIN", "Coinbase", NOW)[0].severity).to.equal(1);
    expect(n("NVIDIA shares plunge 11% on export curbs")[0].severity).to.equal(1);
    expect(n("NVIDIA 9% drop wipes out gains")[0].severity).to.equal(1);
  });
});
