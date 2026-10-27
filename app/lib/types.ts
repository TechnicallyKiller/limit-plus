export type Side = "buyLower" | "sellHigher";
export type PhaseName =
  | "deposit" | "bidding" | "awaitingCutoff" | "reveal" | "awaitingClear" | "noSale"
  | "cleared" | "awaitingSettle" | "exercise" | "awaitingFinalize" | "finalized";

export interface BidView {
  bidder: string;
  commitTs: number;
  revealed: boolean;
  valid: boolean;
  pricePerContract?: number; // USD
  qty?: number;
  wonQty?: number;
}

export interface RoundView {
  key: string;
  collateralMint?: string;
  ticker: string;
  side: Side;
  phase: PhaseName;
  example: boolean;
  spot: number;                 // USD per share
  yourPrice: number;            // USD per share
  sharesPerContract: number;
  fairPerContract: number;      // USD
  reservePerContract: number;   // USD
  clearingPerContract?: number; // USD
  payNowTotal?: number;         // USD, exact after the auction
  totalContracts: number;
  soldContracts: number;
  waitingUsd: number;
  vol: number;
  years: number;
  rate: number;
  ts: { open: number; bidStart: number; candleStart: number; bidEnd: number; revealEnd: number; expiry: number; exerciseEnd: number };
  cutoffTs?: number;
  settlePrice?: number;         // USD per share
  inTheMoney?: boolean;
  bids: BidView[];
  spark: number[];              // last 30 daily closes
}

export interface PoolView {
  id: string;
  ticker: string;
  side: Side;
  waitingUsd: number;
  ratePct: number;       // weekly pay-now rate
  distancePct: number;   // your price vs spot
  roundKey?: string;
  example: boolean;
}

export interface TicketView {
  id: string;
  roundKey: string;
  ticker: string;
  side: Side;
  amountUsd: number;
  status: "Waiting" | "In auction" | "Paid" | "Settled" | "Claimed";
  paidNow: number;
  claimable: number;
  txs: string[];
  example: boolean;
}
