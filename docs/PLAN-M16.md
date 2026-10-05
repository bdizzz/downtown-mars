# Milestone 16 plan: rooms by area, placed by angle

Goal: the same room is the same size on every ring. Each room type has a **target area**; placing it on a ring turns that area and the ring's depth into an **angle**. Rings lose their fixed slots. Placing gets **snapping** (to neighbours on the ring, and to room ends on other rings), **drag handles** on a proposed room's side walls, and **fill rooms** (empty space, plazas) that stretch to close awkward gaps.

Asked for by Bryon, Oct 4, 2026 (note N-0008, then T-010, now feature F-004): "a drawback of the current system is that the furniture layout of the same room on ring 1 vs ring 2 is very different". His answers: S/M/L/H become 100, 200, 400 and 800 m²; drag handles plus double-clicking a gap; old saves convert their slots to angles; a plan first, before any code. Everything else below is Claude's default, flagged so it's easy to change; every number goes in data.

## Why

A slot is an equal share of a ring, so its area depends on the ring. With today's paired rings (9, 9, 18, 18, 36, 36 slots on R = 10 m, d = 10 m):

| Ring | Radii (m) | Slots | Area of a slot (m²) | S at 100 m²: angle | Notches (below) |
| --- | --- | --- | --- | --- | --- |
| 1 | 10–20 | 9 | 105 | 38.2° | 153 |
| 2 | 20–30 | 9 | **175** | 22.9° | 92 |
| 3 | 30–40 | 18 | 122 | 16.4° | 65 |
| 4 | 40–50 | 18 | 157 | 12.7° | 51 |
| 5 | 50–60 | 36 | 96 | 10.4° | 42 |
| 6 | 60–70 | 36 | 113 | 8.8° | 35 |

So a galley on ring 2 has 75% more floor than one on ring 1, and its furniture sits differently. By area, every S room is about **10 m wide at its middle** on every ring (area ÷ depth = the arc length at mid-radius); only the taper changes (on ring 1 the inner wall is 6.7 m and the outer 13.3 m; on ring 3, 8.6 and 11.4). Think of rings as bands of a dartboard: instead of cutting each band into a fixed number of pieces, you cut pieces of the same weight, so outer bands just get more of them (about 9, 16, 22, 28, 34 and 41 S rooms round rings 1–6).

## Defaults (to confirm or change)

### The model

