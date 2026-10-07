---
id: T-087
title: The guided tutorial in Godot
status: open
size: L
area: godot, bridge
touches: [godot/src/Tutorial.cs, godot/src/Live.cs, src/bridge/tutorial.ts]
blocked_by: [T-085, T-086]
feature: F-007
notes: [N-0046]
created: 2026-10-07 18:44
---
## Problem
F-007 in the Godot viewer.

## Context
See F-007's Design and `PLAN-GODOT.md`. The bridge already works out tutorial goals (`src/bridge/tutorial.ts`) and Godot draws the card (`Tutorial.cs`); the welcome card is there too (T-053).

## Approach
The welcome choice, the guided track through the bridge, hiding Godot's HUD and build elements by the same unlock ids, "Show everything", and the "Show me" clips (Godot plays WebM via `VideoStreamPlayer`; check the format). Done: the guided tutorial behaves the same in Godot, checked with a test run.

## Docs to update
PLAN-GODOT.md: Status and next.

## History
- 2026-10-07 18:44 opened from F-007's breakdown
