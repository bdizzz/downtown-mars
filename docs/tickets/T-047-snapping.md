---
id: T-047
title: Snapping while placing, with its toggle
status: open
size: M
area: ui, render3d
touches: [src/sim/placement.ts, src/ui/BuildPalette.tsx, src/render3d/, src/view/interaction.ts, data/config.json]
blocked_by: [T-046]
feature: F-004
notes: [N-0008]
created: 2026-10-06 00:32
---
## Problem
A proposed room snaps to neighbours on its ring and to room ends on the rings inside and out, within ±15% of its area, on by default and toggled while placing.

## Context
Read F-004 (`docs/tickets/F-004-rooms-by-area.md`) and its plan, `docs/PLAN-M17.md`, first; this is step 9 of its Steps. Built on F-004's own branch: the PR goes into `feature/f-004-rooms-by-area`, not main.

## Approach
As PLAN-M17 "Placement": the snap order (fill a gap exactly, abut a neighbour, line up with ends and radial corridors on adjacent rings; stairs and elevators always snap onto a stack), a tick showing what it snapped to, a toggle in the build strip and a free key (`placement.leeway` 0.15). Done: browser check of each snap; the sim's snap finder unit-tested.

## Docs to update
PLAN-M17.md Notes as built; GUIDE.md: Building and Controls.

## History
- 2026-10-06 00:32 opened from F-004 (agreed)
