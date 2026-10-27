# Limit+ Protocol Spec (v0.1, hackathon prototype)

Status: source of truth for the program. Change this file before changing behaviour.

## 1. What the product does

Two kinds of weekly pools ("rounds") per stock token:

| Side | User says | User deposits | Technically the user… | Bidder gets the right to… |
|---|---|---|---|---|
| `BuyLower` | "I'd buy NVDAx at $X" | USDC = contracts × strike | sells a cash-secured put | sell NVDAx to the pool at $X |
| `SellHigher` | "I'd sell NVDAx at $X" | NVDAx = contracts × contract size | sells a covered call | buy NVDAx from the pool at $X |

Bidders (market makers, bots) compete in a sealed-bid, uniform-price auction to buy those rights. The
clearing premium is paid to users right after the auction. At expiry the round settles on the official
oracle price; winning bidders may exercise if in the money; users then claim their pro-rata share of
what's left in the pool.

Each round is **one stock, one side, one strike, one expiry**. All users in a round get the same fill ratio.

## 2. Units and conventions

- Quote token = USDC (classic SPL, 6 decimals on mainnet; our mock uses 6 too). `Q` = quote decimals.
- Underlying = xStock (Token-2022) or our mock Token-2022 mint. `U` = underlying decimals (read from mint).
- **Contract**: the unit of trading. `contract_size_raw` = underlying base units per contract (e.g. 0.01 token).
- `shares_per_contract_e9` = shares represented by one contract × 10^9. Computed off-chain by the round
  creator as `contract_size_raw / 10^U × scaled_ui_multiplier × 10^9` (xStocks on Solana use the Token-2022
  Scaled UI Amount multiplier for dividends; our mock uses multiplier 1.0).
- `strike_per_contract` = USDC base units exchanged per contract on exercise.
- All amounts are `u64`; intermediate math in `u128`. Timestamps are `i64` unix seconds (`Clock::unix_timestamp`).
- Rounding: **floor** every amount the program pays out.

## 3. Accounts

### 3.1 PDAs and seeds

| Account | Seeds |
|---|---|
| `Config` | `["config"]` |
| `Round` | `["round", underlying_mint, round_id.to_le_bytes()]` |
| Quote collateral vault | `["vault", round, "quote"]` (token account, authority = Round PDA) |
| Underlying collateral vault | `["vault", round, "underlying"]` |
| Premium vault (quote mint) | `["vault", round, "premium"]` |
| Bid escrow vault (quote mint) | `["vault", round, "escrow"]` |
| `Position` | `["position", round, owner]` |
| `Bid` | `["bid", round, bidder]` (one bid per bidder per round) |
| `MockPrice` (feature `mock-oracle` only) | `["mock_price", feed_id]` |

### 3.2 State structs