- **Angles are whole notches:** 1,440 a turn (a quarter of a degree; 31 cm at ring 6's outer wall). Integers, so the same point always has the same value, edges meet exactly, rooms on different rings line up exactly, and nothing drifts with float error. 1,440 divides by 9, 16, 18 and 36, so today's slot boundaries convert exactly (22-slot rings, in older saves, round to the nearest notch, the same way on both sides of a boundary, so nothing opens a gap).
- **A ring room's location** becomes `{ kind: "ring", floor, ring, depth, start, span }`: the innermost ring, how many rings deep (1 or 2), and its start angle and span in notches, wrapping at 1,440. A deep room takes the same angles on every ring it covers (a clean wedge, as the inner ring's angle range already is today). Surface rooms keep their 12 surface slots; they're not part of this.
- **Area ↔ angle:** area = span (radians) × (r_out² − r_in²) / 2 over the rings it covers. A room's **target area** is its size's area (`config.sizes`: S 100, M 200, L 400, H 800 m²), or its own `area` in `rooms.json` when a type wants something else (set from the furnishing tool). Its **shape** is the depth: S and M are 1 ring deep; L is 1 or 2 deep (today's 4×1 and 2×2); H 1 or 2 (`config.shapes` becomes depths per size).
- **What a room does doesn't depend on its exact area.** Within its leeway (below) a galley seats 25 whether it's 88 or 115 m²; the leeway is looks and fit, not a balance lever. Fill rooms are the exception for cost (below).
- **Space is kept as intervals, not a grid.** Per floor and ring: which room holds each angle range (`occupancy`, sorted spans), and which ranges are excavated (`open`, merged spans). A room overlaps another if their spans overlap on any floor and ring they share. Rock is whatever isn't open.
- **Pieces replace cells** as the thing other systems walk over: on each floor and ring, the angle is cut wherever something starts or ends (a room, empty space, rock). A piece is `{ floor, ring, a0, a1 }`: a room's part on that ring, a stretch of empty space (open, no room), or rock. Rock and empty space are cut further into pieces no wider than about 10 m, so neighbour effects and air still spread through them in small steps rather than jumping a whole quarter-ring at once.

### Edges and corridors

- Corridors still run **on edges**, between rooms and between rooms and rock ("Don't bring back 1-slot corridor rooms" stands). There are two kinds of line on a floor: **circles** (circle 0 is the shaft wall, circle n the outer edge of ring n) and **radial lines** across one ring at one angle.
- **Corridors are stored as runs on lines,** not per edge: an arc run is `(floor, circle, from, to)`, a radial run `(floor, ring, angle)`, each with its finish. A corridor can run along a radial line at **any** notch, not just at room ends (the tool snaps it to room ends nearby; see Placement). A full gallery on floor 1 is one run, `circle 0, 0 → 1,440`.
- **Edges are derived:** the runs and the room walls cut at every vertex where something meets (another corridor, a room's end on either side of the circle, a door). Each piece of edge has a stable id from its integers, `A{floor}.{circle}.{from}-{to}` and `R{floor}.{ring}.{angle}`, and `edges.ts` keeps its API (`edgeById`, `edgeSides`, `outsideEdges`, `sharedEdges`, `edgeLengthM`, `nearestEdge`, `galleryEdges`), so the consumers (access, doors, paths, the views) change little. A corridor's cost is still per 10 m of its length.
- **Bulkheads** sit on a run between two notches (fitted on one edge piece, as today; if a new junction later cuts that piece, the bulkhead stays on the part it was on). **Windows** are stored by wall, not edge id: `inner`, `outer`, `start`, `end`, per floor for tall rooms, so a wall stays glazed however the edges along it are cut. **Doors** keep M13's rule (the best wall: a tube, else the longest corridor, else a walk-through room).

### Neighbour effects, air and walking

- **Neighbour effects** (noise, health, comfort, view) spread over pieces instead of cells: from a room's pieces outward through neighbouring pieces (along the ring, across rings where angles overlap, up and down a floor), costing the metres between their middles, fading linearly to nothing just past the radius. **Radius stays in data as steps of 10 m** (a radius of 2 reaches 20 m), close to today's slot-steps. Corridors still soak up noise: an effect doesn't cross a border that's corridor all along. Overlays colour each piece.
- **Air and smell** ride the network as today (`paths.ts` already works in metres). **Walking distance** too: nodes are corridor edge pieces, walk-through rooms, empty-space pieces and rooms, each costing its own length; reach stays in steps of 10 m. The ring-by-ring air baseline (`effects.airQualityByRing`) is unchanged.

### Placement

- **A proposed room** shows at the cursor's angle with its target area for that ring. It goes green (fits), amber (fits, but no corridor yet) or red (overlaps, out of reach), as today.
- **Leeway:** a room may end up **±15%** of its target area to make a snap or a handle drag (`placement.leeway` 0.15). On ring 1 that's an S of 130–176 notches.
- **Snapping, on by default:** within the leeway, a proposed room's ends snap to, in order: both ends at once to exactly fill a gap between two neighbours on its ring; one end against a neighbour on its ring (no sliver left); one end in line with a room end, a radial corridor, or another room's end on the ring inside or outside, so corridors can run straight across rings. A small tick marks what it snapped to. **A toggle** in the build strip, and a key, turn snapping off and on without leaving placement; with it off, the room sits at the cursor at exactly its target area. Stairs and elevators always snap onto a stack below or above them (they must line up exactly to join).
- **Drag handles** on a proposed room's two side walls: drag one to stretch or shrink that side, snapping while you drag, the room red past its range. Normal rooms move within the leeway; **fill rooms** much further. Placing leaves the handles on the proposal until it's committed (click again, or Enter); Escape drops it. A room left invalid is never built.
- **Fill rooms** (`fill: true` in `rooms.json`): the empty rooms and the tiny and small plazas. They range from **50% to 300%** of their target area, and never more than **90°** (`placement.fill`), so a plaza on ring 1 can't wrap half the hole. **The three empty rooms become one, "Empty space"**, with S's 100 m² as its target, since its size no longer means much. A fill room's **cost and dig time scale with its area**; its effects don't.
- **Double-clicking a gap** with a fill room selected fills it, wall to wall: the gap between two rooms (or a room and the edge of the dug-out rock) on that ring, if it's within the fill room's range. Otherwise the hover says why ("Too wide: up to 300 m²").
- **Nothing is slot-shaped any more:** `ringSlots`, `slotsInRing`, `pairedRings` and `nestedPairs` go; `geometry.slotWidthM` is only used to size the 10 m step.

### Furnishing

- Templates stay **pinned to walls with offsets in metres** (they already stretch with the room). They're keyed by type and shape, `galley:M` or `farm:L2` (size, plus depth when it's more than 1), instead of `galley:2x1`. Since every room of a type is now about the same size, one template looks right everywhere; the taper is what's left to cope with.
- **The furnishing tool (`?furnish`)** previews a template on any ring at any area in the leeway (a slider), and **sets a room type's target area** (written to `rooms.json` as `area`).

### Costs and timings

- **Digging:** rock and deposit yields are per 100 m² dug (`digging.rockPerSlot` becomes `rockPer100m2`, and so on), so an S room brings up what an S slot did. The shaft's yield is its own area over 100.
- **Construction hours** stay per size (`construction.json`); fill rooms scale by area.

### Saves

- One migration (to version 19): each ring room's slots become notches (start = slot × 1,440 / slots in the ring, span likewise; deep rooms take the inner ring's angles, as their footprint already does). **Old rooms keep their exact angles, and so their old areas** (a ring-2 room stays 75% big), so nothing moves, no gaps open and every corridor still meets its room. They furnish by their real area and can't be resized. `open` and `grid` become intervals; corridors' edge ids become runs (merged where they join up); bulkheads keep their piece; windows' edge ids become walls. Effects are recomputed.
- **Bridge and worker protocol:** the `build` command carries `start`, `span` and `depth` instead of `slot`, `w` and `d`; the snapshot carries the new locations. A breaking change (`feat(sim)!`), made once, in the step that switches placement over.

