---
id: T-106
title: On phones, the top bar collapses to the essentials, with resources and warnings behind a toggle
status: open
size: M
area: ui
touches: [src/ui/Hud.tsx, src/ui/ResourceBar.tsx, src/ui/StatusBar.tsx, src/ui/styles.css]
blocked_by: []
notes: [N-0060]
created: 2026-10-09 13:03
---
## Problem
On mobile "too much of the screen is taken over by this menu at phone sizes." Hide most of the top bar inside a collapsible menu. Left outside the collapse:
- system menu
- hole name
- pause/play toggle (the speed controls go inside the collapse)
- how many warnings are active (like low food or happiness)
- the "office" link

Everything else, such as the specific warnings and all the resource counts, collapses.

## Context
The top bar was just reworked in T-089 (icons, a resource grid, "what needs you first"): `src/ui/Hud.tsx`, `ResourceBar.tsx`, `StatusBar.tsx`. Phone layout rules live under `@media (max-width: 639px)` in `styles.css`; mobile support came in T-025. Shared HUD content comes from `src/view/hudItems.ts`.

## Approach
Under the phone breakpoint, show one compact row with the five items above plus a toggle (chevron) that drops down a panel with the speed controls, the resource grid and the warnings list. The warning count can open that panel too. Desktop is unchanged. Done: on a 375 px wide screen the bar is one short row, and everything is still reachable in one tap.

## Open questions
- [ ] Should the panel stay open until you close it, or close itself when you tap the game view?

## Docs to update
GUIDE.md: the top bar on phones.

## History
- 2026-10-09 13:03 opened from N-0060