```rust
pub enum Side { BuyLower, SellHigher }

pub enum RoundState { Deposit, Bidding, Reveal, Cleared, NoSale, Settled, Finalized }

pub struct Config {
    pub bump: u8,
    pub admin: Pubkey,
    pub treasury: Pubkey,          // USDC token account receiving protocol fees
    pub fee_bps: u16,              // default 1000 = 10% of premium
    pub max_conf_bps: u16,         // default 100 = oracle confidence must be <= 1% of price
    pub paused: bool,
}

pub struct Round {
    pub bump: u8,
    pub round_id: u64,
    pub side: Side,
    pub state: RoundState,
    pub creator: Pubkey,
    pub underlying_mint: Pubkey,
    pub quote_mint: Pubkey,
    pub underlying_token_program: Pubkey,
    pub quote_token_program: Pubkey,
    pub pyth_feed_id: [u8; 32],
    // economics
    pub contract_size_raw: u64,
    pub shares_per_contract_e9: u64,
    pub strike_per_contract: u64,
    pub reserve_premium_per_contract: u64,  // bids below this are invalid
    pub fair_premium_per_contract: u64,     // model estimate published at creation (for the fair-price label)
    // timeline (must satisfy §4.1)
    pub open_ts: i64,
    pub bid_start_ts: i64,
    pub candle_start_ts: i64,               // random cutoff falls in [candle_start_ts, bid_end_ts]
    pub bid_end_ts: i64,
    pub reveal_end_ts: i64,
    pub expiry_ts: i64,                     // e.g. Friday 16:00 America/New_York
    pub exercise_window_secs: i64,          // e.g. 3600 (demo: 120)
    pub settle_tolerance_secs: i64,         // oracle publish_time must be within ± this of expiry_ts (e.g. 300)
    pub settle_grace_secs: i64,             // after expiry + grace with no settle → expire OTM (e.g. 86400)
    // deposits
    pub total_contracts: u64,
    pub depositor_count: u32,
    // auction
    pub bid_count: u16,
    pub revealed_count: u16,
    pub cutoff_resolved: bool,
    pub cutoff_ts: i64,
    pub clearing_premium_per_contract: u64,
    pub sold_contracts: u64,
    pub premium_to_users: u64,
    pub fee_paid: u64,
    // settlement
    pub settled: bool,
    pub settle_price_per_contract: u64,
    pub settle_publish_time: i64,
    pub in_the_money: bool,
    pub exercised_contracts: u64,
    pub final_quote: u64,                   // snapshot of quote vault at finalize
    pub final_underlying: u64,              // snapshot of underlying vault at finalize
}

pub struct Position {
    pub bump: u8,
    pub round: Pubkey,
    pub owner: Pubkey,
    pub contracts: u64,
    pub premium_claimed: bool,
    pub claimed: bool,
}

pub struct Bid {
    pub bump: u8,
    pub round: Pubkey,
    pub bidder: Pubkey,
    pub commitment: [u8; 32],
    pub escrow: u64,                // USDC locked at commit
    pub commit_ts: i64,
    pub revealed: bool,
    pub valid: bool,                // set at reveal
    pub price_per_contract: u64,    // revealed premium bid
    pub qty: u64,                   // revealed contracts wanted
    pub won_qty: u64,               // set at clear
    pub paid: u64,                  // won_qty × clearing price
    pub refunded: bool,
    pub exercised: bool,
}
```

Use `#[derive(InitSpace)]` and size accounts with `8 + T::INIT_SPACE`.

### 3.3 Mint checks at `create_round`

- `quote_mint` must equal the configured USDC/mock-USDC mint for the cluster (pass it in Config or an
  allowlist account; simplest: store `quote_mint` in Config).
- Underlying mint: read Token-2022 extensions. **Reject** if it has `TransferFeeConfig`, `TransferHook`
  (unless the hook program is explicitly allowlisted — not needed for MVP), `NonTransferable`,
  `ConfidentialTransferMint`, or `InterestBearingConfig`. **Allow** `ScaledUiAmount`, `MetadataPointer`,
  `TokenMetadata`, `Pausable`, `PermanentDelegate`, `DefaultAccountState`. Document in the README that a
  permanent delegate (the issuer) can move tokens out of any account, including our vaults.

## 4. Timeline and state machine

### 4.1 Valid timeline (checked at `create_round`)

```
open_ts <= bid_start_ts <= candle_start_ts < bid_end_ts <= reveal_end_ts <= expiry_ts
exercise_window_secs > 0, settle_tolerance_secs > 0, settle_grace_secs >= exercise_window_secs
```

Demo rounds may compress the whole thing into ~10 minutes. Production weekly rounds:
deposits open Fri after close → bidding Mon morning → expiry Fri 16:00 New York time.

### 4.2 Phases

| Phase | Time window | Allowed |
|---|---|---|
| Deposit | `open_ts <= now < bid_start_ts` | `deposit`, `withdraw` |
| Bidding | `bid_start_ts <= now < bid_end_ts` | `commit_bid` |
| Reveal | after `resolve_cutoff`, `now < reveal_end_ts` | `reveal_bid` |
| Clear | `now >= reveal_end_ts` | `clear_auction` → `Cleared` or `NoSale` |
| Post-clear | after clear | `claim_premium`, `claim_refund` |
| Settle | `now >= expiry_ts` | `settle` (with price) or, after `expiry_ts + settle_grace_secs`, `expire_without_price` |
| Exercise | `settled && now < expiry_ts + exercise_window_secs` | `exercise` (only if `in_the_money`) |
| Finalize | `settled` AND (`now >= expiry_ts + exercise_window_secs` OR `!in_the_money` OR `exercised_contracts == sold_contracts`) | `finalize` |
| Claim | `Finalized` or `NoSale` | `claim` |

