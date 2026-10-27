---
description: Phase 5 — build the frontend from docs/DESIGN.md ("Obsidian & Flame") with a screenshot QA loop
---
Phase 5: frontend in `app/`. Read, in this order: docs/DESIGN.md (whole file), CLAUDE.md "UX language rules",
docs/DEMO_SCRIPT.md. If `docs/mockups/` has images, treat them as the visual target alongside DESIGN.md.

Start in plan mode and show me:
1. A one-line design read and how you will apply DESIGN.md sections 1-4 (tokens, type, materials).
2. The component list from DESIGN.md section 5 with file paths, and which page each appears on.
3. Anything in DESIGN.md you think won't work technically, with an alternative. Wait for my approval.

Build order (commit-sized steps, run the app after each):
1. Foundations: Next.js App Router + Tailwind v4 (`@tailwindcss/postcss`), `app/styles/tokens.css` exactly as DESIGN.md
   section 2, fonts via `next/font/google` (Archivo with the `wdth` axis, Martian Mono), base layout, glass pill nav,
   wallet adapter (Phantom, Solflare), `packages/sdk` client, RPC + program ID from `NEXT_PUBLIC_*` env vars, account
   polling every 2s.
2. Primitives: Panel, Glass, IridescentButton (CSS version with all states), SegmentedControl (anchor-positioned
   indicator + fallback), Odometer, inputs with label/helper/error.
3. Pools board: stats row + PoolsTreemap (+ mobile grid).
4. Round page: header + PriceSpark, OrderTicket, CandleRing, FairPriceLevel, settlement panel, bids table, then
   AuctionStage last (it is the riskiest piece; the page must work without it).
5. Portfolio: totals + TicketCards with claim/refund actions and explorer links for every transaction.
6. Landing: HalftoneWordmark + live pools board preview + "How a week works" with CandleRing.

Constraints: only the dependencies in DESIGN.md section 11 (ask before anything else); no hard-coded hex values in
components; every animation honors prefers-reduced-motion; canvas loops pause offscreen.

QA (required before you say done):
- Run DESIGN.md section 10's loop: Playwright screenshots of `/`, `/pools`, `/round/<demo round>`, `/portfolio` at
  1440x900 and 390x844. Look at every screenshot, list defects, fix, re-shoot.
- Automated checks: F2 (banned words in primary UI), no em/en dashes in rendered text, at most one iridescent
  element in the viewport per page, focus ring visible on Tab through each page.
- `yarn workspace app build` passes. Report F1-F5 from docs/TEST_PLAN.md.
Extra instructions: $ARGUMENTS
