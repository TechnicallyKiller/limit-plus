/** Stocks the app lists. `x` tokens (NVDAx) map to the plain ticker for web research. */
export const COMPANIES: Record<string, string> = {
  NVDA: "NVIDIA", TSLA: "Tesla", AAPL: "Apple", MSFT: "Microsoft", AMZN: "Amazon",
  META: "Meta Platforms", COIN: "Coinbase", GOOGL: "Alphabet", AMD: "Advanced Micro Devices",
};

/** "NVDAx" or "nvda" to "NVDA". Returns undefined for anything the radar does not cover. */
export function normalizeTicker(raw: string): string | undefined {
  const t = raw.trim().toUpperCase().replace(/X$/, "");
  return COMPANIES[t] ? t : undefined;
}
