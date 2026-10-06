---
id: T-058
title: Self-sufficiency milestones: alive with Earth, with trade, on its own
status: open
size: L
area: sim, data
touches: [src/sim/milestones.ts, src/sim/earth.ts, src/sim/network.ts, data/milestones.json]
blocked_by: [T-055]
feature: F-005
notes: [N-0025]
created: 2026-10-06 01:40
---
## Problem
F-005's three survival levels: a hole that can keep its people alive indefinitely at its current size (1) with Earth's supply drops, (2) with trade but no drops, (3) on its own; plus "a year on our own" (no supply drop for a year).

## Context
See F-005's Design. A hole must **hold steady for one game month** before a level counts (Bryon, Oct 6). Drops are in `src/sim/earth.ts`, trade in the network code. F-001 (water) and F-002 (air) will change the water and air balances; build on whatever resources exist now and keep the check generic per resource.

## Approach
A rolling daily net balance per life resource (food, water, air, power): production minus consumption, with drops and trade imports counted separately; a level holds while the net (with its allowed sources) stays ≥ 0 and stores aren't falling. Count consecutive days; reached at a month. Tests with bots for each level. Done: a starter hole reaches level 1 in a normal run; level 3 needs real farms and life support.

## Docs to update
DECISIONS.md: how self-sufficiency is judged.

## History
- 2026-10-06 01:40 opened from F-005's breakdown
