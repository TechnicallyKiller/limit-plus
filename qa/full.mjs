import { chromium } from "@playwright/test";
const [,, path, name, w, h] = process.argv;
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: +w, height: +h } })).newPage();
await p.goto("http://127.0.0.1:3000" + path, { waitUntil: "networkidle" }); await p.waitForTimeout(1500);
await p.screenshot({ path: `${name}.png`, fullPage: true }); await b.close();
