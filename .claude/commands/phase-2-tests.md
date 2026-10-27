---
description: Phase 2 — integration tests I1–I20 from docs/TEST_PLAN.md with clock warping
---
Phase 2: integration tests. Read docs/TEST_PLAN.md and docs/SPEC.md §11 (invariants).

1. Propose the test harness: prefer LiteSVM (Rust `litesvm` crate or the `litesvm` npm package) because tests must
   warp the clock across phases. If it can't load our program with Token-2022 + the mock oracle cleanly, fall back
   to `solana-test-validator`/surfpool with very short round timings. Tell me which and why, then wait.
2. Build fixtures: mock USDC (6 decimals, SPL Token), mock NVDAx (Token-2022, 8 decimals, ScaledUiAmount extension,
   multiplier 1.0), a TransferFee mint for I18, 3 funded users, 3 funded bidders, admin + treasury.
3. Write an `assertInvariants(round)` helper implementing SPEC §11 and call it after every step in I1–I5.
4. Implement I1–I20. Each test name starts with its ID (e.g. `I5_oversubscribed_partial_fill`).
5. Run the suite; fix program bugs you find (spec-compliant fixes only). Report a table: ID | pass/fail | note.

Do not weaken a test to make it pass. If you believe a test or the spec is wrong, stop and explain.
Extra instructions: $ARGUMENTS
