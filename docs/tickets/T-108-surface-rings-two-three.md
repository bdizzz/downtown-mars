---
id: T-108
title: Surface rings 2 and 3 for above-ground buildings
status: open
size: L
area: sim, render3d
touches: [data/config.json, src/sim/placement.ts, src/sim/config.ts, src/render3d/, src/render2d/plan.ts, godot/src/, src/bridge/]
blocked_by: []
notes: [N-0062]
created: 2026-10-10 00:18
---
## Problem
"We should add a 2nd and 3rd 'ring' of above-ground building spots. Let's not worry about opening up surface rings 4-6 yet."

## Context
The surface is a single ring of 12 slots today (`geometry.surfaceSlots`), stored as a flat `surface` array in placement (`src/sim/placement.ts`), with `surfaceSlots` per room for width. Underground rings grow with radius (`slots(n) = round(2π·(R + (n − 0.5)·d)/w)`); surface rings could follow the same rule outward from the surface ring's radius (`SURFACE_RING_M` in `src/render3d/scenery3d.ts`). Surface rooms are reached from the shaft rim; check whether ring-2/3 rooms need any access rule. Saves need migrating (the flat array becomes per ring). The plan view, the 3D view, the bridge and Godot all draw surface rooms. T-107 (surface spots shaded in build mode) should draw whatever rings exist.

## Approach
Make the surface a set of rings (1–3 open from the start, room for 6), sized like underground rings, placement and adjacency by ring and slot, the save migrated, and every view drawing them. Outer surface rooms need no connection to place, but the game lays cables automatically between surface rooms and the shaft rim (drawn in 3D and Godot, no player action). Done: surface rooms can be built on three surface rings in web and Godot, and old saves load with their surface rooms on ring 1.

## Open questions
- [x] Open from the start or unlocked? Open from the start.
- [x] Do outer surface rooms need anything to connect them? Anywhere on the three rings is fine, but things are connected automatically with cables.

## Docs to update
DESIGN.md / DECISIONS.md: surface rings; GUIDE.md: surface buildings.

## History
- 2026-10-10 00:18 opened from N-0062
- 2026-10-10 questions answered: anywhere is fine, cables laid automatically
- 2026-10-10 00:27 questions answered
- 2026-10-10 questions answered: rings 2 and 3 open from the start
- 2026-10-10 00:38 questions answered
