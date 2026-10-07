---
id: T-036
title: Fiber hemp crop and the fiber material
status: done
size: S
area: data, rooms
feature: F-003
touches: [data/crops.json, data/resources.json, data/storage.json, src/sim/economy.ts]
blocked_by: []
notes: [N-0006, N-0007]
created: 2026-10-06 00:10
---
## Problem
Floor panels need fibre, and nothing makes it yet: add fiber hemp as a farm crop whose output is a new `fiber` material.

## Context
Read F-003 (`docs/tickets/F-003-room-materials.md`) and its plan, `docs/PLAN-M15.md`, first; this is step 5 of its Steps. All numbers come from the plan's Defaults, in `data/materials.json`.

## Approach
Fiber hemp in `data/crops.json` (ROOMS.md: yield 6, water 4, power 3 for an L farm) making `fiber` instead of raw food; `fiber` in resources, stored like other dry goods. Done: a hemp farm fills a store with fibre.

## Docs to update
ROOMS.md (crops), PATHWAYS.md (materials), GUIDE.md: Farms, PLAN-M15.md Notes as built.

## History
- 2026-10-06 00:10 opened from F-003 (agreed)
- 2026-10-06 09:47 building on t-036-fiber-hemp
- 2026-10-06 09:55 built
