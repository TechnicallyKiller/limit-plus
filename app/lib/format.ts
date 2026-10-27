export const usd = (n: number, digits = 2) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });
export const usdWhole = (n: number) => usd(n, 0);
export const pct = (n: number, digits = 2) => `${n.toFixed(digits)}%`;
export const signedPct = (n: number, digits = 1) => `${n > 0 ? "+" : n < 0 ? "-" : ""}${Math.abs(n).toFixed(digits)}%`;
export const shortKey = (k: string) => `${k.slice(0, 4)}...${k.slice(-4)}`;
export const clock = (ts: number) => new Date(ts * 1000).toISOString().slice(11, 19);

export function countdown(secs: number) {
  const s = Math.max(0, Math.floor(secs));
  const d = Math.floor(s / 86400);
  const h = String(Math.floor((s % 86400) / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return d > 0 ? `${d}d ${h}:${m}:${ss}` : `${h}:${m}:${ss}`;
}

export const explorerTx = (sig: string, cluster = process.env.NEXT_PUBLIC_CLUSTER ?? "devnet") =>
  `https://explorer.solana.com/tx/${sig}${cluster === "mainnet-beta" ? "" : `?cluster=${cluster}`}`;
export const explorerAddr = (a: string, cluster = process.env.NEXT_PUBLIC_CLUSTER ?? "devnet") =>
  `https://explorer.solana.com/address/${a}${cluster === "mainnet-beta" ? "" : `?cluster=${cluster}`}`;
