"use client";
import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { LimitPlusClient, getProgram, phaseOf } from "@limit-plus/sdk";
import { fairPremiumPerContract } from "@limit-plus/pricing";
import { connection, hasChain } from "./chain";
import { EXAMPLE_POOLS, EXAMPLE_TICKETS, exampleRound } from "./examples";
import type { BidView, PoolView, RoundView, TicketView } from "./types";

const n = (x: any) => Number(x.toString());
const TICKERS: Record<string, string> = (() => {
  try { return JSON.parse(process.env.NEXT_PUBLIC_TICKERS ?? "{}"); } catch { return {}; }
})();
const tickerOf = (mint: string) => TICKERS[mint] ?? "NVDAx";
const client = () => new LimitPlusClient(getProgram(connection()));

async function spotFor(feedId: Uint8Array, fallback: number): Promise<number> {
  try {
    const hex = Buffer.from(feedId).toString("hex");
    const res = await fetch(`https://hermes.pyth.network/v2/updates/price/latest?ids[]=0x${hex}&parsed=true`);
    const j = await res.json();
    const p = j.parsed[0].price;
    return Number(p.price) * 10 ** p.expo;
  } catch { return fallback; }
}

export async function loadPools(): Promise<PoolView[]> {
  if (!hasChain) return EXAMPLE_POOLS;
  const rounds = await client().fetchAllRounds();
  if (!rounds.length) return EXAMPLE_POOLS;
  return rounds.map(({ publicKey, account: r }) => {
    const buy = "buyLower" in r.side;
    const strike = n(r.strikePerContract) / 1e6;
    const waitingUsd = buy ? (n(r.totalContracts) * strike) : n(r.totalContracts) * strike;
    const rate = strike > 0 ? ((n(r.fairPremiumPerContract) / 1e6) / strike) * 100 : 0;
    return { id: publicKey.toBase58(), ticker: tickerOf(r.underlyingMint.toBase58()), side: buy ? "buyLower" : "sellHigher",
      waitingUsd, ratePct: rate, distancePct: buy ? -5 : 5, roundKey: publicKey.toBase58(), example: false } as PoolView;
  });
}

export async function loadRound(key: string): Promise<RoundView> {
  if (!hasChain || key.startsWith("demo")) return exampleRound(({ demo: "reveal", "demo-deposit": "deposit", "demo-cleared": "cleared", "demo-settled": "awaitingFinalize" } as Record<string, any>)[key] ?? "reveal");
  const c = client();
  const pk = new PublicKey(key);
  const r = await c.fetchRound(pk);
  const now = Math.floor(Date.now() / 1000);
  const buy = "buyLower" in r.side;
  const shares = n(r.sharesPerContractE9) / 1e9;
  const strikeContract = n(r.strikePerContract) / 1e6;
  const yourPrice = strikeContract / shares;
  const spot = await spotFor(Uint8Array.from(r.pythFeedId), yourPrice * (buy ? 1.05 : 0.95));
  const bidAccounts = await c.fetchBidsForRound(pk);
  const bids: BidView[] = bidAccounts.map(({ account: b }) => ({
    bidder: b.bidder.toBase58(), commitTs: n(b.commitTs), revealed: b.revealed, valid: b.valid,
    pricePerContract: b.revealed ? n(b.pricePerContract) / 1e6 : undefined, qty: b.revealed ? n(b.qty) : undefined,
    wonQty: n(b.wonQty) > 0 ? n(b.wonQty) : undefined,
  }));
  const cleared = n(r.clearingPremiumPerContract) > 0;
  const vol = 0.5, years = Math.max((n(r.expiryTs) - now) / (365 * 24 * 3600), 1 / 365);
  const fair = n(r.fairPremiumPerContract) / 1e6 || fairPremiumPerContract({ side: buy ? "buyLower" : "sellHigher", sharesPerContract: shares, strikePerContractUsdc: strikeContract }, spot, vol, years).perContractUsd;
  return {
    key, collateralMint: (buy ? r.quoteMint : r.underlyingMint).toBase58(), ticker: tickerOf(r.underlyingMint.toBase58()), side: buy ? "buyLower" : "sellHigher", phase: phaseOf(r, now), example: false,
    spot, yourPrice, sharesPerContract: shares, fairPerContract: fair, reservePerContract: n(r.reservePremiumPerContract) / 1e6,
    clearingPerContract: cleared ? n(r.clearingPremiumPerContract) / 1e6 : undefined,
    payNowTotal: cleared ? n(r.premiumToUsers) / 1e6 : undefined,
    totalContracts: n(r.totalContracts), soldContracts: n(r.soldContracts), waitingUsd: n(r.totalContracts) * strikeContract,
    vol, years, rate: 0.04,
    ts: { open: n(r.openTs), bidStart: n(r.bidStartTs), candleStart: n(r.candleStartTs), bidEnd: n(r.bidEndTs), revealEnd: n(r.revealEndTs), expiry: n(r.expiryTs), exerciseEnd: n(r.expiryTs) + n(r.exerciseWindowSecs) },
    cutoffTs: r.cutoffResolved ? n(r.cutoffTs) : undefined,
    settlePrice: r.settled ? n(r.settlePricePerContract) / 1e6 / shares : undefined,
    inTheMoney: r.settled ? r.inTheMoney : undefined,
    bids, spark: [],
  };
}

export async function loadTickets(owner: PublicKey): Promise<TicketView[]> {
  if (!hasChain) return EXAMPLE_TICKETS;
  const c = client();
  const rounds = await c.fetchAllRounds();
  const out: TicketView[] = [];
  for (const { publicKey, account: r } of rounds) {
    try {
      const pos = await c.fetchPosition(publicKey, owner);
      const buy = "buyLower" in r.side;
      const phase = phaseOf(r, Math.floor(Date.now() / 1000));
      const share = n(pos.contracts) / Math.max(n(r.totalContracts), 1);
      const paidNow = (n(r.premiumToUsers) / 1e6) * share;
      const status = pos.claimed ? "Claimed" : phase === "finalized" || phase === "noSale" ? "Settled" : n(r.clearingPremiumPerContract) > 0 ? "Paid" : ["bidding", "awaitingCutoff", "reveal", "awaitingClear"].includes(phase) ? "In auction" : "Waiting";
      out.push({ id: publicKey.toBase58(), roundKey: publicKey.toBase58(), ticker: tickerOf(r.underlyingMint.toBase58()), side: buy ? "buyLower" : "sellHigher",
        amountUsd: n(pos.contracts) * (n(r.strikePerContract) / 1e6), status: status as TicketView["status"], paidNow,
        claimable: status === "Settled" ? (n(r.finalQuote) / 1e6) * share : 0, txs: [], example: false });
    } catch { /* no position in this round */ }
  }
  return out.length ? out : [];
}

/** Polls `fn` every `ms` and keeps the last good value. */
export function usePolled<T>(fn: () => Promise<T>, initial: T, ms = 2000, deps: unknown[] = []): { data: T; error: string | null } {
  const [data, setData] = useState<T>(initial);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    const tick = async () => {
      try { const v = await fn(); if (live) { setData(v); setError(null); } }
      catch (e: any) { if (live) setError(String(e?.message ?? e)); }
    };
    tick();
    const id = setInterval(tick, ms);
    return () => { live = false; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, error };
}