`NoSale` (no valid bids): users may `claim` immediately (finalize snapshots vaults at clear time).
`state` must only move forward. Implement `Round::require_phase(...)` helpers in `state.rs`.

## 5. Instructions

### Admin
- `initialize_config(fee_bps, max_conf_bps, quote_mint, treasury)` — once. `fee_bps <= 2000`.
- `update_config(...)` — admin only. Can pause (blocks `deposit` and `commit_bid` only; never blocks exits).
- `create_round(params)` — admin only for the prototype. Validates timeline (§4.1) and mints (§3.3);
  creates the four vaults. `round_id` = caller-supplied u64.
- `set_mock_price(feed_id, price, expo, conf, publish_time)` — **feature `mock-oracle` only**, admin only.

### User
- `deposit(contracts)` — Deposit phase. Creates `Position` if needed (`init_if_needed`).
  BuyLower: transfer `contracts × strike_per_contract` USDC → quote vault.
  SellHigher: transfer `contracts × contract_size_raw` underlying → underlying vault.
  `round.total_contracts += contracts`.
- `withdraw(contracts)` — Deposit phase only; reverse of deposit.
- `claim_premium()` — after `Cleared`. Pays `premium_to_users × position.contracts / total_contracts` (floor)
  from the premium vault. Once per position.
- `claim()` — after `Finalized` (or `NoSale`). Pays `final_quote × contracts / total_contracts` from the quote vault and
  `final_underlying × contracts / total_contracts` from the underlying vault (floor each). Once per position.
  Also pays unclaimed premium if `premium_claimed == false` (convenience).

### Bidder
- `commit_bid(commitment, escrow)` — Bidding phase. `escrow > 0` USDC → escrow vault.
  `commit_ts = now`. `round.bid_count += 1`; fail if `bid_count == MAX_BIDS_PER_ROUND` (20).
- `reveal_bid(price_per_contract, qty, salt: [u8; 32])` — Reveal phase. Recompute
  `keccak256(round || bidder || price_le || qty_le || salt)`; mismatch → error (bid stays unrevealed).
  On match: `revealed = true`; `valid = commit_ts <= cutoff_ts && price >= reserve && qty >= 1 &&
  price × qty <= escrow`. Invalid-but-revealed bids are excluded and fully refundable.
- `exercise()` — Exercise phase, `in_the_money`, `won_qty > 0`, not yet exercised.
  BuyLower: bidder sends `won_qty × contract_size_raw` underlying → underlying vault; receives
  `won_qty × strike_per_contract` USDC from quote vault.
  SellHigher: bidder sends `won_qty × strike_per_contract` USDC → quote vault; receives
  `won_qty × contract_size_raw` underlying from underlying vault.
  `round.exercised_contracts += won_qty`. All-or-nothing per bid.
- `claim_refund()` — after `Cleared`/`NoSale`. Refund `escrow − paid` (full escrow if not revealed/invalid/lost). Once.

### Permissionless cranks (anyone can call; the keeper bot does)
- `resolve_cutoff()` — `now >= bid_end_ts`, not yet resolved. See §6. Sets `cutoff_ts`, state → `Reveal`.
- `clear_auction()` — §8. `remaining_accounts` = **all** Bid PDAs of the round.
- `settle()` — accounts include the oracle price account. §7.
- `expire_without_price()` — `state == Cleared`, `now >= expiry_ts + settle_grace_secs` and not settled → `in_the_money = false`,
  `settled = true`. Policy: premium already paid is final.
- `finalize()` — snapshot `final_quote`, `final_underlying` from the two collateral vaults; state → `Finalized`.

## 6. Random auction close ("candle" cutoff)