### Views, the bridge and Godot

- **3D** (`render3d/cylinder.ts`, `rooms3d.ts`, `pick3d.ts`, `people3d.ts`, `flows3d.ts`): rooms, walls, corridors and picking from angles instead of slot indices. Most already draw wedges from angle ranges (`slotAngles`), so the change is mostly where they get them.
- **2D**: the unrolled view lays each ring out at its mid-radius length, so rooms of the same area are the same width on every ring; the plan view (`planDraw.ts`, shared with the bridge) draws wedges from angles.
- **Godot**: `PlanView.cs`, `Live.cs` and `BuildMode.cs` read the new location; snapping, handles and fill come to its build mode in their own step. The scene already comes from the web's own code through the bridge.

## What stays the same

Floors, stairs and elevators, the shaft and the drill, the entrance, the surface's 12 slots, tall rooms, M13's doors and window comfort, the corridor finishes and their prices per 10 m, walk reach in steps, the air network, rings 1–3 open (rings 4–6 stay undecided).

## Steps

Each is one PR and leaves the game working. Until step 8, rooms are still placed on today's slots, but everything underneath reads angles; `room.cells` stays as a slot-shaped field derived from the angles so code not yet moved keeps working, and goes in step 8.

1. **Notches and spans** (M). Area ↔ angle helpers and ring radii in `geometry.ts`; every ring room also gets `start`, `span`, `depth`; save migration fills them. No behaviour change.
2. **Space as intervals** (L). Occupancy and excavation as spans per floor and ring (`sim/space.ts`), replacing `layout.grid` and `layout.open`; pieces; overlap, `roomAt` by angle, empty space and rock by intervals; excavation and lava tubes on spans.
3. **Corridors on lines** (L). Corridors as runs; edges derived and cut at vertices, with notch ids; access, the gallery, bulkheads, doors, windows by wall; the corridor tool drags along circles and radial lines; save migration of corridors, bulkheads and windows.
4. **Effects and paths over pieces** (L). Neighbour effects over pieces in metres, air and walking over the new edges, overlays per piece. The playthroughs should come out about the same; differences are explained in the PR.
5. **The 3D view on angles** (L). Rooms, walls, corridors, picking, people and flows, and furniture fitting from spans.
6. **The 2D views on angles** (M). The unrolled view at mid-radius length and the plan view; the bridge's plan comes with it.
7. **The bridge and Godot on angles** (M). The snapshot and scene, `PlanView.cs`, `Live.cs` and `BuildMode.cs` reading the new location.
8. **Placing by area** (L). The switch: rooms go at any angle with their target area; `build` carries the angle (breaking); slots and paired rings retired; dig yields and fill-room costs by area; the landing kit, bots and tests placed by angle; `room.cells` removed.
9. **Snapping and its toggle** (M). In the web build mode: the snap order above, the tick marks, the toggle and key.
10. **Drag handles and fill rooms** (L). Handles on a proposal, the leeway and fill ranges, Empty space as one fill room, plazas as fill rooms, double-click to fill a gap. Web.
11. **Snapping, handles and fill in Godot** (M). Its build mode catches up.
12. **The furnishing tool by area** (M). Templates keyed by size and depth, previews at any ring and area, and a type's target area set from the tool.

Docs ride with each step: `CLAUDE.md` (core spatial model) and `DECISIONS.md` in step 8, `DESIGN.md` (space) and `ROOMS.md` (sizes as areas) in step 8, `GUIDE.md` (Building) in steps 8–10, `FURNITURE.md` in step 12, `PLAN-GODOT.md` in steps 7 and 11.

## Open questions (Bryon)

1. **Leeway ±15%?** You said 10–15%; the plan takes the top so snaps find more to grab.
2. **Old rooms keep their angles and their old areas** (a ring-2 room stays 175 m²), so nothing moves? The alternative, shrinking them to their target areas, leaves gaps and breaks corridors.
3. **Fill rooms:** Empty space (the three empty rooms as one) and the tiny and small plazas, from 50% to 300% of their area, costing by area. Should the park be one too? And should a bigger plaza do more (reach further, or more comfort), or only cost more?
4. **Fill limits:** 50–300% of the area and at most 90°? (Your earlier idea was 60°. At 300%, a tiny plaza is 115° on ring 1 and 49° on ring 3, a small plaza 229° and 98°, so the angle cap is what bites on the inner rings.) And double-click fills only with a fill room selected?

## Notes as built
