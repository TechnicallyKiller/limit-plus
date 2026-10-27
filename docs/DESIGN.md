# Limit+ Design Spec: "Obsidian & Flame"

Read this before writing any frontend code. It is the visual source of truth, the same way SPEC.md is for the program.

**Design read:** a retail trading web app (pools board, round page, portfolio, one landing page) for crypto-native and
non-US stock traders. Calm and legible like a trading terminal, with a few loud moments: huge numbers, saturated
color blocks, one brutal typographic hero, glass controls and one real 3D scene.

## 1. The concept (why it looks like this)

Obsidian is glass made by fire. Limit+ runs a **candle auction**: bids count only until a hidden moment when the
candle goes out. So the whole UI is built from three materials and one element:

| Material | Where | Feels like |
|---|---|---|
| **Obsidian** (opaque, cool black) | Page and panels | Quiet, minimal, the trading floor |
| **Glass** (translucent, refractive rim) | Only things you touch or that float: buttons, the order ticket, sealed bids, nav, dialogs | Physical, 3D, premium |
| **Pigment** (flat, saturated, matte) | Only data: pool tiles, chart strokes, deltas | Maximal, loud, scannable |
| **Flame** (the single brand accent) | The candle, live states, focus rings, the iridescent rim of the one primary action | Urgency, time |

Brutalism comes from type and structure, not from ugliness: a giant halftone dot wordmark, oversized monospaced
numerals, strict left alignment, and visible structure only where it carries information.

Rule of thumb for every screen: 80% obsidian and bone, color only where it means something, one loud moment.

## 2. Tokens

Put these in `app/styles/tokens.css` and expose them through Tailwind v4 `@theme`. Never hard-code a hex in a component.

```css
@theme {
  /* Obsidian: cool, slightly violet blacks (not neutral #0B0B0B) */
  --color-obsidian-0: #07070A;   /* page background */
  --color-obsidian-1: #0E0E13;   /* panels */
  --color-obsidian-2: #15151C;   /* raised surfaces, inputs */
  --color-obsidian-3: #23232D;   /* strong hairlines, track lines */
  --color-hairline: rgb(255 255 255 / 0.07);

  /* Bone: warm off-white for text and the halftone dots */
  --color-bone: #EDE8DD;         /* primary text */
  --color-bone-dim: #A39E94;     /* secondary text, 7:1 on obsidian-1 */
  --color-bone-faint: #6B675F;   /* large text, icons, disabled only (3.4:1) */

  /* Flame: the only brand accent */
  --color-flame: #FF5B22;
  --color-flame-soft: rgb(255 91 34 / 0.16);

  /* Pigments: data only. Text on pigment is always obsidian-0, never bone. */
  --color-volt: #C8F53C;         /* Buy lower pools */
  --color-iris: #9C7CFF;         /* Sell higher pools */
  --color-amber: #FFB547;        /* money paid to the user (premium) */
  --color-up: #3DDC97;           /* positive delta */
  --color-down: #FF5470;         /* negative delta */

  /* Shape: one documented radius system, concentric corners */
  --radius-panel: 28px;          /* page-level panels */
  --radius-tile: 18px;           /* tiles, cards inside panels, bid cards */
  --radius-input: 14px;          /* inputs, small surfaces */
  --radius-pill: 999px;          /* every button, chip, segmented control */

  /* Type */
  --font-sans: var(--font-archivo);        /* display + UI, variable width axis */
  --font-mono: var(--font-martian-mono);   /* numbers, prices, addresses only */

  /* Motion */
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --dur-fast: 140ms;
  --dur-base: 240ms;
  --dur-slow: 600ms;
}
```

**Concentric corners:** an element inside a padded container uses `inner radius = outer radius - padding`
(panel 28px with 10px padding holds tiles of 18px). This one detail is what makes curved UIs look built, not templated.

**Progressive enhancement:** wrap `corner-shape: squircle` in `@supports (corner-shape: squircle)` on panels and tiles
for smoother curves where the browser supports it. Everything must look right without it.

