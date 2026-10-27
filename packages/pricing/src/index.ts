/** Black-Scholes pricing for the weekly pools. This is a model estimate: the UI must show every input. */

export interface PriceInputs {
  spot: number;      // USD per share
  strike: number;    // USD per share
  vol: number;       // annualized, e.g. 0.45
  years: number;     // time to expiry in years
  rate: number;      // annual risk-free rate, e.g. 0.04
}

export const DEFAULT_VOL = 0.5; // documented fallback when no price history is available
export const DEFAULT_RATE = 0.04;
export const SECONDS_PER_YEAR = 365 * 24 * 3600;

/** Abramowitz-Stegun 7.1.26 style normal CDF via erf with high-precision series (error < 1e-7). */
export function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

function d1d2({ spot, strike, vol, years, rate }: PriceInputs) {
  const sq = vol * Math.sqrt(years);
  const d1 = (Math.log(spot / strike) + (rate + (vol * vol) / 2) * years) / sq;
  return { d1, d2: d1 - sq };
}

export function callPrice(i: PriceInputs): number {
  if (i.years <= 0 || i.vol <= 0) return Math.max(i.spot - i.strike, 0);
  const { d1, d2 } = d1d2(i);
  return i.spot * normCdf(d1) - i.strike * Math.exp(-i.rate * i.years) * normCdf(d2);
}

export function putPrice(i: PriceInputs): number {
  if (i.years <= 0 || i.vol <= 0) return Math.max(i.strike - i.spot, 0);
  const { d1, d2 } = d1d2(i);
  return i.strike * Math.exp(-i.rate * i.years) * normCdf(-d2) - i.spot * normCdf(-d1);
}

/** Annualized volatility from daily closes (log returns, 252 trading days). */
export function realizedVol(dailyCloses: number[]): number {
  if (dailyCloses.length < 3) return DEFAULT_VOL;
  const r: number[] = [];
  for (let k = 1; k < dailyCloses.length; k++) r.push(Math.log(dailyCloses[k] / dailyCloses[k - 1]));
  const mean = r.reduce((a, b) => a + b, 0) / r.length;
  const variance = r.reduce((a, b) => a + (b - mean) ** 2, 0) / (r.length - 1);
  return Math.sqrt(variance * 252);
}

export interface ContractSpec {
  side: "buyLower" | "sellHigher";
  sharesPerContract: number;      // e.g. 0.01
  strikePerContractUsdc: number;  // USD, e.g. 1.80
  quoteDecimals?: number;         // default 6
}

export interface FairValue {
  perSharePremium: number;
  perContractUsd: number;
  perContractBase: number; // quote base units, floored
  strikePerShare: number;
}

/** Fair premium a bidder would pay per contract (buyLower = put, sellHigher = call). */
export function fairPremiumPerContract(c: ContractSpec, spot: number, vol: number, years: number, rate = DEFAULT_RATE): FairValue {
  const strikePerShare = c.strikePerContractUsdc / c.sharesPerContract;
  const inputs = { spot, strike: strikePerShare, vol, years, rate };
  const perSharePremium = c.side === "buyLower" ? putPrice(inputs) : callPrice(inputs);
  const perContractUsd = perSharePremium * c.sharesPerContract;
  const perContractBase = Math.floor(perContractUsd * 10 ** (c.quoteDecimals ?? 6));
  return { perSharePremium, perContractUsd, perContractBase, strikePerShare };
}

/** reservePremium = 0.5 x fair (SPEC §12). */
export const reservePremium = (fair: FairValue) => Math.floor(fair.perContractBase * 0.5);

/** Strike so that a buyLower order sits `pct` below spot (or a sellHigher order `pct` above). */
export function strikeFromSpot(side: "buyLower" | "sellHigher", spot: number, pct: number): number {
  return side === "buyLower" ? spot * (1 - pct) : spot * (1 + pct);
}

/** How a user's price compares to model fair value: positive = the user is paid more than fair. */
export function percentVsFair(paidPerContractBase: number, fairBase: number): number {
  return fairBase === 0 ? 0 : ((paidPerContractBase - fairBase) / fairBase) * 100;
}

/** Try Pyth Benchmarks for ~30 daily closes; callers fall back to DEFAULT_VOL (or a --vol flag) on failure. */
export async function fetchDailyCloses(symbol: string, days = 30, now = Math.floor(Date.now() / 1000)): Promise<number[]> {
  const from = now - days * 86400;
  const url = `https://benchmarks.pyth.network/v1/shims/tradingview/history?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${now}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`benchmarks ${res.status}`);
  const j: any = await res.json();
  if (j.s !== "ok" || !Array.isArray(j.c)) throw new Error("benchmarks: no data");
  return j.c as number[];
}

export async function volOrDefault(symbol: string, override?: number): Promise<{ vol: number; source: string }> {
  if (override !== undefined) return { vol: override, source: "flag" };
  try {
    const closes = await fetchDailyCloses(symbol);
    return { vol: realizedVol(closes), source: "pyth-benchmarks" };
  } catch {
    return { vol: DEFAULT_VOL, source: "default" };
  }
}
