import { chromium } from "@playwright/test";
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" }); await p.waitForTimeout(3500);
await p.screenshot({ path: "landing-settled.png" });
// focus ring check: tab through the page and confirm a 2px flame outline on the focused element
await p.keyboard.press("Tab"); await p.keyboard.press("Tab");
const o = await p.evaluate(() => { const e = document.activeElement; const c = getComputedStyle(e); return `${e.tagName} outline=${c.outlineWidth} ${c.outlineStyle} ${c.outlineColor} offset=${c.outlineOffset}`; });
console.log(o); await b.close();
