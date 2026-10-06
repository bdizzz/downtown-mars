---
id: T-044
title: The 2D unrolled and plan views on angles
status: open
size: M
area: render2d
touches: [src/render2d/stage.ts, src/render2d/layout.ts, src/render2d/plan.ts, src/render2d/planDraw.ts, src/bridge/plan.ts]
blocked_by: [T-042]
feature: F-004
notes: [N-0008]
created: 2026-10-06 00:32
---
## Problem
The unrolled and plan views lay rings out by slot. They draw from angles: the unrolled view at each ring's mid-radius length, the plan view as wedges.

## Context
Read F-004 (`docs/tickets/F-004-rooms-by-area.md`) and its plan, `docs/PLAN-M17.md`, first; this is step 6 of its Steps. Built on F-004's own branch: the PR goes into `feature/f-004-rooms-by-area`, not main.

## Approach
Unrolled view: each ring laid out at its mid-radius length, so rooms of the same area are the same width on every ring. Plan view (`planDraw.ts`, shared with the bridge) draws wedges and corridor runs from angles. Done: both views match the 3D layout for an old save and a new game; browser check.

## Docs to update
PLAN-M17.md Notes as built.

## History
- 2026-10-06 00:32 opened from F-004 (agreed)
