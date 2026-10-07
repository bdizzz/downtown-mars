---
id: T-031
title: Rebalance the air loop
status: open
size: M
area: balance, sim
touches: [data/config.json, data/rooms.json, tests/]
blocked_by: [T-028, T-029, T-030]
feature: F-002
notes: [N-0005]
created: 2026-10-06 00:08
---
## Problem
With the air loop in, tune it so a steady colony uses almost no water for air, and growth shows up as electrolyzer water.

## Context
Read F-002 (`docs/tickets/F-002-air-mix.md`) and its plan, `docs/PLAN-M16.md`, first; this is step 6 of its Steps.

T-026 eased bot tests that this ticket should restore (Bryon, Oct 7: "adjust tests, note T-031"), each marked "T-031" in its comment:
- `tests/playthrough.test.ts`: lowest health over 35 (was 60); Earth's water may cover what's split into air plus 10% of the rest (was 10% of all).
- `tests/people-playthrough.test.ts`: the network beats solo by 1.2× (was 1.3×); births at least 5 (T-005's); the child hole only has to survive (was health over 50 and over 50 people). This seed's child digs its air thin, falls below Earth's health bar for colonists, never staffs a recycler, and starves when gray water stalls its galley.
- `tests/network-playthrough.test.ts`: the child's lowest health over 40 (was 60).

## Approach
Tune `air.unitsPerM3`, the electrolyzer's ratio, the seed kit, Earth's O2 gap and the bots. Add a test pinning both: a steady colony's air water is near zero, and digging shows up as electrolyzer water. Done: `npm test` passes with the bots thriving.

## Docs to update
DECISIONS.md (air numbers), PLAN-M16.md Notes as built, and close out the plan.

## History
- 2026-10-06 00:08 opened from F-002 (agreed)
