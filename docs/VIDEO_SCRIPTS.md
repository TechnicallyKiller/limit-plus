# Limit+ video scripts

Two videos. Both use the Obsidian & Flame look: obsidian black, bone text, flame orange only for the candle and the one thing that matters, volt and iris for pools, amber for money paid to you. All on-screen text is sentence case with no dashes.

Masters at 1920x1080 at 30 fps, with a 1080x1920 vertical cut of the pitch for socials. Music at 128 BPM so every cut lands on a beat.

---

## Video 1: Elevator pitch, 60 seconds

One idea: **waiting is free money you are leaving on the table, and Limit+ pays you for it.**

| Time | On screen | Voice over | Sound |
|---|---|---|---|
| 0:00 to 0:06 | Black. Tickers pop onto a faint dot field one after another, each landing with a spring overshoot: NVDAx, TSLAx, AAPLx, MSFTx, COINx, METAx, AMDx, GOOGLx. Every tile ticks its price. The pops accelerate until the screen is full of colour (volt and iris tiles). | "Every stock is a token now." | A kick on each pop, rising riser |
| 0:06 to 0:12 | Everything freezes mid-tick. A dashed flame line appears across each tile: a limit order. A clock ticks in the corner. The colours drain to grey one tile at a time. A counter in the middle reads $0.00 and does not move. | "And every limit order does the same thing. It waits. And pays you nothing." | Riser cuts to silence, then one slow clock tick |
| 0:12 to 0:17 | Hard glitch cut. The grey dots rush inward and assemble into the halftone **limit+** wordmark, the plus lighting up flame. The dot field behind it wakes up. | "Limit plus." | Bass drop on the plus |
| 0:17 to 0:21 | Tagline types in under the wordmark. | "Get paid to wait." | Beat settles |
| 0:21 to 0:31 | The NVDAx tile expands to fill the screen. A price slider is dragged from $180 down to $171. A big amber counter rolls up: $6.20. Dots stream from the tile into a wallet icon. | "Name your price for a stock. Market makers pay you now, while you wait." | Coin ticks on each digit |
| 0:31 to 0:42 | 3D room: glass cards with a hatch pattern drop into the dark and hover face down. A flame burns along a ring. It goes out at an unpredictable moment: hard cut to black for half a second. Lights back on, the cards flip with a stagger, stack into a ladder, and a glass plane slides across: "Everyone pays 0.62%". | "They bid in a sealed auction that ends at a random moment. Nobody can game it." | Whoosh per card, a hard snuff when the flame goes out, glass chime on the flip |
| 0:42 to 0:52 | Screen splits down the middle. Left: "Friday close $165" and a stock icon landing in a wallet with "5.84 NVDAx at your price". Right: "Friday close $185" and "Your money back". Both halves share an amber line: "+ the $6.20 you were paid". | "Friday's official close decides. Stock at your price, or your money back. Either way, you keep what you were paid." | Two clean tones, one per half |
| 0:52 to 0:57 | The Solana, Pyth and explorer marks fade in as a row. Lines appear one by one: sealed bids, random close, settled onchain. | "All onchain. On Solana." | Soft pulse |
| 0:57 to 1:00 | Wordmark centred on the dot field. | "Limit plus. Name your price. Get paid while you wait." | Final hit and a 1 second tail |

Honest-copy notes: the payment is claimable once the auction clears (not at the moment you deposit), so the voice over says "pays you now, while you wait" about the experience, never "instantly at deposit". The $6.20, 0.62% and $165 numbers are example numbers and the end card should carry a small line: "Example numbers."

### How it gets made
- Build it as one HTML page animated with GSAP and CSS 3D (the same fonts, tokens and glass cards as the app), then record it frame by frame with Playwright and encode with ffmpeg. This keeps it pixel-identical to the product.
- The sealed-bid room reuses `AuctionStage` and the wordmark reuses `HalftoneWordmark`, so only the choreography is new.

---

## Video 2: How it works, 90 to 120 seconds

Laptop and phone side by side on a dark desk-like gradient, slightly angled, same round on both screens. Laptop shows the app. Phone shows the mobile layout, the bottom sheet and the wallet confirmation. A thin flame line connects the two devices when something travels between them.

| Time | Laptop | Phone | Caption (burned in) |
|---|---|---|---|
| 0:00 to 0:08 | Pools board treemap fills in, tiles pop in by size. Cursor lands on NVDAx. | Landing page with the halftone wordmark. | "Pick a pool." |
| 0:08 to 0:22 | Round page: price chart with the dashed "your price" line at $171. | Same round. Taps Deposit. The bottom sheet slides up with the amount, the two possible Fridays and the risk line. | "Name your price." |
| 0:22 to 0:30 | A pool counter ticks up as the deposit lands. | Wallet confirmation. Button goes loading, then mint "Deposited". | "Deposit." |
| 0:30 to 0:50 | Sealed bids drop into the 3D stage one by one. Bot terminal strip along the bottom shows "alpha: sealed bid placed". | Notification: "Bidding is open". | "Market makers bid in secret." |
| 0:50 to 1:05 | The candle ring burns toward the end and goes out at a random moment. The page shows "Closed at 14:32:07". Cards flip, ladder, clearing plane. | Same moment, phone shows the clearing price. | "The auction ends at a hidden moment." |
| 1:05 to 1:20 | Fair-price check needle settles: "You were paid 4.1% above the model's fair value." | Portfolio: ticket moves to Paid, Claim button glows with the iridescent rim. | "You get paid now." |
| 1:20 to 1:40 | Friday close price lands (settle). Settlement panel: "$165.00, below your price, so you buy NVDAx at $171." | Ticket moves to Settled. Taps Claim. | "Friday's close decides." |
| 1:40 to 1:50 | Explorer opens on the claim transaction. | Ticket becomes Claimed. | "Everything is onchain." |
| 1:50 to 2:00 | Wordmark and tagline. | | "Limit+. Name your price. Get paid while you wait." |

### How it gets made
- Record the real app with Playwright against the local chain (`scripts/seed-localnet.ts`): a 1440x900 laptop session and a 390x844 phone session at the same time, driven by a script so both clips share a clock.
- The device frames, the angle, the flame line between devices and the captions are layered in a second HTML page and rendered to video, so nothing in the video is a fake screenshot.
- Compressed round timings (about 2 minutes for the whole auction) make it possible to capture one continuous take.

---

## Decisions I need from you
1. Voice over: you record it yourself, or should I write the final VO lines word for word with timing marks? (Written above as a first pass.)
2. Music: royalty-free track you pick, or should I leave silent stems with beat markers for you?
3. Output sizes: 16:9 master plus 9:16 pitch cut, or something else?
