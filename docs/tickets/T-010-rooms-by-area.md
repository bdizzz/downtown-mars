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

One task already known: **the furnishing tool (`?furnish`, `src/devtools/`) adapts to areas**, and a room's target area is one of the things you set there (Bryon, Oct 4).

**Becomes a feature (T-012).** Bryon wants this planned as a feature (an epic): the plan, details and how to break the work into tasks live in the feature, and task tickets are written only once the feature is agreed. Until T-012 lands, this ticket stands in for the feature.

## Docs to update
- DECISIONS.md, DESIGN.md (spatial model), ROOMS.md (sizes as areas), FURNITURE.md (layouts per area, not per ring), GUIDE.md: Building, CLAUDE.md (Core spatial model).

## Open questions
- [x] A plan doc first, for Bryon to review before any code. (Bryon, Oct 4)
- [x] Drag handles on the left/right walls (normal rooms ±10–15%, fill rooms much further), plus double-clicking a gap to fill it. (Bryon, Oct 4)
- [x] S/M/L/H stay as target areas: 100, 200, 400 and 800 m². (Bryon, Oct 4)
- [x] Old saves convert their slots to angles. (Bryon, Oct 4)

## History
- 2026-10-04 18:03 opened from N-0008
- 2026-10-04 19:05 questions answered
