---
id: T-132
title: "Excavator bay, plaza and spiral stair"
status: done
size: M
area: rooms, data
feature: F-015
touches: [data/rooms.json, src/sim/, src/render3d/, data/furniture.json, data/layouts.json]
blocked_by: []
notes: [N-0068]
created: 2026-10-11 15:50
---
## Problem
Build the three catalog rooms that need nothing new: excavator bay (faster digging), plaza (a bigger small plaza) and spiral stair (a stairwell with comfort, spanning 2 floors).

## Context
Read F-015 first. Each room's catalog row is in `docs/ROOMS.md`; `docs/ROOM-STATUS.md` shows what's built.

As built: the excavator bay's boost is `drillBoost` in rooms.json (0.5 per bay at full staff, `drillSpeed` in `sim/digging.ts`); the plaza is walk-through with an amenity (comfort 2 within 8 steps) like the smaller plazas, and unstaffed like them; the spiral stair is a stack capped at 2 floors (`stacks`, `maxFloors: 2`), so stair code (furnishing by floor, wells, R/F in first person) treats it as stairs. Its spiral model isn't walked up in first person (the walker climbs only straight `climb` flights).

## Approach
Add each to `data/rooms.json` from its ROOMS.md row (excavator bay: M, power 3, faster digging and rock, noise; plaza: L, comfort +2 r2, unlock pop 500; spiral stair: S spanning 2 floors, comfort +1 r1, pop 200), wire any effect the sim needs (excavator bay speeding the drill), furnish them (`data/layouts.json`), and rerun `node scripts/room-status.mjs`. Web, bridge and Godot pick them up from data; check each.

## Docs to update
ROOMS.md and ROOM-STATUS.md (rerun `node scripts/room-status.mjs`); GUIDE.md for new rooms or resources.

## History
- 2026-10-11 15:50 opened from F-015 (agreed)
- 2026-10-12 01:07 building on t-132-grade-a-rooms
- 2026-10-12 01:17 built
