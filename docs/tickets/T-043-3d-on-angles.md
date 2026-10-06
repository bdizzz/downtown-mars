---
id: T-043
title: The 3D view on angles
status: open
size: L
area: render3d
touches: [src/render3d/cylinder.ts, src/render3d/rooms3d.ts, src/render3d/pick3d.ts, src/render3d/people3d.ts, src/render3d/flows3d.ts, src/view/furnish.ts, src/view/walk.ts]
blocked_by: [T-042]
feature: F-004
notes: [N-0008]
created: 2026-10-06 00:32
---
## Problem
The 3D view draws rooms, walls, corridors and picking from slot indices. It reads angles instead.

## Context
Read F-004 (`docs/tickets/F-004-rooms-by-area.md`) and its plan, `docs/PLAN-M17.md`, first; this is step 5 of its Steps. Built on F-004's own branch: the PR goes into `feature/f-004-rooms-by-area`, not main.

## Approach
Rooms, walls, corridors and picking from spans and runs; people, flows and first-person walking on the new edges; furniture fitted from a room's span. Done: an old save and a new game look the same as before in every 3D view; a browser check with screenshots.

## Docs to update
PLAN-M17.md Notes as built.

## History
- 2026-10-06 00:32 opened from F-004 (agreed)
