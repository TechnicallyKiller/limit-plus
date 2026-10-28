import { chromium } from "@playwright/test";
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage();
for (const path of ["/", "/pools", "/round/demo", "/portfolio"]) {
  await p.goto("http://127.0.0.1:3000" + path, { waitUntil: "networkidle" }); await p.waitForTimeout(800);
  const bad = await p.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(e).position !== "fixed").slice(0, 4).map((e) => `${e.tagName}.${String(e.className).slice(0, 50)} right=${Math.round(e.getBoundingClientRect().right)}`));
  console.log(path, bad);
}
await b.close();
