---
description: Phase 0 — turn the fresh Anchor project into the Limit+ monorepo skeleton
---
Phase 0: scaffold. Read CLAUDE.md and docs/SPEC.md §3 and §12 first.

Context: the human already ran `anchor init limit-plus` and copied this kit (CLAUDE.md, docs/, .claude/, scripts/) into it.

Do this, in order, and show me a plan before editing anything:

1. Verify toolchain: run `anchor --version`, `solana --version`, `rustc --version`, `node --version`, `yarn --version`.
   Anchor CLI must be 0.32.1. If not, stop and tell me to run `avm install 0.32.1 && avm use 0.32.1`.
2. Rename/confirm the program crate as `limit_plus` under `programs/limit_plus`. Pin `anchor-lang` and `anchor-spl`
   to `0.32.1` with features `init-if-needed` (anchor-lang) and `token_2022`/`token_2022_extensions` as needed (anchor-spl).
   Add a cargo feature `mock-oracle = []` (off by default).
3. Create the module files from CLAUDE.md "Repo layout" with stub contents that compile:
   `state.rs, errors.rs, events.rs, math.rs, oracle.rs, randomness.rs, instructions/mod.rs`.
4. Set up yarn workspaces: `packages/sdk`, `packages/pricing`, `bots`, `app` (app can be an empty placeholder for now).
   Shared `tsconfig.base.json`. Add `@coral-xyz/anchor@0.32.1` and `@solana/web3.js@^1` to sdk/bots.
5. Add `.gitignore` entries: `target/`, `node_modules/`, `.env*`, `keys/`, `.bids/`, `.anchor/`, `test-ledger/`.
6. Create `config/addresses.localnet.json` and `config/addresses.devnet.json` with placeholder keys and a `"source"`
   field per entry (no invented addresses — use `"TODO: look up"`).
7. Create `docs/CHANGELOG.md`.
8. `anchor build` must succeed. Then `anchor keys sync` so the program ID in `lib.rs` and `Anchor.toml` match.

Finish by printing: tree of the repo (depth 3), the program ID, and the exact commands that now work.
Extra instructions from the human (may be empty): $ARGUMENTS
