# Limit+

**Paid limit orders for tokenized stocks on Solana.**

Name your price for a stock token. Market makers pay you for the right to trade at it, decided in a sealed-bid auction that closes at a random moment. At Friday's official close you either buy at your price or get your money back, and you keep the payment either way.

Built for **Hack in Hills**. Prototype status: see [Project status](#project-status).

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Solana](https://img.shields.io/badge/Solana-Anchor%200.32.1-9945FF)
![Status](https://img.shields.io/badge/status-prototype-orange)

<p align="center">
  <img src="docs/images/pools-board.png" alt="The pools board" width="46%" />
  <img src="docs/images/mobile-order-ticket.png" alt="The order ticket on mobile" width="17%" />
</p>

## The problem

A limit order is a free option you give the market: you say "I'd buy NVIDIA at $171" and then wait, sometimes all week, earning nothing. The few products that pay you to wait are custodial, and the venue sets the price.

## How Limit+ works

1. **You deposit and name a price.** Buy lower: deposit USDC for the price you want to buy at. Sell higher: deposit the stock token for the price you want to sell at.
2. **Market makers bid in a sealed auction.** Bids are committed as hashes with USDC in escrow, so nobody sees anyone else's price.
3. **The auction ends at a random moment.** A cutoff is drawn after bidding ends, so waiting until the last second cannot help. Bids placed after the cutoff do not count.
4. **One price clears for everyone.** Winners all pay the same clearing price. The proceeds, minus a protocol fee, are yours to claim.
5. **Friday's official close decides.** Pyth's closing price settles the round. If it crossed your price, the winning bidders exercise and you end up with the stock at your price. If not, you get your collateral back. Either way you keep the payment.

```mermaid
flowchart LR
  U["User wallet"] -->|"deposit USDC or stock token"| V["Round vaults (PDAs)"]
  B["Market-maker bots"] -->|"sealed bids + USDC escrow"| A["Auction: random close, one clearing price"]
  A -->|"payment to users"| U
  O["Pyth: official close price"] --> S["Settle at Friday close"]
  V --> S
  S -->|"stock at your price, or money back"| U
  K["Keeper bot"] -.->|"permissionless cranks"| A
  K -.-> S
```

Each round is one stock, one side, one price and one expiry, and all users in a round share the same outcome pro rata.

## What is in this repository

| Path | What it is |
|---|---|
| `programs/limit_plus` | The Anchor program: rounds, vaults, sealed-bid auction, clearing, settlement, claims |
| `packages/sdk` | TypeScript client: PDAs, instruction builders, account decoders, bid commitment hashing |
| `packages/pricing` | Black-Scholes fair value, realized volatility, reserve price, live price lookup with fallbacks |
| `packages/radar` | The Risk radar: TinyFish web search turned into a Calm, Watch or High risk verdict |
| `bots` | The worker: market-maker bots, a permissionless keeper, the demo director, faucet and radar service behind a small HTTP API |
| `app` | Next.js frontend, built from the "Obsidian & Flame" design system |
| `scripts` | Local demo, round creation, Pyth settle script, seed script |
| `tests` | Integration tests that warp the clock through a full round (LiteSVM) |
| `video` | Remotion project for the pitch video |
| `docs` | Spec, test plan, design system, demo script, changelog |

## Quick start

Prerequisites: Rust, Solana CLI, Anchor CLI **0.32.1**, Node 20+, yarn (classic). `scripts/setup.sh` installs the toolchain.

```bash
yarn install

# Program build with the mock oracle (used by tests and the local demo).
# --arch v0 matters: newer Solana toolchains default to SBPF v3, which LiteSVM 0.3.x cannot load.
anchor build --no-idl -- --features mock-oracle --arch v0

# Everything: Rust unit tests, integration tests, SDK and pricing tests
./scripts/test.sh

# A compressed end-to-end round on a local validator (about 2 minutes)
yarn ts-node -P tsconfig.json scripts/demo-run.ts

# The frontend (shows example data until NEXT_PUBLIC_RPC_URL points at a chain)
yarn workspace app dev
```

To see a live round in the UI, run `scripts/seed-localnet.ts --user <YOUR_WALLET>`, build the app with `NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8899`, and set your wallet to localnet.

## Tests

| Layer | What it covers | Result |
|---|---|---|
| Rust unit tests | Fixed-point math, settlement price, fee split, cutoff derivation, commitment hash, Pyth decoder | 11 passing |
| Integration (LiteSVM) | Full lifecycle for both sides, in-the-money and out-of-the-money, partial fills, invalid and late bids, wrong salts, oracle checks, double claims, pause, unsupported mints, no-sale, plus the protocol invariants after each step | 21 scenarios passing |
| SDK and pricing | The TypeScript bid hash matches the Rust vector, Black-Scholes values | 7 passing |
| End to end | `scripts/demo-run.ts` runs a compressed round on a local validator with two bots and two concurrent keepers | Passing |

See [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) for the test list and [`docs/SPEC.md`](docs/SPEC.md) section 11 for the invariants.

## Design highlights

- **All money moves onchain.** Deposits, escrow, clearing, settlement and payouts are program instructions. Vaults are program-derived accounts owned by the round.
- **Sealed-bid, uniform-price auction.** Bids are `keccak256(round, bidder, price, qty, salt)` commitments. Clearing is deterministic: price descending, then commit time, then bidder.
- **Random close.** The cutoff is derived after bidding ends from the SlotHashes sysvar. The known limitation (a slot leader could bias it) is documented in the spec.
- **Pyth settlement.** The program decodes `PriceUpdateV2` directly, accepts only fully verified updates, and checks the feed id, publish time window and confidence.
- **Token-2022 aware.** Transfers use `transfer_checked` with each mint's own token program. Mints with transfer fees, hooks, interest bearing or other unsafe extensions are rejected at round creation.
- **Safe arithmetic.** No `unwrap`, no unchecked math, floor rounding on every payout, and a rule that all math lives in pure, unit-tested functions.

## Risk radar (TinyFish)

Before you name a price, the **Risk radar** has already searched the open web with [TinyFish](https://www.tinyfish.ai) for what could move the stock before this round's Friday close: the next earnings date, announced stock splits, trading halts, ex-dividend dates and sharp moves in the news. Each stock gets **Calm**, **Watch** or **High risk** (always an icon plus a word), the events behind it and a link to every source.

It is built to be honest rather than reassuring:

- It reads the next earnings date after today and ignores last quarter's. When sources disagree it only raises a flag if a candidate date falls inside the round.
- Explainer pages ("what investors need to know about the split") are not news. A split or dividend only counts when it is announced.
- If any search fails it says **Not checked**. It never reports Calm on missing data.
- The worker refreshes it in the background and respects TinyFish's rate limit. The web app never calls TinyFish itself, and falls back to a saved snapshot that is labelled as saved.

Code: [`packages/radar`](packages/radar) (36 tests), [`app/components/RiskRadar.tsx`](app/components/RiskRadar.tsx).

## Live demo

A **Demo week** compresses a whole week into about three minutes on devnet with test money: connect a built-in wallet, get test USDC, deposit, watch two market-maker bots bid in secret, collect the payment, and see Friday decide. Script and what is real versus simulated: [`docs/LIVE_DEMO.md`](docs/LIVE_DEMO.md). Deploying it: [`docs/DEPLOY.md`](docs/DEPLOY.md).

[`docs/proof`](docs/proof) has recordings of a visitor playing a full week in a real browser, with balances checked on chain: 1,000 USDC became 3.67 USDC plus 7.21 NVDAx with 3.55 paid up front (stock falls), and 1,003.55 USDC (stock rises).

## Project status

This is a hackathon prototype.

Working and tested: the program (11 Rust tests and 21 integration scenarios), the SDK, the pricing engine, the Risk radar, both bots, a worker with a faucet and a one-click demo, and the frontend. The worker and API run against a real validator in an 18-check end-to-end test that plays two full weeks, restarts the service mid-week and checks every payout. A browser test plays a visitor through the whole product, recorded.

Fixed on top of the original prototype: hydration errors on three pages, a canvas crash on the landing page, a Friday-close countdown that was a week off on Fridays, and live prices (Pyth's public Hermes API now answers 401 to anonymous callers, so prices go through a server route with a Yahoo Finance fallback).

Not done yet:
- **Real Pyth settlement.** The demo uses a mock oracle so a week fits in minutes. The Pyth decoder is verified against Pyth's source and unit-tested, but a real settle has not been run, and Pyth's public Hermes endpoint now needs a key.
- **Phantom on devnet.** The demo wallet is tested end to end in a browser. Phantom itself has not been driven by an automated test.
- **Out of scope for the prototype:** permissionless round creation, more than 20 bids per round, tradable option tokens, penalties for unrevealed bids, and an audit. See [`docs/SPEC.md`](docs/SPEC.md) section 13.

## Security and disclaimer

Limit+ has **not been audited** and must not be used with real funds. A token issuer with a permanent delegate can move tokens out of any account, including the vaults. Prices and payments shown in the app and the promotional video use **example numbers**. Nothing here is financial advice. Company names and logos are trademarks of their owners and are not affiliated with this project, see [`NOTICE.md`](NOTICE.md).

## Documentation

- [`docs/SPEC.md`](docs/SPEC.md): the protocol specification
- [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md): every test and what it proves
- [`docs/DESIGN.md`](docs/DESIGN.md): the design system and mockups in `docs/mockups`
- [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md): the pitch demo script
- [`docs/LIVE_DEMO.md`](docs/LIVE_DEMO.md): the three-minute live demo, step by step
- [`docs/DEPLOY.md`](docs/DEPLOY.md): deploying to devnet, Render and Vercel, and running everything locally
- [`docs/CHANGELOG.md`](docs/CHANGELOG.md): what changed in each phase
- [`docs/video`](docs/video): the pitch video script

## Team

Built by team MomoX for Hack in Hills.

## License

[MIT](LICENSE)
