---
id: F-004
title: Rooms sized by area and placed by angle, with snapping and fill rooms
status: draft
plan:
notes: [N-0008]
created: 2026-10-04 19:12
---
## Goal
The same room looks the same on every ring. Today a slot's area grows a lot between rings (most from ring 1 to 2 and 2 to 3), so one room's furniture layout differs wildly by ring. Instead, each room has a **target area**, and placing it turns that area and the ring's depth into an **angle**.

## Design
Bryon's proposal (N-0008) and answers (Oct 4, first written up in T-010):
1. Each room has a **target area**; each ring keeps a fixed depth. Rings have no fixed slots; rooms are identified by area. **S/M/L/H stay as target areas: 100, 200, 400 and 800 m².**
2. **Snapping**, on by default and toggleable while placing: a proposed room snaps to a nearby neighbour on the same ring, and to room ends on other rings so corridors across rings line up. Rooms get about **±10–15%** area leeway to make a snap.
3. **Drag handles** on a proposed room's left and right walls (normal rooms ±10–15%, **fill rooms** such as empty rooms and plazas much further), snapping while dragging, with a clear valid/invalid state. **Double-clicking a gap** fills it.
4. **Old saves convert their slots to angles.**
5. **A plan doc first**, for Bryon to review before any code.

This replaces the core spatial model: (floor, ring, slot), `slots(n)`, slot-wrapped rings, corridors on edges between slots, neighbor effects as a per-slot field, walking distance in 10 m steps, excavation per slot, S/M/L/H = 1/2/4/8 slots, layouts per size, saves, the 2D unrolled and plan views, the bridge and Godot. Adjacency across rings is already by angular overlap, which helps. Corridors stay on edges (DECISIONS.md: "Don't bring back 1-slot corridor rooms").

The plan (the next free `docs/PLAN-M*.md`, written by `/build F-004` and linked in `plan:` above) covers the new coordinate (floor, ring, start angle, span), how edges and corridors are found between arbitrary angles, neighbor fields and walking steps without slots, excavation, save migration, and the placement UI.

## Breakdown
Proposed; becomes tickets once this feature (and its plan) is agreed. Phased so the game keeps working between tasks.
- The model and save migration: rooms as (floor, ring, start angle, span), with today's sizes as angles
- Edges, corridors, neighbor fields, walking steps and excavation without slots
- The 2D unrolled and plan views, the bridge and Godot on the new model
- Snapping while placing, with its toggle
- Drag handles, fill rooms and double-click to fill a gap
- The furnishing tool (`?furnish`, `src/devtools/`) works by area, sets a room's target area, and layouts become per area instead of per ring (Bryon, Oct 4)

## History
- 2026-10-04 19:12 made from T-010 (T-012 moved rooms by area into a feature)
