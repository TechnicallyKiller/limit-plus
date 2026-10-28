import { chromium } from "@playwright/test";
const base = "http://127.0.0.1:3000", out = "../video/public/ui";
const b = await chromium.launch();
const laptop = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
const phone = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const shots = [
  [laptop, "/pools", "l-pools"], [laptop, "/round/demo-deposit", "l-deposit"], [laptop, "/round/demo", "l-reveal"],
  [laptop, "/round/demo-cleared", "l-cleared"], [laptop, "/round/demo-settled", "l-settled"], [laptop, "/portfolio", "l-portfolio"],
  [phone, "/pools", "p-pools"], [phone, "/round/demo-deposit", "p-deposit"], [phone, "/round/demo-cleared", "p-cleared"], [phone, "/portfolio", "p-portfolio"],
];
for (const [ctx, path, name] of shots) {
  const p = await ctx.newPage();
  await p.goto(base + path, { waitUntil: "networkidle" }); await p.waitForTimeout(1800);
  await p.screenshot({ path: `${out}/${name}.png` }); await p.close();
}
// phone with the ticket sheet open
const p = await phone.newPage();
await p.goto(base + "/round/demo-deposit", { waitUntil: "networkidle" }); await p.waitForTimeout(1200);
await p.getByRole("button", { name: "Deposit" }).first().click(); await p.waitForTimeout(900);
await p.screenshot({ path: `${out}/p-sheet.png` });
await b.close(); console.log("captured");
