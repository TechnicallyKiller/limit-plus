---
description: Phase 1 — implement the Anchor program exactly as docs/SPEC.md describes (mock oracle first)
---
Phase 1: the onchain program. Read CLAUDE.md, then docs/SPEC.md completely. Treat SPEC.md as the contract.

Work in this order and pause for my approval after the plan and after step 3:

1. **Plan**: list every account struct, instruction, error and event you will write, mapped to SPEC sections.
   Call out anything ambiguous in the spec as a question before coding.
2. `math.rs` first: settlement price conversion (§7.3), pro-rata payout, fee split, premium per user,
   cutoff derivation (§6), commitment hash (§5 reveal_bid). Pure functions + unit tests U1–U7 from docs/TEST_PLAN.md.
   Run `cargo test -p limit_plus` until green.
3. `state.rs` (§3.2 with InitSpace), `errors.rs` (§10), `events.rs` (§9), phase helpers (§4.2).
4. Instructions, one file each, in this order: initialize_config, update_config, create_round (with §3.3 mint
   checks and the 4 vaults), deposit, withdraw, commit_bid, resolve_cutoff (SlotHashes MVP, §6), reveal_bid,
   clear_auction (§8), claim_premium, claim_refund, settle (via oracle.rs; mock path behind `mock-oracle`),
   expire_without_price, exercise, finalize, claim, set_mock_price (feature-gated).
5. `oracle.rs`: implement the trait/function from §7.1 with the mock path now; leave the Pyth path as a clearly
   marked stub that returns an error until Phase 3.
6. `anchor build` with and without `--features mock-oracle` must both succeed with no warnings in our code.

Rules: follow every "Hard rules for program code" item in CLAUDE.md. No inline math in instructions.
Every transfer uses `transfer_checked` with the mint's own token program.
When done, append to docs/CHANGELOG.md and list any deviations from SPEC.md (there should be none, or SPEC was updated first).
Extra instructions: $ARGUMENTS
