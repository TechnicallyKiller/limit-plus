// End-to-end checks for the Risk Radar UI, including failure behaviour. Needs the app running.
//   PW_CHROMIUM=/path/to/chrome node tools/qa/radar.mjs [baseUrl]
import { chromium } from "@playwright/test";
const base = process.argv[2] ?? "http://127.0.0.1:3000";
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
let failed = 0;
const check = (name, ok, extra = "") => { if (!ok) failed++; console.log(`${ok ? "ok  " : "FAIL"} ${name}${extra ? " " + extra : ""}`); };

const snap = (over = {}) => ({
  ticker: "NVDA", company: "NVIDIA", asOf: new Date(Date.now() - 5 * 60_000).toISOString(), windowEnd: new Date(Date.now() + 86_400_000).toISOString(),
  level: "calm", headline: "No catalysts before this round closes.", events: [], sources: [], conflict: false, provider: "tinyfish", failures: [], ...over,
});
const ev = (label, severity = 2, kind = "earnings") => ({ kind, label, severity, sourceName: "reuters.com", sourceUrl: "https://reuters.com/a" });

async function run(name, respond, assertFn) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("**/api/radar**", respond);
  await page.goto(`${base}/round/demo`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const panel = page.locator('section[aria-label="Risk radar"]');
  const text = await panel.innerText();
  await assertFn(text, panel, page);
  check(`${name}: no page errors`, errors.length === 0, errors[0] ?? "");
  check(`${name}: no em or en dashes`, !/[–—]/.test(text));
  check(`${name}: rest of the round page still renders`, (await page.locator("h1").first().innerText()).length > 0 && (await page.getByText("Sealed bids").count()) > 0);
  await ctx.close();
}
const json = (body, status = 200) => (route) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

await run("calm", json(snap()), (t) => check("calm: shows Calm and the headline", /Calm/.test(t) && /No catalysts/.test(t) && /Checked 5 minutes ago with TinyFish/.test(t)));
await run("watch", json(snap({ level: "watch", headline: "Sources disagree on the earnings date", events: [ev("Sources disagree on the earnings date: Feb 24, 2027 or Mar 3, 2027", 1)] })), (t) => check("watch: shows Watch", /Watch/.test(t)));
await run("high", json(snap({ level: "high", headline: "Earnings on Nov 24, 2026, before this round closes", events: [ev("Earnings on Nov 24, 2026, before this round closes")] })), async (t, p) => {
  check("high: shows High risk", /High risk/.test(t));
  const link = p.locator("a", { hasText: "reuters.com" });
  check("high: source link opens safely in a new tab", (await link.getAttribute("target")) === "_blank" && /noopener/.test((await link.getAttribute("rel")) ?? ""));
});
await run("unknown", json(snap({ level: "unknown", headline: "Some checks failed, so there is no all-clear yet", failures: ["news"] })), (t) => check("unknown: says Not checked and warns the check is incomplete", /Not checked/.test(t) && /incomplete/.test(t) && !/Calm/.test(t)));
await run("saved snapshot", json(snap({ provider: "snapshot" })), (t) => check("snapshot: labelled as saved, not live", /Saved check from/.test(t) && !/with TinyFish web search/.test(t)));
await run("api 500", json({ error: "boom" }, 500), (t) => check("api 500: shows a calm error message, no stack or JSON", /could not check/.test(t) && !/boom|undefined|\{/.test(t)));
await run("api offline", (route) => route.abort("failed"), (t) => check("offline: shows the error message", /could not check/.test(t)));
await run("malicious text is inert", json(snap({ headline: "<img src=x onerror=alert(1)>", events: [ev("<script>window.__xss=1</script>")] })), async (t, p, page) => {
  check("xss: rendered as plain text", t.includes("<img src=x") && (await page.evaluate(() => window.__xss)) === undefined);
});
// the pools board shows the pill for the selected pool
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.route("**/api/radar**", json(snap({ level: "watch" })));
  await page.goto(`${base}/pools`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  check("pools: peek card shows the radar pill", (await page.getByText("Watch").count()) > 0);
  await ctx.close();
}
// the API itself
for (const [q, status] of [["NVDAx", 200], ["nvda", 200], ["AMDx", 200], ["ZZZ", 404], ["", 404], ["../../etc/passwd", 404]]) {
  const r = await fetch(`${base}/api/radar?ticker=${encodeURIComponent(q)}`);
  check(`api ticker="${q}" returns ${status}`, r.status === status, `got ${r.status}`);
}
await browser.close();
process.exit(failed ? 1 : 0);
