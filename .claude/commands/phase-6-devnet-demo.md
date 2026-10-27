---
description: Phase 6 — deploy to devnet, seed demo rounds, rehearse the judging demo
---
Phase 6: devnet deployment and demo prep. Read docs/DEMO_SCRIPT.md.

1. Confirm `solana config get` points to devnet and the deploy wallet has enough SOL (`solana balance`).
   If not, stop and tell me (faucet: https://faucet.solana.com).
2. `anchor build` (WITH `--features mock-oracle` only if we decide the demo uses mock prices; default is Pyth),
   `anchor deploy --provider.cluster devnet`. Update program ID everywhere (Anchor.toml, lib.rs, app env, config).
3. Create devnet mock USDC + mock NVDAx (Token-2022 + ScaledUiAmount), fund 3 demo wallets and 2 bot wallets.
4. Create Round B (settled, for the claim demo) and a script `scripts/seed-round-a.ts` that creates Round A with
   compressed timings relative to "now" so we can launch it 20 min before judging.
5. Write `docs/RUNBOOK.md`: exact commands, in order, for demo day, including the backup steps.
6. Do a full rehearsal following docs/DEMO_SCRIPT.md and list anything that took longer than its time slot.
Never deploy to mainnet in this phase.
Extra instructions: $ARGUMENTS