Bids are accepted during the whole bidding window, but only bids committed at or before a **random cutoff**
inside `[candle_start_ts, bid_end_ts]` count. The cutoff is drawn **after** bidding ends, so no bidder can
know it in advance — this removes the incentive to wait and snipe at a predictable close.
(This is the "candle auction" idea; it addresses the predictable-auction problem described in the DeFi
option vault research — see README "Research behind the design".)

**MVP randomness (SlotHashes):**
- Pass the SlotHashes sysvar (`SysvarS1otHashes111111111111111111111111111`) as an `UncheckedAccount`
  with an `address = ...` constraint. Do NOT deserialize the whole sysvar; read raw bytes:
  data[0..8] = entry count (u64 LE); first entry = slot (u64) at [8..16], hash ([u8;32]) at [16..48].
- `seed = keccak256(most_recent_hash || round_pubkey || bid_end_ts.to_le_bytes())`
- `span = bid_end_ts − candle_start_ts`; `cutoff_ts = candle_start_ts + (u64::from_le(seed[0..8]) % (span + 1))`.
- Known limitation (document it): a slot leader could bias this. Acceptable for a hackathon prototype.

**Stretch (Switchboard On-Demand):** request randomness committed to a slot after `bid_end_ts` when the
round is created; `resolve_cutoff` reads the revealed value instead of SlotHashes. Keep the same
`randomness.rs` interface so swapping is one file.

## 7. Oracle and settlement

### 7.1 Interface (`oracle.rs`)

```rust
pub struct OraclePrice { pub price: i64, pub expo: i32, pub conf: u64, pub publish_time: i64 }
pub fn read_price(account: &AccountInfo, expected_feed_id: &[u8; 32]) -> Result<OraclePrice>;
```
- Pyth path: account must be owned by the Pyth receiver program and decode as `PriceUpdateV2` with
  full verification level; `feed_id` must equal `round.pyth_feed_id`.
- Mock path (`mock-oracle` feature): `MockPrice` PDA for that feed id.

### 7.2 `settle` checks

- `state == Cleared` (a `NoSale` round never settles; users just claim), `now >= expiry_ts`, not settled.
- `|publish_time − expiry_ts| <= settle_tolerance_secs`. (The keeper fetches the update for the expiry
  timestamp from Hermes: `GET /v2/updates/price/{expiry_ts}?ids[]=<feed>` returns the first update at or
  after that time, then posts it with the Pyth receiver.)
- `price > 0` and `conf × 10_000 <= price × max_conf_bps`.

### 7.3 Settlement math (`math.rs`)

```
price_per_share_quote = price × 10^(Q + expo)          // if Q + expo < 0, divide by 10^-(Q+expo) (floor)
settle_price_per_contract = price_per_share_quote × shares_per_contract_e9 / 10^9   (floor, u128)
BuyLower:   in_the_money = settle_price_per_contract <  strike_per_contract
SellHigher: in_the_money = settle_price_per_contract >  strike_per_contract
```
If no winning bids (`sold_contracts == 0`), settle still records the price, `in_the_money` is irrelevant.

### 7.4 Fallback if the Pyth SDK won't compile with Anchor 0.32.1

Write a minimal decoder for `PriceUpdateV2` in `oracle.rs` (owner check = Pyth receiver program id,
8-byte Anchor discriminator, `write_authority: Pubkey`, `verification_level` enum, `price_message` fields:
feed_id [u8;32], price i64, conf u64, exponent i32, publish_time i64, prev_publish_time i64, ema_price i64,
ema_conf u64; then `posted_slot` u64). Verify the layout against the receiver SDK source before using it,
and add a unit test that decodes a real account fetched from devnet.

## 8. Clearing algorithm (`clear_auction`)

Inputs: round with `cutoff_resolved`, `now >= reveal_end_ts`; `remaining_accounts` = Bid accounts.

1. Require `remaining_accounts.len() == round.bid_count`. For each: owner = program, deserialize `Bid`,
   `bid.round == round.key()`, PDA derivation matches `["bid", round, bid.bidder]`, no duplicates
   (track pubkeys in a small Vec). Any failure → `BidAccountsMismatch`.
