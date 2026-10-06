---
id: T-029
title: Gas tanks: O2/CO2 ballast both ways, and the tank fill slider
status: open
size: M
area: rooms, sim
touches: [data/rooms.json, data/storage.json, src/sim/air.ts, src/sim/condition.ts, src/sim/earth.ts, src/view/roomPanel.ts]
blocked_by: [T-026, T-028, T-005]
feature: F-002
notes: [N-0005]
created: 2026-10-06 00:08
---
## Problem
Gas tank rooms hold O2 or CO2 and act as ballast: they release before rooms run and store after. A full set of tanks lets extra into the air.

## Context
Read F-002 (`docs/tickets/F-002-air-mix.md`) and its plan, `docs/PLAN-M16.md`, first; this is step 4 of its Steps.

## Approach
The room and its O2/CO2 choice (reusing T-005's tank "holds"), the ballast order, overflow into the air, the electrolyzer's hole-wide tank fill slider (default off) and its "into the O2 reserve" flow, drops and kits landing in tanks, and the 0%-condition rule for every tank (keeps what it holds, takes no more). Done: tanks smooth out O2 swings and save electrolyzer water.

## Docs to update
ROOMS.md (gas tank), GUIDE.md: Air and storage, DECISIONS.md (0% tanks), PLAN-M16.md Notes as built.

## History
- 2026-10-06 00:08 opened from F-002 (agreed)
