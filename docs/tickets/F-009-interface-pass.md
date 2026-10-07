---
id: F-009
title: Interface pass: the top bar, the menu and settings
status: agreed
plan:
notes: [N-0048, N-0049]
created: 2026-10-07 18:58
---
## Goal
Make the interface easier to read and use, on desktop, phones and the keyboard: a top bar that shows what needs you first, in compact icons and a resource grid, and a pause menu and settings that are dense, grouped and keyboard friendly. Collected from T-088 and T-089 (Bryon agreed the grouping, Oct 7), mainly to put other work in the right order.

## Design
- **Settings described in one table** (T-088): sections, name, control, hint, default. Tickets that add settings wait for it so they land in the new layout: T-066 (volume sliders, F-006), T-072 (Android system bar), T-078 (tilt-shift slider).
- **Stable element ids and one icon set** (T-089): each top-bar element gets an id and an icon, kept in `src/view/hudItems.ts` so Godot gets the same. F-007's T-084 hides and reveals top-bar elements by id, so it waits for T-089 rather than being redone after it.
- Both include Godot (Bryon, Oct 7). Icons are one simple set drawn for the game.

## Breakdown
Agreed Oct 7. Either order; each unblocks the tickets named.
- (M) The pause menu and settings: grouped, compact, keyboard and mobile friendly; settings in one table (unblocks T-066, T-072, T-078) → T-088
- (L) The top bar: what needs you first, icons, a resource grid, stable ids (unblocks T-084) → T-089

## History
- 2026-10-07 18:58 made from T-088 and T-089 (Bryon agreed the grouping)
- 2026-10-07 18:58 made from T-088, T-089