2. Collect `valid && revealed` bids. Sort by `price_per_contract` desc, then `commit_ts` asc, then
   `bidder` bytes asc (deterministic).
3. `remaining = total_contracts`. Walk the list: `fill = min(bid.qty, remaining)`; set `won_qty = fill`;
   `remaining −= fill`; stop when `remaining == 0`.
4. `clearing = price of the last bid with fill > 0` (uniform price: every winner pays the clearing price).
   If no bid got a fill → `NoSale` (set `final_quote/final_underlying` snapshot, state `NoSale`).
5. For each winner: `paid = won_qty × clearing`. `sold_contracts = Σ won_qty`.
   `total_premium = sold_contracts × clearing`; `fee = total_premium × fee_bps / 10_000` (floor);
   `premium_to_users = total_premium − fee`.
6. Transfer `fee` escrow vault → treasury; `premium_to_users` escrow vault → premium vault.
7. Write each Bid back (mutable remaining accounts), state → `Cleared`, emit `AuctionCleared`.

Note on fill ratio: users don't receive per-user fills. Because every user in a round shares the same
pool, exercise effects are shared pro-rata at `claim` (final snapshot / total_contracts). This keeps claims
O(1) and avoids dust bookkeeping.

## 9. Events

`RoundCreated, Deposited, Withdrawn, BidCommitted, CutoffResolved{cutoff_ts}, BidRevealed{valid},
AuctionCleared{clearing, sold, premium_to_users, fee}, PremiumClaimed, Settled{price_per_contract,
publish_time, in_the_money}, Exercised, Finalized{final_quote, final_underlying}, Claimed, Refunded`

## 10. Errors (`LimitPlusError`)

`Unauthorized, Paused, WrongPhase, TooEarly, TooLate, InvalidTimeline, ZeroAmount, MathOverflow,
UnsupportedMintExtension, WrongMint, TooManyBids, CommitmentMismatch, BidAccountsMismatch,
OracleFeedMismatch, OracleOutsideWindow, OracleConfidenceTooWide, OracleInvalidPrice, NotInTheMoney,
NothingToExercise, AlreadyExercised, ExerciseWindowClosed, AlreadyClaimed, AlreadyRefunded`

## 11. Invariants (assert in tests)

1. Quote vault ≥ Σ outstanding quote claims; underlying vault ≥ Σ outstanding underlying claims (floor makes
   Σ payouts ≤ snapshot).
2. Escrow vault after clear = Σ(escrow − paid) over all bids (i.e. exactly enough for refunds).
3. Premium vault = premium_to_users − Σ premium claimed.
4. `sold_contracts <= total_contracts`; `exercised_contracts <= sold_contracts`.
5. BuyLower before exercise: quote vault == total_contracts × strike. SellHigher: underlying vault ==
   total_contracts × contract_size_raw.
6. State only moves forward.

## 12. Off-chain components (TypeScript)

- `packages/sdk`: PDA derivation, `computeCommitment(round, bidder, price, qty, salt)` (must match the
  program byte-for-byte — add a cross-check test), instruction builders, account fetch/decoders.
- `packages/pricing`: Black-Scholes (put + call), realized vol from recent daily closes (Pyth benchmarks
  if available; otherwise a configurable vol), `fairPremiumPerContract(...)`, `reservePremium = 0.5 × fair`.
  It's a model estimate: the UI must show its inputs (spot, strike, vol, time, rate).
- `bots/mm-bot.ts`: computes fair value, bids `fair × (1 − edge)` for `size` contracts, stores the salt in
  `.bids/<round>-<name>.json` (gitignored), reveals during Reveal, exercises if ITM, claims refund.
- `bots/keeper.ts`: polls the round and calls `resolve_cutoff`, `clear_auction`, posts Pyth update +
  `settle`, `finalize` at the right times. Idempotent; safe to run several copies.

## 13. Out of scope for the prototype (say so if judges ask)

Permissionless round creation, more than 20 bids per round, option tokens (rights are tied to the Bid
account), non-reveal penalties, Scaled UI multiplier changes mid-round (we assume constant within a
week), audits, mainnet launch.
