---
id: T-039
title: Notches and spans: rooms get an angle alongside their slots
status: open
size: M
area: sim
touches: [src/sim/geometry.ts, src/sim/placement.ts, src/sim/save.ts, data/config.json, tests/]
blocked_by: []
feature: F-004
notes: [N-0008]
created: 2026-10-06 00:32
---
## Problem
Every ring room gets an angle (start, span, depth in notches, 1,440 a turn) alongside its slots, the base everything else in F-004 builds on.

## Context
Read F-004 (`docs/tickets/F-004-rooms-by-area.md`) and its plan, `docs/PLAN-M17.md`, first; this is step 1 of its Steps. Built on F-004's own branch: the PR goes into `feature/f-004-rooms-by-area`, not main.

## Approach
Area ↔ angle helpers and ring radii in `geometry.ts`; `start`, `span`, `depth` on every ring room's location, set when placed and filled in for old saves by a migration (slot × 1,440 / slots in the ring; deep rooms take the inner ring's angles). Nothing reads them yet. Done: every room's angles match its slots exactly (a test over the starter hole and a played save); `npm test` passes, no behaviour change.

## Docs to update
PLAN-M17.md Notes as built.

## History
- 2026-10-06 00:32 opened from F-004 (agreed)
