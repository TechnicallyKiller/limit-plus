# Claude Design prompts (optional: mock it up before Claude Code builds it)

Two prompts, used in the same Claude Design project. Prompt 1 sets the design system and the main screens.
Prompt 2 adds the remaining states, mobile screens and a component sheet. Attach your four reference screenshots to
Prompt 1. Save exports to `docs/mockups/` so Claude Code can match them.

Screen coverage (matches docs/DESIGN.md section 6 and docs/DEMO_SCRIPT.md):

| # | Screen | Prompt |
|---|---|---|
| 1 | Landing page, full (hero, live pools preview, how a week works, footer) | 1 |
| 2 | Pools board | 1 |
| 3 | Round page: deposit phase (before the auction) | 1 |
| 4 | Round page: reveal (3D auction stage) | 1 |
| 5 | Portfolio | 1 |
| 6 | Round page: cleared (price ladder, fair-price check, claim payment) | 2 |
| 7 | Round page: settled (official price, outcome, claim) | 2 |
| 8 | Mobile: pools board, round page with bottom-sheet ticket, portfolio | 2 |
| 9 | Component sheet: buttons, inputs, switch, ticket cards, empty, loading, error, wallet dialog | 2 |

## Prompt 1: design system + main screens

```
Design five desktop screens (1440 x 900, the landing page may be taller) for "Limit+", a Solana app where people
name a price for a tokenized stock (like NVDAx), get paid now while they wait, and at Friday's official close either
get the stock at their price or their money back. Market makers bid in a sealed auction that closes at a hidden
random moment (a "candle auction").

DESIGN SYSTEM, "Obsidian & Flame". Obsidian is glass made by fire. Three materials plus one accent:
- Obsidian: opaque cool black panels (#07070A page, #0E0E13 panels, #15151C raised), 28px radius, 1px hairline and
  an inset top highlight. No drop shadows on obsidian.
- Glass: translucent, blurred, refractive top edge. ONLY for things you touch or that float: buttons, the order
  ticket, sealed bid cards, nav pill, dialogs. Glass always has something behind it to blur.
- Pigment: flat saturated matte blocks, ONLY for data. Volt #C8F53C = Buy lower pools, iris #9C7CFF = Sell higher
  pools, amber #FFB547 = money paid to the user, mint #3DDC97 / rose #FF5470 for deltas. Text on pigment is black.
- Flame #FF5B22: the single brand accent. The candle, live state, focus rings, and an iridescent thin-film rim on
  the ONE primary button per screen.
Text is warm bone #EDE8DD, secondary #A39E94.
Type: Archivo (variable width; display at width 125, weight 900, tight tracking) for all text; Martian Mono with
tabular figures for numbers, prices and addresses only. Sentence case. No uppercase eyebrow labels.
Shape: curved and concentric. Panels 28px, tiles and cards 18px, inputs 14px, every button and chip a full pill.
Inner radius = outer radius minus padding.
Mix: minimal structure like a calm trading terminal (80% obsidian and bone, strict left alignment, generous space),
maximal data (huge mono numbers, a saturated treemap), brutal type (a giant halftone dot wordmark), glass, and one
real 3D scene. One loud moment per screen.
Shared nav on every screen: small "l+" mark left; glass pill nav right with "Pools", "Portfolio" and a wallet button.

SCREEN 1, Landing page (full page):
- Hero: "limit+" as a full-bleed halftone of bone dots on black over a faint dot grid; dots near the cursor pushed
  outward and tinted flame. Below, left-aligned: "Name your price for a stock. Get paid while you wait." and one
  iridescent glass pill button "Open the pools board".
- Section: a live preview of the pools board treemap (6 largest pools), titled "This week's pools".
- Section: "How a week works", the candle ring with five labeled steps in order: Deposit, Sealed bids, Random close,
  Get paid, Friday close.
- Footer: Docs, GitHub, "Prices from Pyth", a one-line risk disclaimer.

SCREEN 2, Pools board: top row of three big mono stats (Waiting in pools $2,418,930; Paid out this week $14,210 in
amber; Next Friday close 2d 04:12:09). Main area: a squarified treemap of ~10 pools (NVDAx, TSLAx, AAPLx, SPYx,
METAx, GOOGLx, MSTRx, AMZNx, CRCLx, HOODx), tile size = money waiting, color = side, each tile with ticker, a big
mono weekly payment rate like 0.62%, a small black pill like "-5.0%", and a small glass "+" button. Right column:
stock filter, a "Board | List" segmented control, and a preview of the selected pool.

SCREEN 3, Round page, deposit phase (NVDAx, Buy lower, auction not started): header with ticker, side chip, "Your
price $171.00", "-5.0% vs now", phase "Deposits open, bidding starts in 03:42"; a price sparkline with a dashed
flame line at your price. Left: the auction stage empty except a dot-grid floor and the text "Sealed bids appear
here when bidding starts". Below it the candle ring with the current phase highlighted. Right: sticky glass order
ticket with "Buy lower | Sell higher" pill switch, amount input with chips 100 / 500 / 1,000, "You get paid now"
shown as an amber range "$4.10 to $6.80, decided at the auction", two outcome cards ("If NVDA closes at or below
$171.00 you get 5.84 NVDAx" / "If it closes above you get $1,000 back"), the risk line "If the price falls far
below your price, you still buy at your price.", and the iridescent "Deposit" button.

SCREEN 4, Round page, reveal: same layout. The stage is a 3D field of floating glass cards (sealed bids) over the
dot-grid floor, half flipped to show prices in big mono, two dimmed and pushed back labeled "After the close". The
candle ring shows a notch "Closed at 14:32:07". The ticket shows "Your deposit $1,000" and a disabled glass button
"Deposits closed".

SCREEN 5, Portfolio: totals row in big mono (Paid to you so far $38.70 in amber; Waiting $1,500.00; Claimable
$1,006.20). Below, a stack of horizontal glass "tickets", each split by a perforated line of dots into a stub
(stock, side, status chip: Waiting, In auction, Paid, Settled, Claimed) and a body (deposit, paid now, Friday
outcome, explorer link). The first claimable ticket has the iridescent "Claim" button; others use plain glass.

Avoid: Inter, Space Grotesk, Geist, serifs, purple-blue glow gradients, outer neon glows, glass on everything,
identical card grids, uppercase tracked labels above sections, middle-dot metadata strings, decorative status dots,
em dashes, arrows appended to buttons, emoji, centered paragraphs.
```

