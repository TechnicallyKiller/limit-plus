/**
 * Permissionless crank loop. Safe to run several copies: every step re-reads the round first and treats
 * "someone else already did it" as a no-op.
 * Usage: yarn ts-node bots/keeper.ts --round <ROUND_PUBKEY> [--rpc URL] [--keypair PATH] [--oracle mock|pyth]
 */
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { LimitPlusClient, getProgram, mockPricePda, phaseOf, Phase } from "../packages/sdk/src";
import { arg, chainNow, errText, loadKeypair, retry, say, send, sleep } from "./common";

export interface KeeperOpts {
  connection: Connection;
  payer: Keypair;
  round: PublicKey;
  oracle: "mock" | "pyth";
  pollMs?: number;
  signal?: { stop: boolean };
  log?: (m: string) => void;
}

export interface KeeperStats { done: string[]; noops: string[] }

export async function runKeeper(o: KeeperOpts): Promise<KeeperStats> {
  const { connection, payer, round } = o;
  const log = o.log ?? say;
  const client = new LimitPlusClient(getProgram(connection));
  const stats: KeeperStats = { done: [], noops: [] };

  const step = async (name: string, phaseBefore: Phase, build: () => Promise<void>) => {
    try {
      await retry(build, 2, 400);
      stats.done.push(name);
    } catch (e) {
      // Another keeper may have moved the round on: that is fine.
      const r = await client.fetchRound(round);
      const after = phaseOf(r, await chainNow(connection));
      if (after !== phaseBefore) { stats.noops.push(name); log(`${name}: already done by someone else`); }
      else log(`${name}: not ready yet (${errText(e).slice(0, 120)})`);
    }
  };

  while (!o.signal?.stop) {
    const r = await client.fetchRound(round);
    const now = await chainNow(connection);
    const phase = phaseOf(r, now);
    if (phase === "finalized" || phase === "noSale") { log(phase === "noSale" ? "Round ended with no sale. Everyone can take their money back." : "Round is final. Payouts are open."); break; }

    if (phase === "awaitingCutoff") {
      await step("close-bidding", phase, async () => {
        await send(connection, [await client.resolveCutoff(payer.publicKey, round)], [payer]);
        log("Bidding closed at a random moment.");
      });
    } else if (phase === "awaitingClear") {
      await step("pick-winners", phase, async () => {
        const bids = await client.fetchBidsForRound(round);
        await send(connection, [await client.clearAuction(payer.publicKey, round, r, bids.map((b) => b.publicKey))], [payer]);
        log("Winners picked. Premiums are ready to claim.");
      });
    } else if (phase === "awaitingSettle") {
      await step("settle", phase, async () => {
        if (o.oracle === "pyth") {
          const { postPriceAndSettle } = await import("../scripts/post-price-and-settle");
          await postPriceAndSettle(connection, payer, round);
        } else {
          await send(connection, [await client.settle(payer.publicKey, round, r, mockPricePda(Uint8Array.from(r.pythFeedId)))], [payer]);
        }
        log("Friday close price recorded.");
      });
    } else if (phase === "awaitingFinalize") {
      await step("finalize", phase, async () => {
        await send(connection, [await client.finalize(payer.publicKey, round)], [payer]);
        log("Round finalized.");
      });
    }
    await sleep(o.pollMs ?? 2000);
  }
  return stats;
}

if (require.main === module) {
  (async () => {
    const connection = new Connection(arg("rpc", "http://127.0.0.1:8899"), "confirmed");
    const payer = loadKeypair(arg("keypair", "~/.config/solana/id.json"));
    await runKeeper({ connection, payer, round: new PublicKey(arg("round")), oracle: arg("oracle", "pyth") as any });
  })().catch((e) => { console.error(e); process.exit(1); });
}
