import { expect } from "chai";
import { Keypair, PublicKey } from "@solana/web3.js";
import { T, T0, STRIKE, CONTRACT, PRICE, World } from "./harness";
import { bidPda, positionPda, vaultPda } from "../packages/sdk/src";

export const RANK: Record<string, number> = { deposit: 0, bidding: 1, reveal: 2, cleared: 3, noSale: 3, settled: 4, finalized: 5 };
const big = (x: any) => BigInt(x.toString());
const st = (r: any) => Object.keys(r.state)[0];
export const proRata = (amount: bigint, part: bigint, total: bigint) => (total === 0n ? 0n : (amount * part) / total);

export interface BidSpec { price: number; qty: number; escrow?: number; salt?: Uint8Array; commitAt?: number }

/** One round walked through its lifecycle, with SPEC §11 invariants checkable after every step. */
export class Flow {
  users: Keypair[] = [];
  bidders: Keypair[] = [];
  specs = new Map<string, BidSpec & { escrow: number }>();
  lastRank = 0;
  cranker: Keypair;

  constructor(public w: World, public key: PublicKey) { this.cranker = w.user(); }

  /** Both token accounts must exist before any payout. */
  atas(k: Keypair) {
    this.w.mintTo(this.w.quoteMint, k.publicKey, 0);
    this.w.mintTo(this.w.underlyingMint, k.publicKey, 0);
  }

  async round() { return this.w.round(this.key); }

  async deposits(contracts: number[]) {
    for (const c of contracts) {
      const u = this.w.user();
      this.users.push(u);
      this.atas(u);
      this.w.ok([await this.w.deposit(u, this.key, c)], [u]);
    }
    await this.inv();
  }

  async bids(specs: BidSpec[]) {
    for (const s of specs) {
      const b = this.w.user();
      this.bidders.push(b);
      this.atas(b);
      const escrow = s.escrow ?? s.price * s.qty;
      const { ix, salt } = await this.w.commit(b, this.key, s.price, s.qty, escrow, s.salt as Uint8Array);
      this.specs.set(b.publicKey.toBase58(), { ...s, escrow, salt });
      if (s.commitAt) this.w.warp(s.commitAt);
      this.w.ok([ix], [b]);
    }
    await this.inv();
  }

  warpBidding() { this.w.warp(T0 + 150); }

  async resolve() {
    this.w.warp(T.bidEnd);
    this.w.ok([await this.w.client.resolveCutoff(this.cranker.publicKey, this.key)], [this.cranker]);
    await this.inv();
  }

  async reveal(which?: number[]) {
    for (let i = 0; i < this.bidders.length; i++) {
      if (which && !which.includes(i)) continue;
      const b = this.bidders[i];
      const s = this.specs.get(b.publicKey.toBase58())!;
      this.w.ok([await this.w.client.revealBid(b.publicKey, this.key, s.price, s.qty, s.salt!)], [b]);
    }
    await this.inv();
  }

  bidKeys() { return this.bidders.map((b) => bidPda(this.key, b.publicKey)); }

  async clear(keys = this.bidKeys()) {
    this.w.warp(T.revealEnd);
    const r = await this.round();
    this.w.ok([await this.w.client.clearAuction(this.cranker.publicKey, this.key, r, keys)], [this.cranker]);
    await this.inv();
  }

  async claimPremiums() {
    for (const u of this.users) {
      const r = await this.round();
      this.w.ok([await this.w.client.claimPremium(u.publicKey, this.key, r)], [u]);
    }
    await this.inv();
  }

  async settle(price: number, publishTime = T.expiry, conf = 1000) {
    this.w.warp(T.expiry);
    const r = await this.round();
    this.w.ok([await this.w.setPrice(price, publishTime, conf)], [this.w.admin]);
    this.w.ok([await this.w.client.settle(this.cranker.publicKey, this.key, r, (await import("../packages/sdk/src")).mockPricePda(new Uint8Array(32).fill(0xab)))], [this.cranker]);
    await this.inv();
  }

  async exercise(i: number) {
    const b = this.bidders[i];
    const r = await this.round();
    const bid = this.w.decode("bid", bidPda(this.key, b.publicKey));
    const buy = "buyLower" in r.side;
    if (buy) this.w.mintTo(this.w.underlyingMint, b.publicKey, big(bid.wonQty) * big(r.contractSizeRaw));
    else this.w.mintTo(this.w.quoteMint, b.publicKey, big(bid.wonQty) * big(r.strikePerContract));
    this.w.mintTo(this.w.quoteMint, b.publicKey, 0);
    this.w.mintTo(this.w.underlyingMint, b.publicKey, 0);
    this.w.ok([await this.w.client.exercise(b.publicKey, this.key, r)], [b]);
    await this.inv();
  }

  async finalize(at?: number) {
    if (at) this.w.warp(at);
    this.w.ok([await this.w.client.finalize(this.cranker.publicKey, this.key)], [this.cranker]);
    await this.inv();
  }

  async claims() {
    for (const u of this.users) {
      const r = await this.round();
      this.w.mintTo(this.w.quoteMint, u.publicKey, 0);
      this.w.mintTo(this.w.underlyingMint, u.publicKey, 0);
      this.w.ok([await this.w.client.claim(u.publicKey, this.key, r)], [u]);
    }
    await this.inv();
  }

  async refunds() {
    for (const b of this.bidders) {
      const r = await this.round();
      this.w.ok([await this.w.client.claimRefund(b.publicKey, this.key, r)], [b]);
    }
    await this.inv();
  }

  /** SPEC §11 */
  async inv() {
    const w = this.w;
    const r = await this.round();
    const s = st(r);
    // 6. state only moves forward
    expect(RANK[s], "state went backwards").to.be.gte(this.lastRank);
    this.lastRank = RANK[s];
    // 4.
    expect(big(r.soldContracts) <= big(r.totalContracts)).to.equal(true);
    expect(big(r.exercisedContracts) <= big(r.soldContracts)).to.equal(true);
    // 2. escrow vault
    const bids = this.bidders.map((b) => w.decode("bid", bidPda(this.key, b.publicKey)));
    const post = ["cleared", "noSale", "settled", "finalized"].includes(s);
    const expectedEscrow = bids.reduce((a, b) => a + (post ? (b.refunded ? 0n : big(b.escrow) - big(b.paid)) : big(b.escrow)), 0n);
    expect(w.vault(this.key, "escrow"), "escrow vault").to.equal(expectedEscrow);
    // 3. premium vault
    const positions = this.users.map((u) => w.decode("position", positionPda(this.key, u.publicKey)));
    const claimedPremium = positions.reduce(
      (a, p) => a + (p.premiumClaimed ? proRata(big(r.premiumToUsers), big(p.contracts), big(r.totalContracts)) : 0n), 0n);
    expect(w.vault(this.key, "premium"), "premium vault").to.equal(big(r.premiumToUsers) - claimedPremium);
    // 5. collateral before exercise / claims
    if (!["finalized", "noSale"].includes(s) && big(r.exercisedContracts) === 0n) {
      if ("buyLower" in r.side) expect(w.vault(this.key, "quote"), "quote vault").to.equal(big(r.totalContracts) * big(r.strikePerContract));
      else expect(w.vault(this.key, "underlying"), "underlying vault").to.equal(big(r.totalContracts) * big(r.contractSizeRaw));
    }
  }
}

export const P = PRICE;
export { STRIKE, CONTRACT };
