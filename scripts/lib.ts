import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  ExtensionType, MINT_SIZE, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMintInstruction, createInitializeScaledUiAmountConfigInstruction, createMintToInstruction,
  getAssociatedTokenAddressSync, getMintLen,
} from "@solana/spl-token";
import BN from "bn.js";
import { LimitPlusClient, CreateRoundArgs, roundPda } from "../packages/sdk/src";
import { fairPremiumPerContract, reservePremium, strikeFromSpot, volOrDefault } from "../packages/pricing/src";

export async function airdrop(c: Connection, to: PublicKey, sol: number) {
  const sig = await c.requestAirdrop(to, sol * LAMPORTS_PER_SOL);
  const bh = await c.getLatestBlockhash();
  await c.confirmTransaction({ signature: sig, ...bh }, "confirmed");
}

export async function createMint(c: Connection, payer: Keypair, decimals: number, kind: "classic" | "token2022-scaled"): Promise<PublicKey> {
  const mint = Keypair.generate();
  const t22 = kind === "token2022-scaled";
  const program = t22 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
  const len = t22 ? getMintLen([ExtensionType.ScaledUiAmountConfig]) : MINT_SIZE;
  const tx = new Transaction().add(
    SystemProgram.createAccount({ fromPubkey: payer.publicKey, newAccountPubkey: mint.publicKey, space: len, lamports: await c.getMinimumBalanceForRentExemption(len), programId: program }),
  );
  if (t22) tx.add(createInitializeScaledUiAmountConfigInstruction(mint.publicKey, payer.publicKey, 1.0, program));
  tx.add(createInitializeMintInstruction(mint.publicKey, decimals, payer.publicKey, null, program));
  await sendAndConfirmTransaction(c, tx, [payer, mint], { commitment: "confirmed" });
  return mint.publicKey;
}

/** Creates the owner's token account and mints `amount` base units into it (payer must be mint authority). */
export async function fund(c: Connection, payer: Keypair, mint: PublicKey, program: PublicKey, owner: PublicKey, amount: bigint) {
  const ata = getAssociatedTokenAddressSync(mint, owner, true, program);
  const tx = new Transaction().add(createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, ata, owner, mint, program));
  if (amount > 0n) tx.add(createMintToInstruction(mint, ata, payer.publicKey, amount, [], program));
  await sendAndConfirmTransaction(c, tx, [payer], { commitment: "confirmed" });
  return ata;
}

export interface NewRoundOpts {
  roundId: number;
  side: "buyLower" | "sellHigher";
  spot: number;                 // USD per share
  pct: number;                  // how far from spot the user's price sits (0.05 = 5%)
  vol?: number;
  feedId: Uint8Array;
  /** Seconds from `now` for each boundary. */
  timings: { depositSecs: number; bidSecs: number; candleSecs: number; revealSecs: number; expirySecs: number; exerciseSecs: number };
  now: number;
  sharesPerContract?: number;   // default 0.01
  underlyingDecimals?: number;  // default 8
  symbol?: string;
  /** Pricing horizon in years; compressed demos pass ~5/365 so premiums look like a real week. */
  yearsOverride?: number;
}

export interface NewRound { key: PublicKey; args: CreateRoundArgs; fairUsd: number; strikeUsd: number; vol: number; volSource: string }

/** Computes strike / fair / reserve from live inputs and builds the create_round args. */
export async function buildRound(o: NewRoundOpts): Promise<CreateRoundArgs & { _meta: { fairUsd: number; strikeUsd: number; vol: number; volSource: string } }> {
  const shares = o.sharesPerContract ?? 0.01;
  const dec = o.underlyingDecimals ?? 8;
  const strikePerShare = Math.round(strikeFromSpot(o.side, o.spot, o.pct) * 100) / 100;
  const strikePerContractUsdc = strikePerShare * shares;
  const { vol, source } = await volOrDefault(o.symbol ?? "Equity.US.NVDA/USD", o.vol);
  const t = o.timings;
  const years = (t.depositSecs + t.bidSecs + t.revealSecs + t.expirySecs) / (365 * 24 * 3600);
  const fv = fairPremiumPerContract({ side: o.side, sharesPerContract: shares, strikePerContractUsdc }, o.spot, vol, o.yearsOverride ?? Math.max(years, 1 / 365));
  const bidStart = o.now + t.depositSecs;
  const candle = bidStart + t.candleSecs;
  const bidEnd = bidStart + t.bidSecs;
  const revealEnd = bidEnd + t.revealSecs;
  const expiry = revealEnd + t.expirySecs;
  return {
    roundId: o.roundId, side: o.side, pythFeedId: o.feedId,
    contractSizeRaw: new BN(Math.round(shares * 10 ** dec)),
    sharesPerContractE9: new BN(Math.round(shares * 1e9)),
    strikePerContract: new BN(Math.round(strikePerContractUsdc * 1e6)),
    reservePremiumPerContract: new BN(Math.max(reservePremium(fv), 1)),
    fairPremiumPerContract: new BN(fv.perContractBase),
    openTs: o.now, bidStartTs: bidStart, candleStartTs: candle, bidEndTs: bidEnd, revealEndTs: revealEnd, expiryTs: expiry,
    exerciseWindowSecs: t.exerciseSecs, settleToleranceSecs: 300, settleGraceSecs: Math.max(t.exerciseSecs * 2, 120),
    _meta: { fairUsd: fv.perContractUsd, strikeUsd: strikePerContractUsdc, vol, volSource: source },
  };
}

export async function sendCreateRound(c: Connection, client: LimitPlusClient, admin: Keypair, underlying: PublicKey, quote: PublicKey, args: CreateRoundArgs) {
  const ix = await client.createRound(admin.publicKey, underlying, quote, args);
  await sendAndConfirmTransaction(c, new Transaction().add(ix), [admin], { commitment: "confirmed" });
  return roundPda(underlying, new BN(args.roundId as any));
}
