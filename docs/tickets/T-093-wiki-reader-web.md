---
id: T-093
title: The Guide panel in the web game: links, search, back and forward, locked pages marked
status: open
size: M
area: ui
touches: [src/ui/Guide.tsx, src/ui/Help.tsx, src/ui/Menu.tsx, src/ui/styles.css]
blocked_by: [T-092]
feature: F-010
notes: [N-0050]
created: 2026-10-08 02:14
---
## Problem
F-010's reader in the game.

## Context
See F-010's Design. Help (? or F1, `src/ui/Help.tsx`) lists controls and build keys today; the Guide can absorb it (Controls becomes a page). T-088 is reworking the menu; open the Guide from there.

## Approach
A panel with a sidebar (contents by kind), search over titles and text, the page with live links, back and forward, and pages for things not yet unlocked marked locked with how to unlock them (from the hole's state). Opens from the menu and F1. Works on phones (T-025) and by keyboard. Done: you can browse from any room to what it makes, to who uses that, and back.

## History
- 2026-10-08 02:14 opened from F-010's breakdown
