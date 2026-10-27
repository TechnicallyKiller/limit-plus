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
