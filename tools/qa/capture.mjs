// Screenshots + design-rule checks for every page at desktop and mobile, written to a directory you choose.
//   node tools/qa/capture.mjs <outDir> [baseUrl]
// Exits non-zero if any page breaks a rule from docs/DESIGN.md section 9 (banned words, em/en dashes, horizontal scroll).
import { chromium } from "@playwright/test";
import fs from "node:fs";
const out = process.argv[2];
const base = process.argv[3] ?? "http://127.0.0.1:3000";
if (!out) { console.error("usage: node tools/qa/capture.mjs <outDir> [baseUrl]"); process.exit(2); }
fs.mkdirSync(out, { recursive: true });
const pages = [["landing", "/"], ["pools", "/pools"], ["round", "/round/demo"], ["round-deposit", "/round/demo-deposit"], ["round-cleared", "/round/demo-cleared"], ["round-settled", "/round/demo-settled"], ["portfolio", "/portfolio"]];
const sizes = [["desktop", 1440, 900], ["mobile", 390, 844]];
const BANNED = /\b(put|call|strike|premium|option|collateral)s?\b/i;
// PW_CHROMIUM lets you use an already-installed browser build when the one this Playwright version wants is missing.
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
let failed = 0;
for (const [sn, w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  for (const [name, path] of pages) {
    errors.length = 0;
    await page.goto(base + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${out}/${name}-${sn}.png`, fullPage: false });
    await page.screenshot({ path: `${out}/${name}-${sn}-full.png`, fullPage: true });
    const text = await page.evaluate(() => document.body.innerText);
    const banned = text.match(BANNED);
    const dashes = /[–—]/.test(text);
    const hscroll = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    const ok = !banned && !dashes && !hscroll && errors.length === 0;
    if (!ok) failed++;
    console.log(`${ok ? "ok  " : "FAIL"} ${sn} ${name}: banned=${banned ? banned[0] : "none"} dashes=${dashes} hscroll=${hscroll} consoleErrors=${errors.length}${errors.length ? " " + errors[0].slice(0, 100) : ""}`);
  }
  await ctx.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
