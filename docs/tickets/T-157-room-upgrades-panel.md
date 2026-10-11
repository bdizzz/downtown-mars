---
id: T-157
title: The room panel lists a room's upgrades with cost, upkeep and what they do
status: open
size: M
area: ui, godot
feature: F-017
touches: [src/view/roomPanel.ts, src/ui/Inspector.tsx, src/bridge/, godot/src/]
blocked_by: [T-156]
notes: [N-0075]
created: 2026-10-11 16:09
---
## Problem
The player picks from a room's upgrades in its panel, seeing cost, monthly upkeep and effect, and which are locked or unaffordable.

## Context
Read F-017 (`docs/tickets/F-017-room-upgrades.md`) first; it builds on F-003's Upgrade action (T-033). The room panel is shared with Godot through `src/view/roomPanel.ts`.

## Approach
An Upgrades section in the panel: each upgrade with cost, upkeep, effect; Install (greyed if unaffordable, with why), installed ones marked (and idle if upkeep is short); web and Godot. Done: install an upgrade from the panel in both.

## History
- 2026-10-11 16:09 opened from F-017 (agreed)
