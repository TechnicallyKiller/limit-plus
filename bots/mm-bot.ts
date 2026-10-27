/**
 * Market-maker bot: commit a sealed bid, reveal it, exercise if it pays off, take the refund.
 * Usage: yarn ts-node bots/mm-bot.ts --name alpha --edge 0.10 --size 5 --round <ROUND_PUBKEY> [--rpc URL] [--keypair PATH]
 * The bidder wallet must already hold USDC (escrow) and, for exercising a buy-lower round, the stock token.
 */
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as fs from "fs";
import { LimitPlusClient, bidPda, computeCommitment, getProgram, newSalt, phaseOf } from "../packages/sdk/src";
import { arg, chainNow, errText, loadOrCreateKeypair, loadKeypair, say, debug, send, sleep } from "./common";

export interface BotOpts {
  connection: Connection;
  wallet: Keypair;
  name: string;
  edge: number;
  size: number;
  round: PublicKey;
  pollMs?: number;
  signal?: { stop: boolean };
  log?: (m: string) => void;
}

const usd = (base: number) => `$${(base / 1e6).toFixed(base < 1e6 ? 4 : 2)}`;

export async function runMmBot(o: BotOpts) {
  const { connection, wallet, round } = o;
  const log = o.log ?? say;
  const client = new LimitPlusClient(getProgram(connection));
  fs.mkdirSync(".bids", { recursive: true });
  const saltFile = `.bids/${round.toBase58()}-${o.name}.json`;
  const state = { committed: false, revealed: false, refunded: false, exercised: false };
  if (fs.existsSync(saltFile)) {
    const f = JSON.parse(fs.readFileSync(saltFile, "utf8"));
    Object.assign(state, { committed: true, ...f.progress });
  }

  while (!o.signal?.stop) {
    const r = await client.fetchRound(round);
    const now = await chainNow(connection);
    const phase = phaseOf(r, now);
    const save = (extra: any) => fs.writeFileSync(saltFile, JSON.stringify({ ...(fs.existsSync(saltFile) ? JSON.parse(fs.readFileSync(saltFile, "utf8")) : {}), ...extra, progress: { ...state } }));

    try {
      if (!state.committed && phase === "bidding") {
        // Our fair-price estimate was published with the round; we bid below it by `edge`.
        const fair = Number(r.fairPremiumPerContract.toString());
        const reserve = Number(r.reservePremiumPerContract.toString());
        const price = Math.max(Math.floor(fair * (1 - o.edge)), reserve);
        const escrow = price * o.size;
        const salt = newSalt();
        const c = computeCommitment(round, wallet.publicKey, price, o.size, salt);
        await send(connection, [await client.commitBid(wallet.publicKey, round, r, c, escrow)], [wallet]);
        state.committed = true;
        save({ price, qty: o.size, salt: Array.from(salt), escrow });
        log(`${o.name}: sealed bid placed. Nobody can see my price until bidding is over.`);
        debug(`${o.name}: fair ${usd(fair)} per contract, bidding ${usd(price)} (edge ${(o.edge * 100).toFixed(0)}%), ${o.size} contracts`);
      } else if (state.committed && !state.revealed && phase === "reveal") {
        const f = JSON.parse(fs.readFileSync(saltFile, "utf8"));
        await send(connection, [await client.revealBid(wallet.publicKey, round, f.price, f.qty, Uint8Array.from(f.salt))], [wallet]);
        state.revealed = true;
        save({});
        log(`${o.name}: bid revealed at ${usd(f.price)} per contract.`);
      } else if (state.committed && !state.refunded && ["cleared", "awaitingSettle", "exercise", "awaitingFinalize", "finalized", "noSale"].includes(phase)) {
        const bid = await client.fetchBid(round, wallet.publicKey);
        const won = Number(bid.wonQty.toString());
        log(won > 0 ? `${o.name}: won ${won} contracts at ${usd(Number(r.clearingPremiumPerContract.toString()))} each.` : `${o.name}: did not win this round.`);
        await send(connection, [await client.claimRefund(wallet.publicKey, round, r)], [wallet]);
        state.refunded = true;
        save({});
        log(`${o.name}: unused bid money returned.`);
      }
      if (state.committed && !state.exercised && phase === "exercise" && r.inTheMoney) {
        const bid = await client.fetchBid(round, wallet.publicKey);
        if (Number(bid.wonQty.toString()) > 0 && !bid.exercised) {
          await send(connection, [await client.exercise(wallet.publicKey, round, r)], [wallet]);
          log(`${o.name}: the price moved our way, so I took the stock at the agreed price.`);
        }
        state.exercised = true;
        save({});
      }
    } catch (e) {
      debug(`${o.name}: waiting (${errText(e).slice(0, 140)})`);
    }

    const done = state.refunded && (phase === "finalized" || phase === "noSale");
    if (done) break;
    await sleep(o.pollMs ?? 2000);
  }
  return state;
}

if (require.main === module) {
  (async () => {
    const connection = new Connection(arg("rpc", "http://127.0.0.1:8899"), "confirmed");
    const name = arg("name");
    const wallet = process.argv.includes("--keypair") ? loadKeypair(arg("keypair")) : loadOrCreateKeypair(`bot-${name}`);
    await runMmBot({ connection, wallet, name, edge: Number(arg("edge", "0.1")), size: Number(arg("size", "5")), round: new PublicKey(arg("round")) });
  })().catch((e) => { console.error(e); process.exit(1); });
}
