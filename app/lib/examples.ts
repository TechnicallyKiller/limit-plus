import type { PoolView, RoundView, TicketView } from "./types";

/** Example data, clearly marked in the UI. Used when no RPC or no live rounds are available. */
export const EXAMPLE_POOLS: PoolView[] = [
  { id: "nvda-b", ticker: "NVDAx", side: "buyLower", waitingUsd: 641200, ratePct: 0.62, distancePct: -5.0, roundKey: "demo", example: true },
  { id: "tsla-s", ticker: "TSLAx", side: "sellHigher", waitingUsd: 418750, ratePct: 0.48, distancePct: 6.0, example: true },
  { id: "aapl-b", ticker: "AAPLx", side: "buyLower", waitingUsd: 352400, ratePct: 0.31, distancePct: -4.0, example: true },
  { id: "msft-s", ticker: "MSFTx", side: "sellHigher", waitingUsd: 287900, ratePct: 0.27, distancePct: 4.5, example: true },
  { id: "amzn-b", ticker: "AMZNx", side: "buyLower", waitingUsd: 214300, ratePct: 0.36, distancePct: -5.5, example: true },
  { id: "meta-b", ticker: "METAx", side: "buyLower", waitingUsd: 168050, ratePct: 0.41, distancePct: -6.0, example: true },
  { id: "coin-s", ticker: "COINx", side: "sellHigher", waitingUsd: 119800, ratePct: 0.77, distancePct: 8.0, example: true },
  { id: "googl-b", ticker: "GOOGLx", side: "buyLower", waitingUsd: 96480, ratePct: 0.29, distancePct: -4.5, example: true },
  { id: "amd-s", ticker: "AMDx", side: "sellHigher", waitingUsd: 61220, ratePct: 0.52, distancePct: 7.0, example: true },
];

const now = () => Math.floor(Date.now() / 1000);

export function exampleRound(phase: RoundView["phase"] = "reveal"): RoundView {
  const t = now();
  const expiry = t + 2 * 86400 + 4 * 3600 + 731;
  const bidEnd = t - 5400;
  const spark = [172.4, 174.1, 173.0, 175.8, 177.2, 176.5, 178.9, 180.3, 179.1, 181.6, 183.0, 182.1, 184.4, 185.9, 184.2, 183.1, 181.7, 182.9, 180.6, 179.8, 178.2, 179.9, 181.2, 180.4, 182.2, 181.1, 180.0, 179.4, 180.7, 180.0];
  const bids = [
    { bidder: "9xQe7vL2mTq1BfXc3dRkZp4HnYw8sAu6JtVb", commitTs: bidEnd - 3100, revealed: true, valid: true, pricePerContract: 0.0106, qty: 120 },
    { bidder: "Dk3sPw8NqLm2VcXz5TgHy7RaJu4BfEe9Wn1A", commitTs: bidEnd - 2600, revealed: true, valid: true, pricePerContract: 0.0099, qty: 200 },
    { bidder: "5HtYb2VqKcNm8LxZr3PdWe7JgUa4FsTn6QoC", commitTs: bidEnd - 1900, revealed: true, valid: true, pricePerContract: 0.0094, qty: 150 },
    { bidder: "Bm7LqRz4XcVn2KtPw9HdYe5JgUa8FsTo3NxA", commitTs: bidEnd - 700, revealed: true, valid: true, pricePerContract: 0.0082, qty: 180 },
    { bidder: "Fn4TqWz8XcVm2LtPr7HdYe3JgUa6BsKo9NxC", commitTs: bidEnd + 40, revealed: true, valid: false, pricePerContract: 0.0118, qty: 90 },
    { bidder: "Hc6VqPz2XnLm8KtWr4BdYe9JgUa3FsTo7NxD", commitTs: bidEnd - 300, revealed: false, valid: false },
  ];
  const cleared = ["cleared", "awaitingSettle", "exercise", "awaitingFinalize", "finalized"].includes(phase);
  return {
    key: "demo", ticker: "NVDAx", side: "buyLower", phase, example: true,
    spot: 180.0, yourPrice: 171.0, sharesPerContract: 0.01, fairPerContract: 0.0106, reservePerContract: 0.0053,
    clearingPerContract: cleared ? 0.0082 : undefined, payNowTotal: cleared ? 2.81 : undefined,
    totalContracts: 380, soldContracts: cleared ? 380 : 0, waitingUsd: 380 * 1.71,
    vol: 0.46, years: 5 / 365, rate: 0.04,
    ts: { open: t - 3 * 86400, bidStart: t - 2 * 86400, candleStart: bidEnd - 3600, bidEnd, revealEnd: t + 1800, expiry, exerciseEnd: expiry + 3600 },
    cutoffTs: bidEnd - 1260,
    bids: bids.map((b) => ({ ...b, wonQty: cleared && b.valid && b.revealed ? b.qty : undefined })),
    spark,
  };
}

export const EXAMPLE_TICKETS: TicketView[] = [
  { id: "t1", roundKey: "demo", ticker: "NVDAx", side: "buyLower", amountUsd: 1000, status: "Paid", paidNow: 6.2, claimable: 0, txs: [], example: true },
  { id: "t2", roundKey: "demo", ticker: "TSLAx", side: "sellHigher", amountUsd: 500, status: "Settled", paidNow: 2.4, claimable: 500, txs: [], example: true },
  { id: "t3", roundKey: "demo", ticker: "AAPLx", side: "buyLower", amountUsd: 250, status: "Claimed", paidNow: 0.78, claimable: 0, txs: [], example: true },
];
