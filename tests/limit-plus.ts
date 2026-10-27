import { expect } from "chai";
import { Keypair } from "@solana/web3.js";
import { World, T, T0, STRIKE, CONTRACT, RESERVE, PRICE, FEED } from "./harness";
import { Flow, proRata } from "./flows";
import { bidPda, mockPricePda, positionPda, roundPda } from "../packages/sdk/src";

const big = (x: any) => BigInt(x.toString());

async function fresh(feeBps = 1000) {
  const w = new World();
  await w.setup(feeBps);
  return w;
}

describe("Limit+ integration (LiteSVM, mock-oracle build)", function () {
  this.timeout(120000);

  it("I1_buylower_otm_full_lifecycle", async () => {
    const w = await fresh();
    const key = await w.createRound(1);
    const f = new Flow(w, key);
    await f.deposits([4, 3, 3]);
    w.warp(T0 + 150);
    await f.bids([{ price: 150_000, qty: 5 }, { price: 120_000, qty: 5 }, { price: 100_000, qty: 5 }]);
    await f.resolve();
    await f.reveal();
    await f.clear();
    const r = await f.round();
    expect(big(r.clearingPremiumPerContract)).to.equal(120_000n);
    expect(big(r.soldContracts)).to.equal(10n);
    expect(big(r.premiumToUsers)).to.equal(1_080_000n);
    expect(big(r.feePaid)).to.equal(120_000n);
    expect(w.balance(w.treasury)).to.equal(120_000n);
    await f.claimPremiums();
    await f.settle(PRICE.above);
    expect((await f.round()).inTheMoney).to.equal(false);
    await f.finalize();
    await f.claims();
    await f.refunds();
    // users: collateral back + premium
    const expected = [4n, 3n, 3n].map((c) => c * BigInt(STRIKE) + proRata(1_080_000n, c, 10n));
    f.users.forEach((u, i) => expect(w.bal(w.quoteMint, u.publicKey)).to.equal(expected[i]));
    // bidders: escrow - paid
    expect(w.bal(w.quoteMint, f.bidders[0].publicKey)).to.equal(750_000n - 600_000n);
    expect(w.bal(w.quoteMint, f.bidders[1].publicKey)).to.equal(600_000n - 600_000n);
    expect(w.bal(w.quoteMint, f.bidders[2].publicKey)).to.equal(500_000n);
    for (const k of ["quote", "underlying", "premium", "escrow"] as const) expect(w.vault(key, k)).to.equal(0n);
  });

  it("I2_buylower_itm_two_of_three_exercise", async () => {
    const w = await fresh();
    const key = await w.createRound(2);
    const f = new Flow(w, key);
    await f.deposits([4, 3, 3]);
    w.warp(T0 + 150);
    await f.bids([{ price: 150_000, qty: 4 }, { price: 130_000, qty: 3 }, { price: 120_000, qty: 3 }]);
    await f.resolve(); await f.reveal(); await f.clear(); await f.claimPremiums();
    await f.settle(PRICE.below);
    expect((await f.round()).inTheMoney).to.equal(true);
    await f.exercise(0);
    await f.exercise(1);
    const r = await f.round();
    expect(big(r.exercisedContracts)).to.equal(7n);
    await f.finalize(T.expiry + 100);
    const fin = await f.round();
    expect(big(fin.finalUnderlying)).to.equal(7n * BigInt(CONTRACT));
    expect(big(fin.finalQuote)).to.equal(10n * BigInt(STRIKE) - 7n * BigInt(STRIKE));
    await f.claims();
    await f.refunds();
    [4n, 3n, 3n].forEach((c, i) => {
      expect(w.bal(w.underlyingMint, f.users[i].publicKey)).to.equal(proRata(7n * BigInt(CONTRACT), c, 10n));
      expect(w.bal(w.quoteMint, f.users[i].publicKey)).to.equal(proRata(3n * BigInt(STRIKE), c, 10n) + proRata(1_080_000n - 0n + 0n, c, 10n) * 0n + proRata(big(fin.premiumToUsers), c, 10n));
    });
    // exercising bidders sold stock at strike; the non-exerciser keeps its (unused) refund
    expect(w.bal(w.underlyingMint, f.bidders[0].publicKey)).to.equal(0n);
    expect(w.bal(w.quoteMint, f.bidders[0].publicKey)).to.equal(4n * BigInt(STRIKE) + (600_000n - 480_000n));
  });

  it("I3_sellhigher_itm_and_otm", async () => {
    for (const [id, price, itm] of [[3, PRICE.above, true], [4, PRICE.below, false]] as const) {
      const w = await fresh();
      const key = await w.createRound(id, "sellHigher");
      const f = new Flow(w, key);
      await f.deposits([4, 6]);
      w.warp(T0 + 150);
      await f.bids([{ price: 100_000, qty: 10 }]);
      await f.resolve(); await f.reveal(); await f.clear(); await f.claimPremiums();
      await f.settle(price);
      expect((await f.round()).inTheMoney).to.equal(itm);
      if (itm) {
        await f.exercise(0);
        await f.finalize();
        await f.claims();
        // users hold USDC for the stock sold at strike plus premium; no stock left
        expect(w.bal(w.underlyingMint, f.users[0].publicKey)).to.equal(0n);
        expect(w.bal(w.quoteMint, f.users[0].publicKey)).to.equal(proRata(10n * BigInt(STRIKE), 4n, 10n) + proRata(900_000n, 4n, 10n));
      } else {
        await f.finalize();
        await f.claims();
        expect(w.bal(w.underlyingMint, f.users[0].publicKey)).to.equal(4n * BigInt(CONTRACT));
        expect(w.bal(w.underlyingMint, f.users[1].publicKey)).to.equal(6n * BigInt(CONTRACT));
      }
      await f.refunds();
    }
  });

  it("I4_undersubscribed_clears_at_lowest_valid_bid", async () => {
    const w = await fresh();
    const f = new Flow(w, await w.createRound(5));
    await f.deposits([5, 5]);
    w.warp(T0 + 150);
    await f.bids([{ price: 150_000, qty: 3 }, { price: 100_000, qty: 3 }]);
    await f.resolve(); await f.reveal(); await f.clear();
    const r = await f.round();
    expect(big(r.clearingPremiumPerContract)).to.equal(100_000n);
    expect(big(r.soldContracts)).to.equal(6n);
    expect(big(r.premiumToUsers) + big(r.feePaid)).to.equal(600_000n);
    await f.claimPremiums();
  });

  it("I5_oversubscribed_partial_fill_uniform_price", async () => {
    const w = await fresh();
    const f = new Flow(w, await w.createRound(6));
    await f.deposits([10]);
    w.warp(T0 + 150);
    await f.bids([{ price: 200_000, qty: 6 }, { price: 150_000, qty: 6 }, { price: 100_000, qty: 6 }]);
    await f.resolve(); await f.reveal(); await f.clear();
    const bids = f.bidders.map((b) => w.decode("bid", bidPda(f.key, b.publicKey)));
    expect(bids.map((b) => big(b.wonQty))).to.deep.equal([6n, 4n, 0n]);
    expect(bids.map((b) => big(b.paid))).to.deep.equal([900_000n, 600_000n, 0n]);
    expect(big((await f.round()).clearingPremiumPerContract)).to.equal(150_000n);
  });

  it("I6_bid_below_reserve_is_invalid_and_refunded", async () => {
    const w = await fresh();
    const f = new Flow(w, await w.createRound(7));
    await f.deposits([2]);
    w.warp(T0 + 150);
    await f.bids([{ price: RESERVE - 1, qty: 2 }, { price: 80_000, qty: 2 }]);
    await f.resolve(); await f.reveal(); await f.clear();
    const bad = w.decode("bid", bidPda(f.key, f.bidders[0].publicKey));
    expect(bad.revealed).to.equal(true);
    expect(bad.valid).to.equal(false);
    await f.refunds();
    expect(w.bal(w.quoteMint, f.bidders[0].publicKey)).to.equal(BigInt((RESERVE - 1) * 2));
  });

  it("I7_bid_after_random_cutoff_is_invalid", async () => {
    const w = await fresh();
    const key = await w.createRound(8);
    const f = new Flow(w, key);
    await f.deposits([2]);
    w.warp(T0 + 150);
    await f.bids([{ price: 90_000, qty: 1 }]);
    await f.bids([{ price: 95_000, qty: 1, commitAt: T0 + 260 }]);
    w.forceCutoff(key, T.candle, T.bidEnd, T.candle);
    await f.resolve();
    expect(big((await f.round()).cutoffTs)).to.equal(BigInt(T.candle));
    await f.reveal(); await f.clear();
    expect(w.decode("bid", bidPda(key, f.bidders[0].publicKey)).valid).to.equal(true);
    expect(w.decode("bid", bidPda(key, f.bidders[1].publicKey)).valid).to.equal(false);
    await f.refunds();
    expect(w.bal(w.quoteMint, f.bidders[1].publicKey)).to.equal(95_000n);
  });

  it("I8_wrong_salt_commitment_mismatch", async () => {
    const w = await fresh();
    const f = new Flow(w, await w.createRound(9));
    await f.deposits([2]);
    w.warp(T0 + 150);
    await f.bids([{ price: 90_000, qty: 1 }, { price: 80_000, qty: 1 }]);
    await f.resolve();
    const b = f.bidders[0];
    const err = w.fail([await w.client.revealBid(b.publicKey, f.key, 90_000, 1, new Uint8Array(32).fill(7))], [b]);
    expect(err).to.equal("CommitmentMismatch");
    expect(w.decode("bid", bidPda(f.key, b.publicKey)).revealed).to.equal(false);
    await f.reveal([1]);
    await f.clear();
    await f.refunds();
    expect(w.bal(w.quoteMint, b.publicKey)).to.equal(90_000n);
  });

  it("I9_unrevealed_bid_excluded_and_refunded", async () => {
    const w = await fresh();
    const f = new Flow(w, await w.createRound(10));
    await f.deposits([2]);
    w.warp(T0 + 150);
    await f.bids([{ price: 150_000, qty: 2 }, { price: 80_000, qty: 2 }]);
    await f.resolve(); await f.reveal([1]); await f.clear();
    expect(big((await f.round()).clearingPremiumPerContract)).to.equal(80_000n);
    expect(big(w.decode("bid", bidPda(f.key, f.bidders[0].publicKey)).wonQty)).to.equal(0n);
    await f.refunds();
    expect(w.bal(w.quoteMint, f.bidders[0].publicKey)).to.equal(300_000n);
  });

  it("I10_clear_rejects_missing_duplicate_and_foreign_bids", async () => {
    const w = await fresh();
    const f1 = new Flow(w, await w.createRound(11));
    const f2 = new Flow(w, await w.createRound(12));
    for (const f of [f1, f2]) { await f.deposits([2]); }
    w.warp(T0 + 150);
    await f1.bids([{ price: 90_000, qty: 1 }, { price: 80_000, qty: 1 }]);
    await f2.bids([{ price: 90_000, qty: 1 }]);
    for (const f of [f1, f2]) await f.resolve();
    await f1.reveal(); await f2.reveal();
    w.warp(T.revealEnd);
    const r = await f1.round();
    const [a, b] = f1.bidKeys();
    const foreign = f2.bidKeys()[0];
    for (const keys of [[a], [a, a], [a, foreign]]) {
      expect(w.fail([await w.client.clearAuction(f1.cranker.publicKey, f1.key, r, keys)], [f1.cranker])).to.equal("BidAccountsMismatch");
    }
    await f1.clear([a, b]);
  });

  it("I11_21st_bid_rejected", async () => {
    const w = await fresh();
    const f = new Flow(w, await w.createRound(13));
    await f.deposits([1]);
    w.warp(T0 + 150);
    await f.bids(Array.from({ length: 20 }, () => ({ price: 60_000, qty: 1 })));
    const b = w.user();
    const { ix } = await w.commit(b, f.key, 60_000, 1, 60_000);
    expect(w.fail([ix], [b])).to.equal("TooManyBids");
  });

  it("I12_settle_oracle_checks", async () => {
    const w = await fresh();
    const f = new Flow(w, await w.createRound(14));
    await f.deposits([2]);
    w.warp(T0 + 150);
    await f.bids([{ price: 90_000, qty: 2 }]);
    await f.resolve(); await f.reveal(); await f.clear();
    w.warp(T.expiry);
    const r = await f.round();
    const price = mockPricePda(FEED);
    // wrong feed: pass a price account for a different feed
    const other = new Uint8Array(32).fill(0xcd);
    w.ok([await w.setPrice(PRICE.atm, T.expiry, 1000, other)], [w.admin]);
    expect(w.fail([await w.client.settle(f.cranker.publicKey, f.key, r, mockPricePda(other))], [f.cranker])).to.equal("OracleFeedMismatch");
    // outside tolerance
    w.ok([await w.setPrice(PRICE.atm, T.expiry + 301)], [w.admin]);
    expect(w.fail([await w.client.settle(f.cranker.publicKey, f.key, r, price)], [f.cranker])).to.equal("OracleOutsideWindow");
    w.ok([await w.setPrice(PRICE.atm, T.expiry - 301)], [w.admin]);
    expect(w.fail([await w.client.settle(f.cranker.publicKey, f.key, r, price)], [f.cranker])).to.equal("OracleOutsideWindow");
    // wide confidence (> 1%)
    w.ok([await w.setPrice(PRICE.atm, T.expiry, 200_000)], [w.admin]);
    expect(w.fail([await w.client.settle(f.cranker.publicKey, f.key, r, price)], [f.cranker])).to.equal("OracleConfidenceTooWide");
    // invalid price
    w.ok([await w.setPrice(0, T.expiry)], [w.admin]);
    expect(w.fail([await w.client.settle(f.cranker.publicKey, f.key, r, price)], [f.cranker])).to.equal("OracleInvalidPrice");
    // good price settles
    w.ok([await w.setPrice(PRICE.atm, T.expiry + 30)], [w.admin]);
    w.ok([await w.client.settle(f.cranker.publicKey, f.key, r, price)], [f.cranker]);
  });

  it("I13_exercise_guards", async () => {
    // OTM
    let w = await fresh();
    let f = new Flow(w, await w.createRound(15));
    await f.deposits([2]);
    w.warp(T0 + 150);
    await f.bids([{ price: 90_000, qty: 2 }]);
    await f.resolve(); await f.reveal(); await f.clear(); await f.settle(PRICE.above);
    let r = await f.round();
    expect(w.fail([await w.client.exercise(f.bidders[0].publicKey, f.key, r)], [f.bidders[0]])).to.equal("NotInTheMoney");

    // ITM: twice, then after the window
    w = await fresh();
    f = new Flow(w, await w.createRound(16));
    await f.deposits([4]);
    w.warp(T0 + 150);
    await f.bids([{ price: 90_000, qty: 2 }, { price: 80_000, qty: 2 }]);
    await f.resolve(); await f.reveal(); await f.clear(); await f.settle(PRICE.below);
    await f.exercise(0);
    r = await f.round();
    expect(w.fail([await w.client.exercise(f.bidders[0].publicKey, f.key, r)], [f.bidders[0]])).to.equal("AlreadyExercised");
    w.mintTo(w.underlyingMint, f.bidders[1].publicKey, 2 * CONTRACT);
    w.mintTo(w.quoteMint, f.bidders[1].publicKey, 0);
    w.warp(T.expiry + 100);
    expect(w.fail([await w.client.exercise(f.bidders[1].publicKey, f.key, r)], [f.bidders[1]])).to.equal("ExerciseWindowClosed");
  });

  it("I14_instructions_outside_their_phase", async () => {
    const w = await fresh();
    const key = await w.createRound(17, "buyLower", { openTs: T0 + 50 });
    const f = new Flow(w, key);
    const u = w.user();
    expect(w.fail([await w.deposit(u, key, 1)], [u])).to.equal("TooEarly"); // before open_ts
    w.warp(T0 + 60);
    w.ok([await w.deposit(u, key, 1)], [u]);
    const b = w.user();
    const { ix, salt } = await w.commit(b, key, 90_000, 1, 90_000);
    expect(w.fail([ix], [b])).to.equal("TooEarly"); // before bid_start
    w.warp(T0 + 150);
    expect(w.fail([await w.deposit(u, key, 1)], [u])).to.equal("TooLate");
    expect(w.fail([await w.client.withdraw(u.publicKey, key, await f.round(), 1)], [u])).to.equal("TooLate");
    w.ok([ix], [b]);
    expect(w.fail([await w.client.resolveCutoff(f.cranker.publicKey, key)], [f.cranker])).to.equal("TooEarly");
    expect(w.fail([await w.client.revealBid(b.publicKey, key, 90_000, 1, salt)], [b])).to.equal("WrongPhase");
    w.warp(T.bidEnd);
    const late = w.user();
    expect(w.fail([(await w.commit(late, key, 90_000, 1, 90_000)).ix], [late])).to.equal("TooLate");
    f.bidders.push(b); f.users.push(u);
    f.specs.set(b.publicKey.toBase58(), { price: 90_000, qty: 1, escrow: 90_000, salt });
    w.ok([await w.client.resolveCutoff(f.cranker.publicKey, key)], [f.cranker]);
    expect(w.fail([await w.client.resolveCutoff(f.cranker.publicKey, key)], [f.cranker])).to.equal("WrongPhase");
    expect(w.fail([await w.client.clearAuction(f.cranker.publicKey, key, await f.round(), f.bidKeys())], [f.cranker])).to.equal("TooEarly");
    await f.reveal();
    w.warp(T.revealEnd);
    expect(w.fail([await w.client.revealBid(b.publicKey, key, 90_000, 1, salt)], [b])).to.be.oneOf(["TooLate", "AlreadyRevealed"]);
    await f.clear();
    expect(w.fail([await w.client.settle(f.cranker.publicKey, key, await f.round(), mockPricePda(FEED))], [f.cranker])).to.equal("TooEarly");
    expect(w.fail([await w.client.finalize(f.cranker.publicKey, key)], [f.cranker])).to.equal("WrongPhase");
    w.mintTo(w.underlyingMint, u.publicKey, 0);
    expect(w.fail([await w.client.claim(u.publicKey, key, await f.round())], [u])).to.equal("WrongPhase");
  });

  it("I15_double_claims_rejected", async () => {
    const w = await fresh();
    const f = new Flow(w, await w.createRound(18));
    await f.deposits([2]);
    w.warp(T0 + 150);
    await f.bids([{ price: 90_000, qty: 1 }]);
    await f.resolve(); await f.reveal(); await f.clear(); await f.claimPremiums();
    const u = f.users[0];
    expect(w.fail([await w.client.claimPremium(u.publicKey, f.key, await f.round())], [u])).to.equal("AlreadyClaimed");
    await f.settle(PRICE.above); await f.finalize(); await f.claims();
    expect(w.fail([await w.client.claim(u.publicKey, f.key, await f.round())], [u])).to.equal("AlreadyClaimed");
    await f.refunds();
    const b = f.bidders[0];
    expect(w.fail([await w.client.claimRefund(b.publicKey, f.key, await f.round())], [b])).to.equal("AlreadyRefunded");
  });

  it("I16_expire_without_price_after_grace", async () => {
    const w = await fresh();
    const f = new Flow(w, await w.createRound(19));
    await f.deposits([3]);
    w.warp(T0 + 150);
    await f.bids([{ price: 90_000, qty: 3 }]);
    await f.resolve(); await f.reveal(); await f.clear();
    w.warp(T.expiry + 999);
    expect(w.fail([await w.client.expireWithoutPrice(f.cranker.publicKey, f.key)], [f.cranker])).to.equal("TooEarly");
    w.warp(T.expiry + 1000);
    w.ok([await w.client.expireWithoutPrice(f.cranker.publicKey, f.key)], [f.cranker]);
    expect((await f.round()).inTheMoney).to.equal(false);
    await f.finalize();
    await f.claims();
    expect(w.bal(w.quoteMint, f.users[0].publicKey)).to.equal(3n * BigInt(STRIKE) + big((await f.round()).premiumToUsers));
  });

  it("I17_pause_blocks_entries_not_exits", async () => {
    const w = await fresh();
    const key = await w.createRound(20);
    const f = new Flow(w, key);
    await f.deposits([3]);
    const u = f.users[0];
    const pause = async (p: boolean) =>
      w.ok([await w.client.updateConfig(w.admin.publicKey, 1000, 100, p, w.treasury)], [w.admin]);
    await pause(true);
    const u2 = w.user();
    expect(w.fail([await w.deposit(u2, key, 1)], [u2])).to.equal("Paused");
    w.ok([await w.client.withdraw(u.publicKey, key, await f.round(), 1)], [u]); // exits still work
    await pause(false);
    w.warp(T0 + 150);
    await f.bids([{ price: 90_000, qty: 2 }]);
    await pause(true);
    const b2 = w.user();
    const { ix } = await w.commit(b2, key, 90_000, 1, 90_000);
    expect(w.fail([ix], [b2])).to.equal("Paused");
    await f.resolve(); await f.reveal(); await f.clear(); await f.claimPremiums();
    await f.settle(PRICE.above); await f.finalize(); await f.claims(); await f.refunds();
  });

  it("I18_transfer_fee_mint_rejected", async () => {
    const w = await fresh();
    const bad = await w.createMint(8, { token2022: true, transferFee: true });
    const ix = await w.client.createRound(w.admin.publicKey, bad, w.quoteMint, w.roundArgs(21, "buyLower"));
    expect(w.fail([ix], [w.admin])).to.equal("UnsupportedMintExtension");
    // and a good ScaledUiAmount mint is accepted
    await w.createRound(22);
  });

  it("I19_no_sale_users_claim_immediately", async () => {
    const w = await fresh();
    const f = new Flow(w, await w.createRound(23));
    await f.deposits([4, 6]);
    w.warp(T0 + 150);
    await f.bids([{ price: RESERVE - 10, qty: 2 }]); // only an invalid bid
    await f.resolve(); await f.reveal(); await f.clear();
    expect(Object.keys((await f.round()).state)[0]).to.equal("noSale");
    await f.claims();
    expect(w.bal(w.quoteMint, f.users[0].publicKey)).to.equal(4n * BigInt(STRIKE));
    expect(w.bal(w.quoteMint, f.users[1].publicKey)).to.equal(6n * BigInt(STRIKE));
    await f.refunds();
  });

  it("I19b_no_sale_with_zero_bids", async () => {
    const w = await fresh();
    const f = new Flow(w, await w.createRound(24, "sellHigher"));
    await f.deposits([5]);
    await f.resolve(); await f.clear([]);
    await f.claims();
    expect(w.bal(w.underlyingMint, f.users[0].publicKey)).to.equal(5n * BigInt(CONTRACT));
  });

  it("I21_only_admin_can_create_rounds_and_config", async () => {
    const w = await fresh();
    const mallory = w.user();
    const ix = await w.client.createRound(mallory.publicKey, w.underlyingMint, w.quoteMint, w.roundArgs(30, "buyLower"));
    expect(w.fail([ix], [mallory])).to.equal("Unauthorized");
    expect(w.fail([await w.client.updateConfig(mallory.publicKey, 0, 100, true, w.treasury)], [mallory])).to.equal("Unauthorized");
    expect(w.fail([await w.client.setMockPrice(mallory.publicKey, FEED, 1, -5, 1, 1)], [mallory])).to.equal("Unauthorized");
    const bad = w.roundArgs(31, "buyLower", { candleStartTs: T.bidEnd });
    expect(w.fail([await w.client.createRound(w.admin.publicKey, w.underlyingMint, w.quoteMint, bad)], [w.admin])).to.equal("InvalidTimeline");
  });
});
