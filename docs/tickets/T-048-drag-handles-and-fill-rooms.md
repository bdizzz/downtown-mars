---
id: T-048
title: Drag handles, fill rooms and double-click to fill a gap
status: open
size: L
area: ui, render3d, data
touches: [src/ui/, src/render3d/, src/sim/placement.ts, src/sim/costs.ts, data/rooms.json, data/config.json, src/sim/save.ts]
blocked_by: [T-047]
feature: F-004
notes: [N-0008]
created: 2026-10-06 00:32
---
## Problem
A proposed room has handles on its side walls; fill rooms stretch much further and can fill a gap with a double-click.

## Context
Read F-004 (`docs/tickets/F-004-rooms-by-area.md`) and its plan, `docs/PLAN-M17.md`, first; this is step 10 of its Steps. Built on F-004's own branch: the PR goes into `feature/f-004-rooms-by-area`, not main.

## Approach
Handles on a proposal (snapping while dragging, red past its range; committed with a click or Enter, Escape drops it). Fill rooms (`fill: true`): Empty space (the three empty rooms as one, target 100 m²; saves migrate), tiny and small plazas, the park; 50–300% of their area and at most 90° (`placement.fill`); cost and dig time scale with area, effects don't. Double-click a gap with a fill room selected fills it wall to wall, or the hover says why not. Done: browser check; `npm test` passes.

## Docs to update
PLAN-M17.md Notes as built; GUIDE.md: Building; ROOMS.md (fill rooms).

## History
- 2026-10-06 00:32 opened from F-004 (agreed)
