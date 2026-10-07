---
id: T-034
title: Material and finish looks in the web 3D view
status: open
size: M
area: render3d
touches: [src/render3d/surfaces.ts, src/render3d/rooms3d.ts]
blocked_by: [T-032]
feature: F-003
notes: [N-0006, N-0007]
created: 2026-10-06 00:10
---
## Problem
Each lining looks like what it is in 3D: smoothed rock, brick, patterned brick, metal panels, inlaid metal, with matching floors, and refit stripes while upgrading.

## Context
Read F-003 (`docs/tickets/F-003-room-materials.md`) and its plan, `docs/PLAN-M15.md`, first; this is step 3 of its Steps. All numbers come from the plan's Defaults, in `data/materials.json`.

## Approach
Build on T-076: floors take their texture from the room's material and flooring in every mode; room-colour mode only tints them. Don't bring back per-kind floor patterns.

Procedural surfaces in `render3d/surfaces.ts` (shared with corridor finishes), floors following the walls, the M7 hazard-stripe band and % label on rooms being refitted. Done: each step reads clearly in a room in 3D, day and night.

## Docs to update
ART.md (room linings), PLAN-M15.md Notes as built.

## History
- 2026-10-06 00:10 opened from F-003 (agreed)
