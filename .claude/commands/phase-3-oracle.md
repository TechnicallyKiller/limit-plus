---
description: Phase 3 — real Pyth settlement (devnet), with the decoder fallback if needed
---
Phase 3: Pyth integration. Read docs/SPEC.md §7 and CLAUDE.md "Stack".

1. Add `pyth-solana-receiver-sdk` (latest version compatible with anchor-lang 0.32.1). Run `anchor build`.
   If dependency resolution fails, do NOT bump Anchor: implement SPEC §7.4 (manual PriceUpdateV2 decoder) instead,
   verified against the SDK source, and add test O3.
2. Implement the Pyth path of `oracle::read_price`: owner = Pyth receiver program, full verification level,
   feed id match, then §7.2 checks in `settle`.
3. Look up (do not guess) the NVDA equity feed id via Hermes: `GET https://hermes.pyth.network/v2/price_feeds?query=NVDA&asset_type=equity`.
   Save it with its source URL in `config/addresses.devnet.json` and `config/addresses.mainnet.json`.
4. Write `scripts/post-price-and-settle.ts`: fetch `GET /v2/updates/price/{expiry_ts}?ids[]=<feed>` from Hermes, post it
   with `@pythnetwork/pyth-solana-receiver` into a price update account, then call `settle` in the same or next tx.
   Note: equity feeds only update during market hours — expiry must fall inside US trading hours.
5. Run O1 (IDL check) and O2 on devnet with a compressed demo round. Show me the settle transaction signature.
Extra instructions: $ARGUMENTS
