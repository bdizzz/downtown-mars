---
id: T-040
title: Space as intervals: occupancy and excavation by angle range
status: open
size: L
area: sim
touches: [src/sim/space.ts, src/sim/placement.ts, src/sim/excavation.ts, src/sim/events.ts, src/sim/save.ts, src/bridge/inspect.ts, tests/]
blocked_by: [T-039]
feature: F-004
notes: [N-0008]
created: 2026-10-06 00:32
---
## Problem
`layout.grid` and `layout.open` are per slot. They become spans per floor and ring, and pieces replace cells as what other systems walk over.

## Context
Read F-004 (`docs/tickets/F-004-rooms-by-area.md`) and its plan, `docs/PLAN-M17.md`, first; this is step 2 of its Steps. Built on F-004's own branch: the PR goes into `feature/f-004-rooms-by-area`, not main.

## Approach
`sim/space.ts`: which room holds each angle range, which ranges are dug (merged), rock as the rest; pieces (a room's part of a ring, empty space, rock cut to ~10 m). Overlap, `roomAt` by angle, empty space, excavation, lava tubes and digging yields on spans. `room.cells` stays as a derived slot-shaped field for code not yet moved. If F-002's `livingVolume` has landed, move it to dug area × floor height. Save migration. Done: rooms still placed on slots behave exactly as before; `npm test` passes with the playthroughs unchanged.

## Docs to update
PLAN-M17.md Notes as built.

## History
- 2026-10-06 00:32 opened from F-004 (agreed)
