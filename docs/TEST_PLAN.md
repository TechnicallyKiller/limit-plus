# Limit+ Test Plan

Goal: prove money can't get stuck or stolen, and that the demo flow works end to end.
Focus on business-critical paths, security boundaries and rounding; skip trivial getters.

Test layers:
- **Unit (Rust, `cargo test`)** — pure functions in `math.rs`, `randomness.rs`, commitment hashing.
- **Integration (LiteSVM or local validator)** — full instruction flows with clock warping.
- **Cross-language** — TS SDK commitment hash == program hash.
- **E2E smoke (scripts/demo-run)** — one compressed round on localnet with mock oracle, then on devnet with Pyth.

Fixtures: mock USDC (6 decimals, classic SPL), mock NVDAx (Token-2022, 8 decimals, ScaledUiAmount
multiplier 1.0), `contract_size_raw = 1_000_000` (0.01 token), strike = $1.80 per contract
(`1_800_000`), 3 users, 3 bidders.

## Phase 1 — math & state (unit)

| ID | Test |
|---|---|
| U1 | `price_per_share_quote` for expo −5, −8, and positive Q+expo; floors correctly |
| U2 | `settle_price_per_contract` with shares_per_contract_e9 = 10_000_000 (0.01 share) |
| U3 | pro-rata payout: Σ floor(x × c_i / C) ≤ x for random c_i (property test, 1000 cases) |
| U4 | fee split: fee + premium_to_users == total_premium |
| U5 | overflow: max u64 inputs return MathOverflow, never panic |
| U6 | cutoff derivation always within [candle_start_ts, bid_end_ts]; span 0 handled |
| U7 | commitment hash matches a hard-coded vector (shared with the TS test X1) |

## Phase 2 — instruction flows (integration)

| ID | Scenario | Must assert |
|---|---|---|
| I1 | BuyLower, OTM: 3 deposits, 3 bids, clear, premium claims, settle above strike, finalize, claims | users get USDC back + premium; bidders get escrow − paid; vaults end ~0 (dust only) |
| I2 | BuyLower, ITM: settle below strike, 2 of 3 winners exercise | users get mix of NVDAx and USDC pro-rata; non-exercising winner's share stays as USDC |
| I3 | SellHigher, ITM and OTM | mirror of I1/I2 |
| I4 | Undersubscribed (demand < supply) | clearing = lowest valid bid; sold < total; premium only on sold |
| I5 | Oversubscribed | marginal bidder partially filled; all winners pay the same clearing price |
| I6 | Bid below reserve | revealed but `valid = false`; fully refunded |
| I7 | Bid committed after random cutoff | `valid = false`; fully refunded |
| I8 | Wrong salt on reveal | `CommitmentMismatch`; bid stays unrevealed; refundable after clear |
| I9 | Unrevealed bid | excluded from clear; full refund |
| I10 | `clear_auction` with a missing bid account / duplicate / bid from another round | `BidAccountsMismatch` |
| I11 | 21st bid | `TooManyBids` |
| I12 | Settle with wrong feed / publish_time outside tolerance / wide confidence | the matching Oracle* error |
| I13 | Exercise when OTM / after window / twice | `NotInTheMoney` / `ExerciseWindowClosed` / `AlreadyExercised` |
| I14 | Any instruction outside its phase | `WrongPhase` / `TooEarly` / `TooLate` |
| I15 | Double claim, double premium claim, double refund | `AlreadyClaimed` / `AlreadyRefunded` |
| I16 | `expire_without_price` after grace | round finalizes as OTM; users claim collateral |
| I17 | Pause | blocks deposit + commit, does NOT block claims/refunds/withdraw |
| I18 | create_round with a TransferFee mint | `UnsupportedMintExtension` |
| I19 | NoSale (no valid bids) | users can claim full collateral right after clear |
| I20 | Invariants §11 checked after every step of I1–I5 | helper `assertInvariants(round)` |

## Phase 3 — oracle

| ID | Test |
|---|---|
| O1 | Program built without `mock-oracle` has no `set_mock_price` in the IDL |
| O2 | Devnet: fetch NVDA update at a past timestamp from Hermes, post it, settle a demo round |
| O3 | Decoder fallback (only if used): decodes a real devnet `PriceUpdateV2` account |

## Phase 4 — SDK, bots, keeper

| ID | Test |
|---|---|
| X1 | TS `computeCommitment` == Rust vector from U7 |
| X2 | Keeper is idempotent: running two keepers on one round causes no failed state transitions (only "already done" no-ops) |
| X3 | mm-bot full lifecycle on localnet: commit → reveal → (exercise) → refund |
| X4 | `scripts/demo-run.ts` completes a compressed round on localnet in under 10 minutes |

## Phase 5 — frontend

| ID | Test |
|---|---|
| F1 | Deposit flow works with Phantom on devnet (manual) |
| F2 | Primary UI contains none of: put, call, strike, premium, option, collateral (automated text check) |
| F3 | Risk line is visible on the deposit screen for both sides |
| F4 | Fair-price check shows inputs (spot, your price, vol, time) and the % vs fair |
| F5 | Round page shows bids publicly after reveal, clearing price, and explorer links |

## Release gate before demo day

All of U*, I*, X1–X4 green; O2 done once on devnet; F1–F5 checked; a recorded backup video exists.
