---
id: T-095
title: "?" links from the game's panels into the guide
status: open
size: S
area: ui
touches: [src/ui/RoomCard.tsx, src/ui/BuildPalette.tsx, src/ui/Hud.tsx, src/ui/EventCards.tsx, src/view/roomPanel.ts]
blocked_by: [T-093]
feature: F-010
notes: [N-0050]
created: 2026-10-08 02:14
---
## Problem
F-010: get from what you're looking at to its guide page in one click.

## Context
See F-010's Design. Room panel and card (`src/view/roomPanel.ts`, `RoomCard.tsx`), build palette, top bar items (`src/view/hudItems.ts`; T-089 is redoing the bar), event cards.

## Approach
A small "?" on each that opens the Guide at the right page. Done: from a room, a resource in the top bar, a palette entry or an event card, one click opens its page.

## History
- 2026-10-08 02:14 opened from F-010's breakdown
