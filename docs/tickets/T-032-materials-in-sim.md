---
id: T-032
title: Room materials in the sim: material, finish, flooring, comfort and wear
status: open
size: M
area: sim, data
touches: [data/materials.json, src/sim/placement.ts, src/sim/condition.ts, src/sim/care.ts, src/sim/save.ts, src/view/roomCard.ts, tests/]
blocked_by: []
feature: F-003
notes: [N-0006, N-0007]
created: 2026-10-06 00:10
---
## Problem
Rooms gain a lining: `material`, `finish` and `flooring`, with comfort and wear effects by kind of room, from a new `data/materials.json`.

## Context
Read F-003 (`docs/tickets/F-003-room-materials.md`) and its plan, `docs/PLAN-M15.md`, first; this is step 1 of its Steps. All numbers come from the plan's Defaults, in `data/materials.json`.

## Approach
`data/materials.json` (walls, floorings, `byCategory`, `exempt`); `room.material`/`finish`/`flooring` (absent = bare rock, matching floor); comfort for homes and shared comfort for people rooms; the wear factor in condition; an inspector/room card line; a save version bump. Set only by tests and the console for now. Done: setting a home's material from the console changes its comfort and wear, with tests.

## Docs to update
PLAN-M15.md Notes as built; DECISIONS.md (room linings).

## History
- 2026-10-06 00:10 opened from F-003 (agreed)
