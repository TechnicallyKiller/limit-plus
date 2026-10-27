# Demo Script (3 minutes + Q&A)

Goal: judges see a real order go from "name your price" to "paid" to "settled", fully onchain, in plain words.

## Before you walk up (T−30 min)

- [ ] Devnet program deployed; program ID matches `Anchor.toml`, `app/.env.local`, `config/addresses.devnet.json`.
- [ ] **Round A (live)** created ~20 min earlier with compressed timings: deposits open now, bidding starts in
      ~4 min, candle window 2 min, reveal 1 min, expiry ~8 min after that. Strike ≈ 5% below the live NVDA price.
- [ ] **Round B (already settled)** created the day before: expiry passed during US market hours, settled with a
      real Pyth NVDA price. Some users not yet claimed — you'll click "Claim" live.
- [ ] Two bots ready in two terminals (`alpha` edge 0.10, `beta` edge 0.20), keeper running in a third.
- [ ] Phantom on devnet with mock USDC; browser zoom 125%; explorer tab open.
- [ ] Backup: screen recording of the full flow (≤ 90 s) on the laptop desktop.

## The 3 minutes

| Time | Say | Show |
|---|---|---|
| 0:00 | "Tokenized-stock holders can't earn on their shares onchain. The only product that pays you to wait for a price is custodial, and the exchange sets the price." | Slide 2 for 10 seconds, then switch to the app |
| 0:20 | "I want NVIDIA 5% cheaper this week. I name my price and deposit 100 USDC." | Round A → Buy lower → deposit → wallet confirm |
| 0:50 | "Two market makers bid in a sealed auction. Nobody — not even them — knows when it closes." | Bot terminals: `committed`; app shows sealed bid count |
| 1:20 | "The random close just landed. Bids are revealed, everyone pays one clearing price." | Round A: cutoff time, revealed bids table, clearing price |
| 1:45 | "I'm paid immediately. And here's what's new: a fair-price check. I got X% versus the model's fair value — that's the overpricing problem from the research, made visible." | Claim premium → fair-price badge with inputs |
| 2:15 | "This round already settled on NVIDIA's real closing price from Pyth. One click, I get my stock or my money back." | Round B → settlement price + publish time → Claim → explorer link |
| 2:45 | "Matching, settlement and payout — all onchain on Solana. Thank you." | Explorer transaction list for the round |

## If something breaks

- Wallet popup hangs → refresh, switch to the pre-funded second browser profile.
- Bots don't commit in time → say "the bots are a little slow today", run `yarn ts-node bots/mm-bot.ts ...` manually, or
  jump to Round B and play the recording for the auction part.
- Devnet RPC down → switch `NEXT_PUBLIC_RPC_URL` to the backup RPC; worst case play the recording.

## Likely judge questions (have one-line answers)

- **"Isn't this centralized because of the oracle/bots?"** The oracle only provides the official closing price,
  which no chain can produce; bots are ordinary participants. Matching, custody and settlement are onchain.
- **"Who buys these?"** Market makers that already quote xStocks and hedge with equity perps; later, retail
  "upside tickets".
- **"Can users lose money?"** Yes — if the stock falls far below their price they still buy at their price, just
  like a limit order. The screen says this before they deposit.
- **"Why random close?"** Predictable auction times let bidders game the price; research on DeFi option vaults
  showed this cut yields. A random cutoff removes the incentive.
- **"Why real stocks and not crypto?"** Proven demand: Bybit's centralized version expanded from 6 to 10
  tokenized stocks in about two weeks.
