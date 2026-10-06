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

## Approach
Tune `air.unitsPerM3`, the electrolyzer's ratio, the seed kit, Earth's O2 gap and the bots. Add a test pinning both: a steady colony's air water is near zero, and digging shows up as electrolyzer water. Done: `npm test` passes with the bots thriving.

## Docs to update
DECISIONS.md (air numbers), PLAN-M16.md Notes as built, and close out the plan.

## History
- 2026-10-06 00:08 opened from F-002 (agreed)
