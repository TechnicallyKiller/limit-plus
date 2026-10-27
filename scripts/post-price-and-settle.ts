/**
 * Posts the Pyth update for a round's expiry timestamp (from Hermes) and calls `settle` in the same transaction bundle.
 * Usage: yarn ts-node scripts/post-price-and-settle.ts --round <ROUND_PUBKEY> [--rpc https://api.devnet.solana.com] [--keypair ~/.config/solana/id.json]
 * Equity feeds only update during US market hours, so the round's expiry must fall inside them.
 */
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { HermesClient } from "@pythnetwork/hermes-client";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import * as fs from "fs";
import * as os from "os";
import { LimitPlusClient, getProgram } from "../packages/sdk/src";

export function arg(name: string, def?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : def;
  if (v === undefined) throw new Error(`missing --${name}`);
  return v;
}

export function loadKeypair(p: string): Keypair {
  const file = p.replace(/^~/, os.homedir());
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(file, "utf8"))));
}

export async function postPriceAndSettle(connection: Connection, payer: Keypair, roundKey: PublicKey, hermesUrl = "https://hermes.pyth.network") {
  const wallet = new Wallet(payer);
  const program = getProgram(connection, wallet);
  const client = new LimitPlusClient(program);
  const round = await client.fetchRound(roundKey);
  const feedHex = "0x" + Buffer.from(round.pythFeedId).toString("hex");
  const expiry = Number(round.expiryTs.toString());

  const hermes = new HermesClient(hermesUrl);
  const updates = await hermes.getPriceUpdatesAtTimestamp(expiry, [feedHex], { encoding: "base64" });
  if (!updates.binary.data.length) throw new Error("Hermes returned no update for that timestamp (market closed?)");

  const receiver = new PythSolanaReceiver({ connection, wallet });
  const builder = receiver.newTransactionBuilder({ closeUpdateAccounts: true });
  await builder.addPostPriceUpdates(updates.binary.data);
  await builder.addPriceConsumerInstructions(async (getPriceUpdateAccount: (feed: string) => PublicKey) => {
    const priceAccount = getPriceUpdateAccount(feedHex);
    return [{ instruction: await client.settle(payer.publicKey, roundKey, round, priceAccount), signers: [] }];
  });
  const txs = await builder.buildVersionedTransactions({ computeUnitPriceMicroLamports: 50_000 });
  const sigs = await receiver.provider.sendAll(txs, { skipPreflight: true });
  return sigs;
}

if (require.main === module) {
  (async () => {
    const rpc = arg("rpc", "https://api.devnet.solana.com");
    const payer = loadKeypair(arg("keypair", "~/.config/solana/id.json"));
    const sigs = await postPriceAndSettle(new Connection(rpc, "confirmed"), payer, new PublicKey(arg("round")));
    console.log("» Settled. Transactions:", sigs.join(", "));
  })().catch((e) => { console.error(e); process.exit(1); });
}