## 3. Typography

| Role | Font | Settings |
|---|---|---|
| Brutal display (landing wordmark, page titles) | Archivo, `wdth 125`, `wght 800-900` | tracking -0.04em, leading 0.9 |
| UI text, headings | Archivo, `wdth 100`, `wght 400-650` | sentence case |
| Numbers, prices, tickers' values, addresses | Martian Mono, `wght 400-600` | `font-variant-numeric: tabular-nums` |

Load both with `next/font/google` (Archivo with `axes: ['wdth']`). No other fonts.

Scale (desktop / mobile): hero number 72/48, page title 40/30, section heading 22/20, body 15/15, small 13/13.
Line length under 70 characters. Body leading 1.5.

Rules:
- Mono is for **numbers and addresses only**. Labels, table headers and buttons are Archivo, sentence case.
- No tracked-out uppercase labels. At most one small uppercase label per page, and only if it carries real state (for example a live round phase).
- Never accent a single word in a heading with a different color or italic.
- Big number + small label is allowed only where the number is the point (round header, order ticket, portfolio totals). Not on the landing hero.

## 4. Surfaces and effects

### 4.1 Obsidian panel
```css
.panel {
  background: var(--color-obsidian-1);
  border-radius: var(--radius-panel);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.05), 0 0 0 1px var(--color-hairline);
}
```
No drop shadows on obsidian. Depth comes from the inset top highlight and the hairline.

### 4.2 Glass (only for interactive or floating layers)
```css
.glass {
  background: rgb(22 22 30 / 0.55);
  backdrop-filter: blur(18px) saturate(140%);
  border-radius: var(--radius-pill);           /* or --radius-tile for cards */
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.12),     /* top refraction edge */
    inset 0 -1px 0 rgb(0 0 0 / 0.4),           /* bottom thickness */
    0 0 0 1px rgb(255 255 255 / 0.08),
    0 18px 40px -18px rgb(0 0 0 / 0.8);        /* floating, tinted to page */
}
@supports not (backdrop-filter: blur(1px)) { .glass { background: var(--color-obsidian-2); } }
@media (prefers-reduced-transparency: reduce) { .glass { background: var(--color-obsidian-2); backdrop-filter: none; } }
```
Glass must have something behind it to refract (the dot field, a chart, the auction stage). Glass on flat black is just grey: use obsidian there.

### 4.3 Iridescent rim (the one primary action per screen)
The primary button (Deposit, Claim) is a glass pill whose 1.5px rim carries a thin-film iridescence, inspired by
"obsidian glass bead" buttons.
- CSS version (required): a `::before` with a `conic-gradient` of flame, amber, iris, up-mint and back to flame, shown only on
  the rim using `mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)` with 1.5px padding.
  The gradient angle is a registered custom property (`@property --rim-angle`) that rotates slowly **only on hover/focus**.
- States: idle (rim at 40% opacity), hover/focus (rim 100%, angle turns), pressed (`scale: 0.98`), loading (rim spins
  continuously, label swaps to "Depositing"), success (rim settles to up-mint for 900ms, label "Deposited"), disabled
  (no rim, bone-faint label, "Locked" style).
- WebGL2 version (stretch, landing CTA only): a fragment shader rendering thin-film interference on the rim, falling
  back to the CSS version. Never ship more than one WebGL context per page.
- Only ONE iridescent element visible at a time. Everything else is plain glass or text buttons.

### 4.4 Pigment tiles
Flat fill, no gradient, no glow. Inner edge: `box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.18)`. Text obsidian-0.
Small value badges on tiles are obsidian-0 pills with bone mono text.

### 4.5 Dot field
A faint dot grid (1px dots, 24px pitch, bone at 6% opacity) is our "space". Use it only behind the landing hero and
inside the auction stage, where it gives the 3D scene a floor. Content pages are plain obsidian.

