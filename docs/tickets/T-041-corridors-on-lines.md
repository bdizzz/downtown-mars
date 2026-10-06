---
id: T-041
title: Corridors on lines: runs on circles and radial lines, edges cut at vertices
status: open
size: L
area: sim
touches: [src/sim/edges.ts, src/sim/corridors.ts, src/sim/windows.ts, src/view/doors.ts, src/view/corridorPlan.ts, src/view/corridorProposal.ts, src/sim/commands.ts, src/sim/save.ts, tests/]
blocked_by: [T-040]
feature: F-004
notes: [N-0008]
created: 2026-10-06 00:32
---
## Problem
Corridors are stored per edge id between slots. They become runs on circles and radial lines at any notch, with edges derived by cutting them at vertices.

## Context
Read F-004 (`docs/tickets/F-004-rooms-by-area.md`) and its plan, `docs/PLAN-M17.md`, first; this is step 3 of its Steps. Built on F-004's own branch: the PR goes into `feature/f-004-rooms-by-area`, not main.

## Approach
As PLAN-M17 "Edges and corridors": corridors as runs with their finish; edges cut at every vertex (other corridors, room ends either side, doors) with notch ids, `edges.ts` keeping its API; access, the gallery, bulkheads on their piece, doors (M13 rule), windows stored by wall (inner, outer, start, end); the corridor tool drags along circles and radial lines. Save migration of corridors, bulkheads and windows. Done: an old save's corridors, doors and windows come through unchanged; `npm test` passes.

## Docs to update
PLAN-M17.md Notes as built.

## History
- 2026-10-06 00:32 opened from F-004 (agreed)
