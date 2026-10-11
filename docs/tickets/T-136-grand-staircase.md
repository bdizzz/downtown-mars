---
id: T-136
title: "The grand staircase, placed inside plazas"
status: open
size: M
area: rooms, sim
touches: [data/rooms.json, src/sim/placement.ts, src/sim/paths.ts]
blocked_by: [T-132]
feature: F-015
notes: [N-0068]
created: 2026-10-11 15:50
---
## Problem
Add the grand staircase (ROOMS.md: M spanning 2–3 floors, a high-capacity link inside plazas, comfort +1 r2, brick 20 + glass 5, unlocks with the first plaza).

## Context
Read F-015 first. Each room's catalog row is in `docs/ROOMS.md`; `docs/ROOM-STATUS.md` shows what's built.

## Approach
Needs the plaza (T-132). Placement inside a plaza's footprint, a multi-floor link in paths like stairs, and the unlock on the first plaza built.

## Docs to update
ROOMS.md and ROOM-STATUS.md (rerun `node scripts/room-status.mjs`); GUIDE.md for new rooms or resources.

## History
- 2026-10-11 15:50 opened from F-015 (agreed)
