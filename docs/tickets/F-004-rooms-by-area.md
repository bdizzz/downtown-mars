---
id: F-004
title: Rooms sized by area and placed by angle, with snapping and fill rooms
status: draft
plan: docs/PLAN-M16.md
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

**The plan: `docs/PLAN-M16.md`.** In short:
- Angles are whole **notches**, 1,440 a turn, so edges meet exactly and rooms on different rings line up exactly. A ring room is `(floor, ring, depth, start, span)`; area = span × (r_out² − r_in²) / 2, so every S room is about 10 m wide at its middle on any ring.
- Space is kept as **intervals** per floor and ring (which room holds each angle range; what's dug), and **pieces** (a room's part of a ring, empty space, rock cut to ~10 m) replace cells for effects and air.
- **Corridors are runs on lines** (circles and radial lines at any notch); edges are derived by cutting runs at vertices and keep `edges.ts`'s API. Windows are stored by wall, not edge.
- Placement: ±15% leeway, snapping on by default (fill a gap, abut a neighbour, line up with ends on the rings inside and out) with a toggle; drag handles; fill rooms (Empty space, tiny and small plazas) from 50–300% of their area and at most 90°, costing by area; double-click a gap to fill it.
- Old saves keep their rooms' exact angles (and old areas), so nothing moves.
- Phased: everything underneath moves to angles while rooms are still placed on slots (steps 1–7), then one switch to placing by area (step 8), then snapping, handles and the furnishing tool.

## Breakdown
Proposed; becomes tickets once this feature (and its plan) is agreed. In build order; each leaves the game working (until step 8, rooms are still placed on slots, with angles underneath).
- Notches and spans: area ↔ angle helpers, every ring room also gets start/span/depth, save migration; no behaviour change (M)
- Space as intervals: occupancy and excavation as spans per floor and ring (`sim/space.ts`) replacing `grid` and `open`, and pieces (L)
- Corridors on lines: corridors as runs, edges cut at vertices with notch ids, access, gallery, bulkheads, doors, windows by wall, the corridor tool, save migration (L)
- Effects and paths over pieces: neighbour effects in metres, air and walking on the new edges, overlays per piece (L)
- The 3D view on angles: rooms, walls, corridors, picking, people, flows and furniture fitting from spans (L)
- The 2D views on angles: the unrolled view at mid-radius length and the plan view (and the bridge's plan) (M)
- The bridge and Godot on angles: snapshot and scene, `PlanView.cs`, `Live.cs`, `BuildMode.cs` (M)
- Placing by area: rooms at any angle with their target area, `build` carries the angle (breaking), slots and paired rings retired, dig yields and fill costs by area, landing kit, bots and tests (L)
- Snapping and its toggle in the web build mode (M)
- Drag handles and fill rooms: leeway and fill ranges, Empty space as one fill room, plazas as fill rooms, double-click to fill a gap (L)
- Snapping, handles and fill in Godot's build mode (M)
- The furnishing tool (`?furnish`, `src/devtools/`) by area: templates keyed by size and depth, preview at any ring and area, a type's target area set there (Bryon, Oct 4) (M)

## Open questions
- [ ] Leeway ±15% (the top of your 10–15%, so snaps find more to grab)?
- [ ] Old rooms keep their angles and so their old areas (a ring-2 room stays 175 m²), so nothing moves and no corridor breaks?
- [ ] Fill rooms: Empty space (the three empty rooms as one), tiny and small plazas; the park too? Does a bigger plaza do more, or only cost more (the plan: only cost)?
- [ ] Fill limits 50–300% of the area and at most 90° (your earlier idea was 60°), and double-click fills only with a fill room selected?

## History
- 2026-10-04 19:12 made from T-010 (T-012 moved rooms by area into a feature)
- 2026-10-05 18:57 planning on f-004-rooms-by-area
