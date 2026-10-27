# Changelog

## Phase 0-2: scaffold, program, integration tests
- Monorepo skeleton (programs/limit_plus, packages/sdk, packages/pricing, bots, app, config).
- Full Anchor program per SPEC (17 instructions, `set_mock_price` behind feature `mock-oracle`).
- Pyth `PriceUpdateV2` decoded manually in `oracle.rs` (SPEC §7.4 fallback; no SDK dependency).
- Unit tests U1-U7, O3; integration tests I1-I19, I21 in `tests/limit-plus.ts` (LiteSVM, clock warping); X1 in `packages/sdk/test`.
- Deviations from SPEC (all small, SPEC updated): `Config.quote_mint` added; `AlreadyRevealed`, `FeeTooHigh`, `RandomnessInvalid` errors added;
  state stays `Deposit` through the bidding window (Bidding is time-derived) and moves to `Reveal` at `resolve_cutoff`;
  `solana-keccak-hasher` added as a direct dependency (it is what `solana_program::keccak` re-exports);
  Cargo.lock pins `zeroize`/`blake3` to versions the SBF toolchain's Cargo 1.84 can parse.

## Phase 3-4: oracle, pricing, bots, keeper, demo-run
- Pyth `PriceUpdateV2` layout verified against pyth-crosschain SDK source; receiver id and NVDA feed ids saved with sources in `config/addresses.*.json`.
- `packages/pricing` (Black-Scholes, realized vol, fair/reserve), `bots/mm-bot.ts`, `bots/keeper.ts`, `scripts/create-round.ts`, `scripts/post-price-and-settle.ts`.
- X1, X2, X3, X4 pass: `scripts/demo-run.ts` completes a compressed round on a local validator in about 2 minutes.
- Not done yet: O2 (needs devnet SOL for the program deploy; wallet had about 1 SOL).

## Phase 5: frontend ("Obsidian & Flame")
- Next.js 15 App Router + Tailwind v4 (`app/styles/tokens.css` from DESIGN.md §2), Archivo + Martian Mono, Phantom and Solflare only.
- Pages: `/` (halftone wordmark, live board, how a week works), `/pools` (treemap + list), `/round/[pubkey]` (sealed-bid stage, candle ring, fair-price check, order ticket, bottom sheet on mobile), `/portfolio` (ticket cards, claim).
- Reads live rounds through `packages/sdk` when `NEXT_PUBLIC_RPC_URL` is set; otherwise shows clearly marked example data.
- QA: Playwright screenshots at 1440x900 and 390x844 reviewed; no banned words (F2), no em/en dashes, one iridescent element per viewport, no horizontal scroll, 2px flame focus ring.
- Known gaps: F1 (wallet deposit on devnet) and O2 (Pyth settle on devnet) are not run: the deploy wallet had about 1 SOL and a program deploy needs about 3.
