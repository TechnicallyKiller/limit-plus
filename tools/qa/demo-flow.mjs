// Plays a visitor through the whole demo in a real browser, recorded on video, and checks the result against the chain.
//   PW_CHROMIUM=/path/to/chrome node tools/qa/demo-flow.mjs <buy|skip> <outDir> [baseUrl] [rpcUrl]
// Needs the stack (scripts/local-stack.ts or the deployed worker) and the app built with NEXT_PUBLIC_DEMO=1.
import { chromium } from "@playwright/test";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import fs from "node:fs";

const outcome = process.argv[2];
const outDir = process.argv[3];
const base = process.argv[4] ?? "http://127.0.0.1:3100";
const rpc = process.argv[5] ?? "http://127.0.0.1:8899";
if (!["buy", "skip"].includes(outcome) || !outDir) { console.error("usage: node tools/qa/demo-flow.mjs <buy|skip> <outDir> [baseUrl] [rpcUrl]"); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });

const log = (m) => console.log(`${new Date().toISOString().slice(11, 19)} ${m}`);
const fail = (m) => { throw new Error(m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (what, fn, ms = 240_000) => {
  const t0 = Date.now();
  for (;;) { try { const v = await fn(); if (v) return v; } catch { /* keep trying */ } if (Date.now() - t0 > ms) fail(`timed out waiting for: ${what}`); await sleep(500); }
};

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: outDir, size: { width: 1280, height: 800 } } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text()); });
let shot = 0;
const snap = async (name) => page.screenshot({ path: `${outDir}/${String(++shot).padStart(2, "0")}-${name}.png` });
const has = async (text, opts = {}) => (await page.getByText(text, opts).count()) > 0;

try {
  // 1. connect the demo wallet
  await page.goto(`${base}/demo`, { waitUntil: "domcontentloaded" });
  await snap("demo-page");
  await page.getByRole("button", { name: "Use the demo wallet" }).click();
  await until("wallet connected", () => has("Connected as"));
  const secret = await page.evaluate(() => JSON.parse(localStorage.getItem("limitplus-demo-wallet")));
  const owner = Keypair.fromSecretKey(Uint8Array.from(secret)).publicKey;
  log(`connected the demo wallet ${owner.toBase58().slice(0, 4)}...`);

  // 2. test funds
  await page.getByRole("button", { name: "Get 1,000 test USDC" }).click();
  await until("test funds", () => has("You have 1,000 test USDC"));
  log("got test funds");
  await snap("funds");

  // chain access for the final checks
  const c = new Connection(rpc, "confirmed");
  const state0 = await (await fetch(`${base}/api/demo`)).json();
  if (state0.status === "running") fail("a demo week is already running on this stack; wait for it to finish");

  // 3. start the week
  if (outcome === "skip") await page.getByRole("tab", { name: "Stock rises, money back" }).click();
  await page.getByRole("button", { name: "Start a demo week" }).click();
  await until("week started and deposits open", () => has("Deposits close in"));
  log(`week started (${outcome})`);
  await snap("week-started");

  // 4. deposit on the round page
  await page.getByRole("link", { name: "Open the round and deposit" }).click();
  await page.waitForURL(/\/round\//);
  const roundKey = new URL(page.url()).pathname.split("/").pop();
  const ticket = page.locator("aside").first();
  await until("deposit button ready", async () => (await ticket.getByRole("button", { name: /^Deposit$/ }).count()) > 0 && !(await ticket.getByRole("button", { name: /^Deposit$/ }).isDisabled()));
  await snap("round-deposit-open");
  await ticket.getByRole("button", { name: /^Deposit$/ }).click();
  await until("deposit confirmed", () => ticket.getByText("View the deposit on the explorer").count());
  log("deposited through the UI");
  await snap("deposited");

  // helpers to read balances straight from the chain
  const bal = async (mint, prog) => { try { return Number((await c.getTokenAccountBalance(getAssociatedTokenAddressSync(new PublicKey(mint), owner, true, prog))).value.uiAmount ?? 0); } catch { return 0; } };
  const mints = JSON.parse(fs.readFileSync("/tmp/limitplus-local.json", "utf8"));
  const usdc = () => bal(mints.quoteMint, TOKEN_PROGRAM_ID);
  const nvda = () => bal(mints.underlyingMint, TOKEN_2022_PROGRAM_ID);
  const afterDeposit = { usdc: await usdc(), nvda: await nvda() };
  if (!(afterDeposit.usdc < 500)) fail(`the deposit should have moved most of the 1000 USDC out, wallet has ${afterDeposit.usdc}`);

  // 5. watch the auction
  await until("bidding", () => has("Bidding", { exact: true }), 120_000).catch(() => undefined);
  await snap("auction-bidding");
  await until("auction cleared", () => has("Waiting for Friday", { exact: true }));
  log("auction cleared");
  await snap("auction-cleared");

  // 6. claim the payment right away, from the portfolio
  await page.goto(`${base}/portfolio`, { waitUntil: "domcontentloaded" });
  const claim = page.getByRole("button", { name: "Claim", exact: true }).first();
  await until("claim button", () => claim.count());
  await snap("portfolio-paid");
  const before = await usdc();
  await claim.click();
  await until("paid now arrived", async () => (await usdc()) > before + 0.01);
  const paidNow = (await usdc()) - before;
  log(`claimed the up-front payment through the UI: +$${paidNow.toFixed(4)}`);
  await snap("portfolio-claimed-premium");

  // 7. wait for Friday's close and the end of the week
  await page.goto(`${base}/round/${roundKey}`, { waitUntil: "domcontentloaded" });
  await until("round final", () => has("Final", { exact: true }));
  log("round final");
  await snap("round-final");

  // 8. final claim
  await page.goto(`${base}/portfolio`, { waitUntil: "domcontentloaded" });
  const claim2 = page.getByRole("button", { name: "Claim", exact: true }).first();
  await until("final claim button", () => claim2.count());
  await snap("portfolio-settled");
  await claim2.click();
  await until("final claim landed", async () => outcome === "buy" ? (await nvda()) > 0 : (await usdc()) > 990);
  await until("ticket marked claimed", () => page.getByText("Claimed", { exact: true }).count());
  const end = { usdc: await usdc(), nvda: await nvda() };
  await snap("portfolio-claimed");

  // 9. verify against the chain, not against what the page says
  if (outcome === "buy") {
    if (!(end.nvda > 1)) fail(`buy: expected the stock token in the wallet, got ${end.nvda}`);
    if (!(end.usdc < 100)) fail(`buy: expected the dollars to have gone into the stock, USDC is ${end.usdc}`);
  } else {
    if (end.nvda !== 0) fail(`skip: no stock should change hands, got ${end.nvda}`);
    if (!(end.usdc > 1000 && end.usdc < 1010)) fail(`skip: expected 1000 plus a small premium, got ${end.usdc}`);
  }
  if (errors.length) fail(`the browser logged errors: ${errors.slice(0, 3).join(" | ")}`);
  console.log(`\nDEMO_FLOW_OK ${outcome}: USDC 1000 -> ${end.usdc.toFixed(2)}, NVDAx 0 -> ${end.nvda.toFixed(4)}, paid up front $${paidNow.toFixed(4)}`);
} catch (e) {
  await snap("FAILED").catch(() => undefined);
  console.error(`\nDEMO_FLOW_FAILED ${e.message}`);
  process.exitCode = 1;
} finally {
  const video = page.video();
  await ctx.close();
  try { await video.saveAs(`${outDir}/${outcome}-run.webm`); } catch { /* no video */ }
  await browser.close();
}
