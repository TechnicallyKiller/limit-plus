# Live demo: a whole week in three minutes

The demo runs on devnet with test money and a simulated Friday price, so a week fits in about three minutes. Everything you
click is the real product: the real program, real sealed bids from two market-maker bots, real settlement and real claims.

## Before you start (one minute)

- Open the site and the **Demo** tab. The page says whether the demo service is reachable.
- Nothing to install. The demo wallet lives in the browser. (Phantom works too, on devnet.)
- If a week is already running, join it. If not, you start one.

## The script

| Time | You do | What the audience sees | What to say |
|---|---|---|---|
| 0:00 | Open **Pools**. Point at the Risk radar pill on the NVDAx pool. | Pools board, a Calm or Watch pill with an icon and a word. | "You name a price for a stock and get paid to wait. Before you do, the Risk radar has already searched the web for earnings dates, splits and halts." |
| 0:20 | **Demo** tab, **Use the demo wallet**, **Get 1,000 test USDC**. | Wallet connects, funds arrive. | "No signup, no real money. This wallet exists only in this browser." |
| 0:40 | Pick **Stock rises, money back** first, press **Start a demo week**. | A live activity feed starts. | "A compressed week. A market maker bot is about to bid on your order." |
| 1:00 | **Open the round and deposit**, press **Deposit**. | Deposit confirms, explorer link appears. | "My $1,000 sits in a vault only the program controls. I named a price 5% below the stock." |
| 1:30 | Watch the round page. Open the **Risk radar** panel. | Sealed bids appear, the candle ring burns down. | "Two bots bid in secret. The auction closes at a random moment, so waiting until the last second does not help. The radar panel shows where each warning came from." |
| 2:30 | Auction clears. **Portfolio**, press **Claim**. | "You were paid" amount lands in the wallet. | "One price cleared for everyone. This payment is mine whatever happens Friday." |
| 3:00 | Round reaches **Final**. **Portfolio**, press **Claim** again. | The dollars back in the wallet (or the stock token, in the buy ending). | "Friday's close was above my price, so I get my dollars back, and I kept the payment either way." (In the buy ending: "below my price, so I bought NVDA at my price.") |

Run it a second time with **Stock falls, you buy**. Do the "money back" ending first: it leaves the wallet with about $1,003 to deposit again, whereas the buy ending spends the dollars on the stock and the faucet gives the same wallet funds only once every ten minutes. To start fresh, open a private window (a new demo wallet).

## What is real and what is simulated

- Real: the Anchor program, sealed-bid commitments, the random close, clearing, settlement math, escrow and every claim.
- Simulated: the Friday official-close price (a mock oracle posts it so the week fits in minutes), and the tokens (mock USDC and a
  mock NVDAx with no value). The starting NVDA price is the live market price.
- Not audited. Do not put real funds anywhere near it.

## If something goes wrong

| Symptom | Fix |
|---|---|
| "The demo service is not reachable" | The worker is waking up (free hosting sleeps). Wait 30 seconds, it retries by itself. |
| "A demo week is already running" | Join it from the Demo tab, or wait for it to finish (about three minutes). |
| "This wallet already got test funds" | The faucet allows one claim per wallet every ten minutes. Use the funds you have, or open a private window to get a new demo wallet. |
| Deposit fails with insufficient funds | Press **Get 1,000 test USDC** first. |
| Everything is frozen | Play the recorded runs in `docs/proof/demo-buy` and `docs/proof/demo-skip` (about 3 minutes each). |

## Proof it works

`docs/proof` holds two recordings of a visitor playing a full week in a real browser, each ending with a balance check on chain:

- `demo-buy` and `demo-skip`: on a local chain. `devnet-buy` and `devnet-skip`: on the public site and real Solana devnet.
- `demo-buy`: 1,000 USDC became 3.67 USDC plus 7.21 NVDAx, with 3.55 USDC paid up front.
- `demo-skip`: 1,000 USDC became 1,003.55 USDC, no stock.
