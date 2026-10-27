---
description: Phase 4 — TS SDK, pricing engine, market-maker bot, keeper, demo-run script
---
Phase 4: off-chain pieces. Read docs/SPEC.md §12 and docs/DEMO_SCRIPT.md.

1. `packages/sdk`: PDA helpers, `computeCommitment` (byte-identical to the program; test X1 against the Rust vector),
   typed instruction builders for every instruction, account fetchers, a `phaseOf(round, now)` helper.
2. `packages/pricing`: Black-Scholes put/call, realized volatility from recent daily closes (try Pyth's historical
   benchmarks API; if unavailable, a `--vol` override and a documented default), `fairPremiumPerContract`,
   `reservePremium = 0.5 × fair`. Unit tests against known Black-Scholes values.
3. `bots/mm-bot.ts --name <n> --edge <0..1> --size <contracts> --round <pubkey>`: lifecycle commit → reveal → exercise
   if ITM → claim refund. Salt saved in `.bids/`. Clear, judge-friendly console logs (no jargon in log lines that
   start with `»`; those are what we show on screen).
4. `bots/keeper.ts --round <pubkey>`: idempotent crank loop for resolve_cutoff, clear_auction, settle (mock or Pyth by
   cluster), finalize. Retries with backoff; never crashes on "already done".
5. `scripts/create-round.ts` (uses pricing to set strike from live spot × (1 − pct), reserve, fair premium; accepts
   compressed demo timings) and `scripts/demo-run.ts` (localnet end-to-end, test X4).
6. Run X1–X4 and report.
Extra instructions: $ARGUMENTS