## Prompt 2: remaining states, mobile and components (same project, after Prompt 1)

```
Using exactly the same "Obsidian & Flame" design system and components as the previous screens (obsidian panels,
glass only for touchable/floating layers, pigment only for data, flame as the single accent, Archivo + Martian
Mono, concentric curved corners, one iridescent primary button per screen), add these screens:

SCREEN 6, Round page, cleared (desktop): the bid cards have re-stacked into a price ladder, highest at the top. A
horizontal glass plane cuts through the ladder at the clearing price with the label "Everyone pays $0.38 per
contract". Winners above the plane in volt, losers below at 35% opacity. Right: the ticket now shows "You were paid
$6.20" in amber and a fair-price check: a tick scale from -20% to +20% with a notch at 0 labeled "Fair value" and a
flame needle at +4.1%, the sentence "You were paid 4.1% above the model's fair value", and a collapsed "How we
calculate this" row. Primary iridescent button: "Claim $6.20".

SCREEN 7, Round page, settled (desktop): a settlement panel with "Official close $168.42", "Source: Pyth",
"Published Fri 16:00:01 New York", and the result "NVDA closed below your price. You get 5.84 NVDAx." Candle ring
shows the week complete. Primary iridescent button: "Claim 5.84 NVDAx". A "View on explorer" text link.

SCREEN 8, Mobile (390 x 844), three screens:
- Pools board: stats stacked, treemap becomes a 2-column grid of tiles sorted by size.
- Round page: header and price, then the order ticket opened as a glass bottom sheet over a dimmed page; the auction
  shown as a flat 2D grid of cards.
- Portfolio: totals stacked, tickets full width.

SCREEN 9, Component sheet (one 1440-wide board):
- Primary iridescent button in five states: idle, hover, loading ("Depositing"), success ("Deposited", mint rim),
  locked (no rim, dim label).
- Plain glass button, text button, glass "+" icon button.
- "Buy lower | Sell higher" switch in both positions.
- Amount input: default, focused (2px flame focus ring), error ("Amount is above your USDC balance (412.50). Lower it
  or add funds.").
- Ticket card in each status: Waiting, In auction, Paid, Settled, Claimed.
- Empty portfolio: "No orders yet. Pick a pool and name your price." with "Open the pools board".
- Loading skeleton for the pools treemap (tile shapes, no spinner).
- Connect wallet dialog (glass) listing Phantom and Solflare.
- A toast: "Deposited 1,000 USDC into NVDAx Buy lower" with an explorer link.

Same avoid list as before.
```
