import { chromium } from "@playwright/test";
const base = "http://127.0.0.1:3000";
const pages = [["landing", "/"], ["pools", "/pools"], ["round", "/round/demo"], ["portfolio", "/portfolio"]];
const sizes = [["desktop", 1440, 900], ["mobile", 390, 844]];
const BANNED = /\b(put|call|strike|premium|option|collateral)s?\b/i;
const browser = await chromium.launch();
for (const [sn, w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  for (const [name, path] of pages) {
    await page.goto(base + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `../qa/${name}-${sn}.png`, fullPage: false });
    const text = await page.evaluate(() => document.body.innerText);
    const banned = text.match(BANNED);
    const dashes = /[–—]/.test(text);
    const rims = await page.evaluate(() => [...document.querySelectorAll(".rim")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.top < innerHeight && r.bottom > 0 && getComputedStyle(e).display !== "none"; }).length);
    const hscroll = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    console.log(`${sn} ${name}: banned=${banned ? banned[0] : "none"} dashes=${dashes} rimsInView=${rims} hscroll=${hscroll}`);
  }
  await ctx.close();
}
await browser.close();
