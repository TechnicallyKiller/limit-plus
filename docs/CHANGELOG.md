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

## Pitch video
- `video/` is a Remotion project (React) that renders the 1 minute pitch from the same design tokens as the app. Sound design, particle fire and the beat-locked edit are code, not footage.
- Scripts and delivery notes live in `docs/video`.
- Media (renders, voice recordings, music) is intentionally not in the repository.

## Ship to devnet

- **Risk radar**: `packages/radar`, TinyFish Search turned into a Calm, Watch or High risk verdict per stock, with sources. Honest by design: never Calm on missing data, next earnings only, announced events only.
- **Worker** (`bots/worker.ts`): radar refresher, demo director, keeper, two market-maker bots, faucet and a small HTTP API with rate limits and a shared secret. Restart safe: the outcome rides in the round id, bid salts are derived, `resume()` picks a round back up.
- **Demo week**: a built-in wallet, a faucet, a one-click compressed week and a Demo page. `docs/LIVE_DEMO.md` is the script.
- **Program id** is now `HzCjmdAX5qrDgX8eEgJ6oBBJLy9nWqtE3wTVcdzQeVkB`. The original keypair was not in the repo, so the id was synced to one we hold.
- **Build**: `--arch v0` (newer Solana toolchains default to SBPF v3, which LiteSVM 0.3.x cannot load).
- **Fixes to the prototype**: React hydration errors (prerendered pages read the build-time clock), a halftone canvas crash, a Friday-close countdown that was a week off on Fridays and ignored winter time, and live prices (Pyth's public Hermes endpoint now returns 401, so prices come from a cached server route with a Yahoo Finance fallback).
- **Tests added**: 36 radar, 7 spot price, 18 worker end-to-end checks on a real validator, 40 radar UI checks, a 14-page design-rule capture, and a recorded browser run of both demo endings.