### 4.6 Charts
Thin strokes (1.5px), round caps, no outer glow. A line may use a gradient *along the stroke* (flame to amber). Area
fills fade from 18% to 0% opacity. Axis labels: mono 11px, bone-faint, on the right. Gridlines obsidian-3.
"Your price" is always a dashed flame line labeled with the price.

## 5. Signature components

### 5.1 Halftone wordmark (landing hero, the brutal moment)
`HalftoneWordmark.tsx`, canvas 2D.
- Render "limit+" in Archivo `wdth 125 wght 900` to an offscreen canvas, sample alpha on a grid (7px pitch desktop,
  10px mobile, DPR aware), draw bone dots (radius 2.2px).
- Pointer: dots within 90px are pushed outward with spring physics and tinted toward flame by distance. Touch drag
  does the same. Dots spring back when the pointer leaves.
- One orchestrated entrance: dots fly from scattered positions into the letters over ~900ms. No idle loop after that.
- The wordmark bleeds edge to edge and sits on the dot field. It is `aria-hidden`; an `<h1>` with the same text is
  visually hidden for screen readers.
- Pause the animation loop when offscreen or the tab is hidden: `content-visibility: auto` with
  `contain-intrinsic-size` on the container plus a `contentvisibilityautostatechange` listener (attach directly to the
  element; the event doesn't bubble everywhere), `IntersectionObserver` fallback, and `visibilitychange`.
- Reduced motion: draw the dots static, no repulsion.

### 5.2 Auction stage (round page, the 3D moment)
`AuctionStage.tsx`, CSS 3D transforms + Motion. No three.js needed.
- Container `perspective: 1400px`; stage `transform-style: preserve-3d`; dot field as the floor.
- Each sealed bid is a **glass card** (150 x 210, radius 18) floating in space. Its position is seeded by a hash of the
  bidder address, so the same bidder always appears in the same spot.
  Face down: a fine hatch pattern, short address (mono), commit time. Face up: price per contract in big mono.
- Pointer parallax: the whole stage tilts at most 6 degrees, using motion values (never React state per frame).
- Phase choreography (this is the page's one orchestrated sequence):
  1. Bidding: each new `BidCommitted` event drops a card in with a spring. Header shows "7 sealed bids".
  2. Cutoff resolved: cards committed after the random close desaturate and sink back in depth, labeled "After the close".
  3. Reveal: cards flip (`rotateY(180deg)`, 120ms stagger) to show prices.
  4. Cleared: cards re-stack into a price ladder, highest at the top. A horizontal glass plane slides in at the clearing
     price: "Everyone pays $0.38 per contract". Winners above the plane in the round's pigment, losers below at 35% opacity.
- Accessibility: the stage is `aria-hidden`. A real bids table (caption, `scope` headers, sticky header in a
  scrollable `role="region"` wrapper with `tabindex="0"`) is the accessible source, toggled by "Show as table".
- Reduced motion: a 2D grid of cards with crossfades instead of flips and depth.

### 5.3 Candle ring (round page)
`CandleRing.tsx`, SVG, inspired by a polar chart.
- A ring representing the round's week: arcs for deposits, bidding, the candle window, reveal, waiting for Friday close,
  and the exercise window. A clock hand shows now.
- During the candle window a flame arc burns from `candle_start_ts` toward `bid_end_ts`, but you can't see where it stops.
- After `resolve_cutoff`, a notch drops at the cutoff time with the exact time in mono: "Closed at 14:32:07".
- Labels outside the ring in Archivo 13px. No legend: label the arcs directly.

### 5.4 Pools board treemap (pools page, the maximal moment)
`PoolsTreemap.tsx`, `d3-hierarchy` squarified treemap, tiles rendered as divs (focusable links).
- Tile area = USDC waiting in the pool. Tile color = side: volt for Buy lower, iris for Sell higher.
- Tile content: ticker (Archivo 600) and side icon top-left; a "+" quick-deposit glass button top-right; bottom-left the
  big mono number = this week's payment rate (for example "0.62%"); bottom-right an obsidian pill with your-price distance
  ("-5.0%").
- Gap 8px, tile radius 18, panel radius 28 with 10px padding (concentric).
- Small tiles collapse content gracefully: below 120px wide show only the ticker and the rate.
- Mobile (< 768px): becomes a 2-column grid of tiles sorted by size. Declare this in the component.

### 5.5 Order ticket (round page)
`OrderTicket.tsx`: a sticky glass slab (radius 28) on the right of the round page.
1. Segmented control "Buy lower | Sell higher" (pill). The active indicator is tethered with CSS anchor positioning
   (`anchor-name` on the active item, `position-anchor` on the indicator), with a `@supports not (position-anchor: auto)`
   fallback and the transition wrapped in `prefers-reduced-motion: no-preference`. Use real `aria-selected` / tab semantics.
2. Amount input (label above, helper below, error below), quick chips 100 / 500 / 1,000.
3. "You get paid now": big amber mono number. Before the auction it's a range ("$4.10 to $6.80, decided at the auction"); after clearing it's exact.
4. Two outcome cards side by side, the two possible Fridays:
   "If NVDA closes at or below $171.00 → You get 5.84 NVDAx" and "If it closes above → You get $1,000 back".
   Both show "+ the $6.20 you were paid". (The arrow here is content, not a button suffix.)
5. The risk line (from CLAUDE.md UX rules), always visible.
6. The iridescent primary button: "Deposit".

### 5.6 Fair-price check
`FairPriceLevel.tsx`: an instrument, not a progress bar. A tick scale from -20% to +20% with a notch at 0 labeled
"Fair value", and a flame needle at the actual result. Text: "You were paid 4.1% above the model's fair value."
A disclosure "How we calculate this" lists spot, your price, volatility, time to Friday, rate and the model name (Black-Scholes) in mono.

### 5.7 Smaller pieces
- `Odometer.tsx`: digit-roll for live numbers, animating only when the value changes (feedback, not decoration).
- `PriceSpark.tsx`: last 30 days line + area with the dashed "your price" line.
- `TicketCard.tsx` (portfolio): a horizontal glass ticket with a perforated divider made of bone dots between the stub
  (status, pool) and the body (amounts, actions). Statuses: Waiting, In auction, Paid, Settled, Claimed.
- Icons: `@phosphor-icons/react`, one weight ("regular") everywhere. No emoji. No hand-drawn SVG icons.

## 6. Pages

### 6.1 Landing `/`
```
+------------------------------------------------------------------+
| l+ (mark)                                [Pools] [Portfolio] (o) |   glass pill nav, 64px
|                                                                  |
|  . . . . . . . . . . dot field . . . . . . . . . . . . . . . . . |
|  ##  ## ##   ## ## ## #####   +     <- HALFTONE "limit+",        |
|  ##  ## ### ### ##   ##     +++        full bleed, reacts to     |
|  ##  ## ## # ## ##   ##      +         the cursor                |
|                                                                  |
|  Name your price for a stock. Get paid while you wait.           |
|  [ Open the pools board ]  (iridescent)                          |
+------------------------------------------------------------------+
| Live pools board (the real PoolsTreemap component, top 6 pools)  |
+------------------------------------------------------------------+
| How a week works: candle ring, 5 labeled steps (a real sequence) |
+------------------------------------------------------------------+
| Footer: docs, GitHub, "Prices from Pyth", disclaimer             |
+------------------------------------------------------------------+
```
Left-aligned copy. No eyebrow, no stat strip, no scroll cue, no logo wall.

### 6.2 Pools board `/pools`
```
+------------------------------------------------------------------+
| nav                                                              |
| Waiting in pools     Paid out this week     Next Friday close    |
| $2,418,930 (mono 48) $14,210 (amber)        2d 04:12:09          |
+--------------------------------------------+---------------------+
| PoolsTreemap (8 cols, the loud part)       | Filter: stock       |
|                                            | Board | List        |
|                                            | Selected pool peek  |
+--------------------------------------------+---------------------+
```

### 6.3 Round page `/round/[pubkey]`
```
+------------------------------------------------------------------+
| NVDAx  [Buy lower]   Your price $171.00   -5.0% vs now  phase    |
| PriceSpark (full width, dashed flame line at your price)         |
+---------------------------------------+--------------------------+
| AuctionStage (3D)                     | OrderTicket (sticky,     |
|                                       |   glass slab)            |
+-------------------+-------------------+                          |
| CandleRing        | FairPriceLevel /  |                          |
|                   | Settlement panel  |                          |
+-------------------+-------------------+--------------------------+
| Bids table (accessible source, collapsible)                      |
+------------------------------------------------------------------+
```
Mobile order: header, ticket, stage (2D), ring, fair price, table.

### 6.4 Portfolio `/portfolio`
Totals row (Paid to you so far, Waiting, Claimable), then a stack of `TicketCard`s, newest first. Claimable tickets get the
iridescent "Claim" (one at a time: the first claimable ticket gets it, others get plain glass).

## 7. Motion rules

- One orchestrated moment per page: landing = wordmark assembly; round = auction choreography; pools and portfolio = none.
- Everything else moves only in response to the user or to real state changes (new bid, cutoff, reveal, claim).
- Springs for UI (`stiffness 260, damping 30`), `--ease-out-expo` for CSS transitions. Animate only `transform` and `opacity`.
- Pointer-driven values use Motion's `useMotionValue` / `useTransform`, never `useState` per frame. No `scroll` listeners.
- Every animation honors `prefers-reduced-motion`. Every canvas/WebGL loop pauses when offscreen or hidden.
- Modals and the mobile order-ticket sheet animate in and out of the top layer (`<dialog>` with entry/exit transitions).

## 8. Copy rules

- Sentence case everywhere. Plain verbs. A button says what happens: "Deposit", "Withdraw", "Claim", "Open the pools board".
- No em dashes or en dashes in UI text. Use a period, comma, or colon.
- No arrow appended to button labels.
- Errors say what happened and what to do: "Amount is above your USDC balance (412.50). Lower it or add funds."
- Empty states invite action: "No orders yet. Pick a pool and name your price."
- Numbers are real or clearly marked as examples. Use realistic, uneven values in mock data.

## 9. Banned (these make it look generated)

Inter, Space Grotesk, Geist, any serif. Purple-to-blue gradient glows, outer neon glows, gradient washes as decoration.
Glass on everything (glass is only for touchable or floating layers). Identical card grids, three equal feature cards.
Tracked uppercase eyebrows above sections, middle-dot meta strings, decorative status dots (one "Live" dot only where a
round is actually live). Hover tilt on every card (3D lives in the auction stage only). Fake dashboard screenshots built
from divs. Lucide icons, emoji. Centered paragraphs. Scroll cues. Version labels.

## 10. Quality floor and design QA

- WCAG AA contrast everywhere; text on pigment is obsidian-0; bone-faint never for body text.
- Visible focus: 2px flame outline, 3px offset, on every interactive element.
- Color is never the only signal: side shows icon + word, deltas show sign + arrow glyph.
- Responsive at 390px: no horizontal scroll, ticket becomes a bottom sheet.
- Performance: LCP under 2.5s on the landing page (the wordmark canvas must not block first paint; render the hidden
  `<h1>` and a static fallback first), one WebGL context max, lazy-load the auction stage below the fold on mobile.

**QA loop for Claude Code:** after building each page, take Playwright screenshots at 1440x900 and 390x844, look at them,
and check against this list: text overflow, contrast, concentric corners, only one iridescent element, only one loud
moment, no banned patterns from section 9, no em dashes in rendered text (automated grep of the DOM text), focus rings
visible. Fix, re-shoot, then report.

## 11. Approved frontend dependencies

`next`, `react`, `tailwindcss` v4 + `@tailwindcss/postcss`, `motion`, `@phosphor-icons/react`, `d3-hierarchy`,
`d3-shape`, `d3-scale`, `@solana/wallet-adapter-react` (+ `-react-ui`, `-wallets`), `@playwright/test` (dev).
Anything else: ask first.
