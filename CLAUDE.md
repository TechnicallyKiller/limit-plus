# CLAUDE.md — Limit+ (team MomoX)

You are helping a two-person hackathon team build **Limit+**: paid limit orders for tokenized stocks on Solana.
A user names a price for a tokenized stock (e.g. NVDAx), gets paid a premium upfront while they wait,
and at Friday's official close either gets the stock at their price or their money back. Market makers
buy that right in a **sealed-bid onchain auction** with a **random close time**. Everything that moves
money is onchain.

Hackathon track: "Fully onchain order books with matching and settlement handled onchain."

## Source of truth

1. `docs/SPEC.md` — protocol spec: accounts, instructions, state machine, math, invariants. **Read it before
   writing program code.** If you need to deviate, propose the change, update SPEC.md first, then code.
2. `docs/TEST_PLAN.md` — every test that must pass before a phase is done.
3. `docs/DESIGN.md` — the visual design system ("Obsidian & Flame"). **Read it before any frontend work.**
4. `docs/DEMO_SCRIPT.md` — what the judges will see. Build toward it.

## Stack (pinned — do not upgrade without asking)

| Layer | Choice | Why |
|---|---|---|
| Program | Rust + Anchor **0.32.1** (`anchor-lang`, `anchor-spl` 0.32.1, CLI 0.32.1 via `avm`) | Switchboard's SDK is not compatible with Anchor 1.0 |
| Token handling | `anchor_spl::token_interface` + `transfer_checked` | Underlying xStocks are Token-2022; USDC is classic SPL |
| Oracle | Pyth pull oracle: `pyth-solana-receiver-sdk` (`PriceUpdateV2`); TS: `@pythnetwork/hermes-client`, `@pythnetwork/pyth-solana-receiver` | Official close price |
| Randomness | MVP: SlotHashes sysvar (see SPEC §6). Stretch: Switchboard On-Demand | Random auction close |
| Local chain | Surfpool (`surfpool start`) or `solana-test-validator`; tests use LiteSVM where clock warping is needed | Fast, can fork mainnet |
| Client | TypeScript, `@coral-xyz/anchor` 0.32.1, `@solana/web3.js` **v1** | Anchor TS + Switchboard need web3.js v1 |
| Frontend | Next.js (App Router) + Tailwind v4 + Motion + `@solana/wallet-adapter-react` | Full list of approved UI deps: DESIGN.md §11 |
| Package manager | yarn (classic) workspaces | Installed by the Solana installer |

If `pyth-solana-receiver-sdk` conflicts with Anchor 0.32.1 dependency versions, do NOT bump Anchor.
Instead implement the fallback in SPEC §7.4 (manual `PriceUpdateV2` decoding behind the `oracle.rs` interface).

## Repo layout (target)

```
programs/limit_plus/src/
  lib.rs            # instruction entrypoints only (thin)
  state.rs          # Config, Round, Position, Bid, MockPrice
  errors.rs         # LimitPlusError
  events.rs         # emitted events
  math.rs           # all fixed-point math + unit tests (pure functions)
  oracle.rs         # price reading: Pyth + mock (feature "mock-oracle")
  randomness.rs     # cutoff randomness
  instructions/     # one file per instruction
tests/              # integration tests (TS or Rust LiteSVM)
packages/sdk/       # TS: PDA helpers, ix builders, account decoders, commitment hashing
packages/pricing/   # TS: Black-Scholes fair value, realized vol, reserve price
bots/               # mm-bot.ts (bidder), keeper.ts (permissionless cranks)
scripts/            # setup + localnet/devnet bootstrap + demo-run
app/                # Next.js frontend
docs/               # SPEC, TEST_PLAN, DEMO_SCRIPT
```

## Commands

```bash
anchor build                         # build program + IDL
anchor test                          # build + run tests on a local validator
anchor test --skip-local-validator   # run tests against an already running surfpool/validator
cargo test -p limit_plus             # pure Rust unit tests (math.rs)
anchor build -- --features mock-oracle   # build with the mock oracle (localnet/devnet demo ONLY)
./scripts/test.sh                    # mock-oracle build + cargo tests + integration (LiteSVM) + SDK/pricing tests
yarn ts-node -P tsconfig.json scripts/demo-run.ts   # compressed end-to-end round on a local validator (needs the mock-oracle build)
yarn workspace app dev               # frontend on localhost:3000 (NEXT_PUBLIC_RPC_URL empty = example data)
yarn workspace app build             # production build
yarn ts-node bots/keeper.ts --round <ROUND_PUBKEY>
yarn ts-node bots/mm-bot.ts --name alpha --edge 0.10 --round <ROUND_PUBKEY>
```
Keep this section accurate: if you add or change a command, update it here.

## Hard rules for program code

- No `unwrap()`, `expect()`, `panic!` or unchecked arithmetic in program code. Use `checked_*` and
  `u128` intermediates; map failures to `LimitPlusError::MathOverflow`.
- All math lives in `math.rs` as pure functions with unit tests. Instructions call them; they don't do math inline.
- Rounding: always floor amounts paid **out** of the program; never round in favour of the caller.
- Every account: verify PDA seeds + bump, owner, mint, and token program. Use `has_one` / `constraint`.
- Every instruction checks the round's phase/time window first (SPEC §4). Use the helper in `state.rs`.
- Token transfers: `transfer_checked` with the correct token program for that mint. Never assume SPL-Token.
- Reject underlying mints with extensions we can't handle safely (SPEC §3.3) at `create_round`.
- The `set_mock_price` instruction and `MockPrice` account exist **only** under `#[cfg(feature = "mock-oracle")]`.
- Emit an event for every state change (SPEC §9).
- Keep instructions small; one file per instruction under `instructions/`.

## Hard rules for everything

- Never invent addresses (mints, feed IDs, program IDs). Look them up from official sources, put them in
  `config/addresses.<cluster>.json` with a comment/source URL, and tell the human what you used.
- Never commit keypairs, `.env` files, or API keys. Keep `.gitignore` covering `*.json` keypairs in `keys/`, `.env*`, `.bids/`.
- Never deploy to mainnet or spend real funds unless the human explicitly says "deploy to mainnet" in this session.
- Ask before adding a dependency that isn't in the stack table.
- After each phase: run the phase's tests, then summarise what changed, what's left, and any spec deviations.
- If something in SPEC.md is ambiguous or wrong, stop and ask instead of guessing.

## UX language rules (frontend + bot logs shown to judges)

Visual rules live in `docs/DESIGN.md` (tokens, materials, components, banned patterns, QA loop). The wording rules:

Primary UI never says put, call, strike, premium, option, collateral. Use:
"Buy lower" / "Sell higher" / "Your price" / "You get paid now" / "Friday close" / "Fair-price check".
An "Advanced" toggle may show the technical terms. Always show this risk line on the deposit screen:
"If the price falls far below your price, you still buy at your price." (Buy lower)
"If the price rises far above your price, you still sell at your price." (Sell higher)

## Definition of done (per phase)

1. Builds with zero warnings in program code (`anchor build`).
2. All tests listed for that phase in `docs/TEST_PLAN.md` pass.
3. CLAUDE.md commands section is accurate.
4. A short changelog entry appended to `docs/CHANGELOG.md`.
