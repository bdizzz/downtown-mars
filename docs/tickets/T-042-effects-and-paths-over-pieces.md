---
id: T-042
title: Neighbour effects, air and walking over pieces, in metres
status: open
size: L
area: sim
touches: [src/sim/effects.ts, src/sim/paths.ts, src/sim/amenities.ts, src/sim/care.ts, src/render3d/effects3d.ts, src/render2d/, tests/]
blocked_by: [T-041]
feature: F-004
notes: [N-0008]
created: 2026-10-06 00:32
---
## Problem
The neighbour-effect field is per slot. Effects spread over pieces instead, by metres, and air and walking ride the new edges.

## Context
Read F-004 (`docs/tickets/F-004-rooms-by-area.md`) and its plan, `docs/PLAN-M17.md`, first; this is step 4 of its Steps. Built on F-004's own branch: the PR goes into `feature/f-004-rooms-by-area`, not main.

## Approach
Effects from a room's pieces outward through neighbouring pieces (along the ring, across rings by overlap, up and down), costing metres between middles, radius in data as 10 m steps; corridors still soak up noise. Paths over corridor edge pieces, walk-through rooms, empty-space pieces and rooms. Overlays colour pieces. Done: the playthroughs come out about the same, differences explained in the PR; `npm test` passes.

## Docs to update
PLAN-M17.md Notes as built; DECISIONS.md if a rule changes.

## History
- 2026-10-06 00:32 opened from F-004 (agreed)
