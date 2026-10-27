import { expect } from "chai";
import { callPrice, putPrice, realizedVol, fairPremiumPerContract, reservePremium, normCdf, DEFAULT_VOL } from "../src";

describe("pricing", () => {
  const base = { spot: 100, strike: 100, vol: 0.2, years: 1, rate: 0.05 };
  it("matches textbook Black-Scholes values", () => {
    expect(callPrice(base)).to.be.closeTo(10.4506, 1e-3);
    expect(putPrice(base)).to.be.closeTo(5.5735, 1e-3);
  });
  it("put-call parity", () => {
    const lhs = callPrice(base) - putPrice(base);
    expect(lhs).to.be.closeTo(base.spot - base.strike * Math.exp(-base.rate * base.years), 1e-3);
  });
  it("normCdf sanity", () => {
    expect(normCdf(0)).to.be.closeTo(0.5, 1e-7);
    expect(normCdf(1.96)).to.be.closeTo(0.975, 1e-3);
  });
  it("expired options are intrinsic value", () => {
    expect(putPrice({ ...base, strike: 110, years: 0 })).to.equal(10);
    expect(callPrice({ ...base, strike: 110, years: 0 })).to.equal(0);
  });
  it("realized vol falls back without data and is positive with data", () => {
    expect(realizedVol([100])).to.equal(DEFAULT_VOL);
    expect(realizedVol([100, 102, 99, 101, 103, 98])).to.be.greaterThan(0);
  });
  it("fair premium per contract and reserve", () => {
    // NVDA at 180, buy-lower at 171 (5% below), 0.01 share contracts, 5 days, 50% vol
    const fv = fairPremiumPerContract({ side: "buyLower", sharesPerContract: 0.01, strikePerContractUsdc: 1.71 }, 180, 0.5, 5 / 365);
    expect(fv.strikePerShare).to.be.closeTo(171, 1e-9);
    expect(fv.perContractBase).to.be.greaterThan(0);
    expect(reservePremium(fv)).to.equal(Math.floor(fv.perContractBase / 2));
  });
});
