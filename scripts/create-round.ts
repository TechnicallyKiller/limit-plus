/**
 * Creates a round with strike from live spot and pricing-engine fair/reserve values.
 * Usage: yarn ts-node scripts/create-round.ts --underlying <MINT> --quote <MINT> --side buyLower --spot 180 --pct 0.05 --id 1
 *   [--vol 0.5] [--rpc URL] [--keypair PATH] [--compress]   (--compress = ~2 minute demo timings)
 */
import { Connection, PublicKey } from "@solana/web3.js";
import { LimitPlusClient, getProgram } from "../packages/sdk/src";
import { arg, loadKeypair, say, chainNow } from "../bots/common";
import { buildRound, sendCreateRound } from "./lib";
import { HermesClient } from "@pythnetwork/hermes-client";

export const NVDA_FEED = "b1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593";

async function liveSpot(): Promise<number> {
  const h = new HermesClient("https://hermes.pyth.network");
  const r = await h.getLatestPriceUpdates(["0x" + NVDA_FEED], { parsed: true });
  const p = r.parsed![0].price;
  return Number(p.price) * 10 ** p.expo;
}

(async () => {
  const connection = new Connection(arg("rpc", "http://127.0.0.1:8899"), "confirmed");
  const admin = loadKeypair(arg("keypair", "~/.config/solana/id.json"));
  const client = new LimitPlusClient(getProgram(connection));
  const side = arg("side", "buyLower") as "buyLower" | "sellHigher";
  const spot = process.argv.includes("--spot") ? Number(arg("spot")) : await liveSpot();
  const compress = process.argv.includes("--compress");
  const timings = compress
    ? { depositSecs: 20, bidSecs: 40, candleSecs: 10, revealSecs: 20, expirySecs: 20, exerciseSecs: 30 }
    : { depositSecs: 3 * 86400, bidSecs: 86400, candleSecs: 3600, revealSecs: 3600, expirySecs: 4 * 86400, exerciseSecs: 3600 };
  const built = await buildRound({
    roundId: Number(arg("id", "1")), side, spot, pct: Number(arg("pct", "0.05")),
    vol: process.argv.includes("--vol") ? Number(arg("vol")) : undefined,
    feedId: Uint8Array.from(Buffer.from(NVDA_FEED, "hex")), timings, now: await chainNow(connection),
  });
  const { _meta, ...args } = built;
  const key = await sendCreateRound(connection, client, admin, new PublicKey(arg("underlying")), new PublicKey(arg("quote")), args);
  say(`Round created: ${key.toBase58()}`);
  console.log(`  spot $${spot.toFixed(2)}, your price per share $${(_meta.strikeUsd / 0.01).toFixed(2)}, fair pay-now per contract $${_meta.fairUsd.toFixed(4)} (vol ${(_meta.vol * 100).toFixed(0)}% from ${_meta.volSource})`);
})().catch((e) => { console.error(e); process.exit(1); });
