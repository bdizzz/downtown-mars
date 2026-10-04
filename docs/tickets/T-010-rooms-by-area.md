---
id: T-010
title: Rooms sized by area and placed by angle, with snapping and fill rooms
status: open
size: XL
area: sim, render3d
touches: [src/sim/, src/render3d/, src/render2d/, src/ui/BuildPalette.tsx, src/sim/save.ts, data/rooms.json, data/layouts.json, godot/]
blocked_by: []
notes: [N-0008]
created: 2026-10-04 18:03
---
## Problem
The same room has very different furniture layouts on ring 1 and ring 2, because a slot's area grows a lot between rings (most between rings 1→2 and 2→3). Bryon proposes a different system:
1. Each room has a **target area**; each ring keeps a fixed depth.
2. When building, the target area and the ring's depth become an **angle** (the span of the ring that gives that area). Rings have no fixed slots, and rooms are identified by area, not slot count.
3. **Snapping**, on by default and toggleable while placing: a proposed room snaps to a nearby neighbour on the same ring, and to room ends on other rings so corridors across rings line up. Rooms get about **±10–15%** area leeway to make a snap.
4. **Fill rooms** (empty rooms, plazas) can take any angle, to fill awkward gaps. Either a **fill tool** that fills between two bookending rooms (capped at, say, 60°), or **drag handles** on a proposed room's left/right walls (normal rooms ±10–15%, fill rooms much further), with snapping while dragging and a clear valid/invalid state.

## Context
This replaces the core spatial model: (floor, ring, slot), `slots(n) = round(2π(R + (n − 0.5)d)/w)`, slot-wrapped rings, corridors on edges between slots, neighbor effects as a per-slot field, walking distance in 10 m steps, excavation per slot, S/M/L/H = 1/2/4/8 slots, layouts per size, saves, the 2D unrolled and plan views, the bridge and Godot. Adjacency across rings is already by angular overlap, which helps.

Things in DECISIONS.md it touches: the slot model (Spatial), corridors along edges (and the reversal "Don't bring back 1-slot corridor rooms": still fine, corridors stay on edges), room sizes S/M/L/H.

## Approach
XL, a milestone of its own: write `docs/PLAN-M15.md` (or the next number) first: the new coordinate (floor, ring, start angle, span), how edges and corridors are found between arbitrary angles, how neighbor fields and walking steps work without slots, excavation, save migration from slots, then the placement UI (snapping, toggle, handles or fill tool). Possibly in phases: model and migration first with today's sizes as angles, then snapping, then fill rooms.

## Docs to update
- DECISIONS.md, DESIGN.md (spatial model), ROOMS.md (sizes as areas), FURNITURE.md (layouts per area, not per ring), GUIDE.md: Building, CLAUDE.md (Core spatial model).

## Open questions
- [ ] Go ahead with a design plan before any code? Proposed: yes, a plan doc for Bryon to review first, since it changes the core model.
- [ ] Fill rooms: the fill tool, the drag handles, or both? Proposed: handles (they also give normal rooms their ±10–15%), and a double-click on a gap as a shortcut that fills it.
- [ ] Keep the S/M/L/H names as target areas (S = 100 m², M = 200, L = 400, H = 800, about today's ring-2 slot)? Proposed: yes.
- [ ] Old saves: convert their slots to angles (rooms keep their spans and areas grow or shrink by ring), or start fresh? Proposed: convert.

## History
- 2026-10-04 18:03 opened from N-0008
