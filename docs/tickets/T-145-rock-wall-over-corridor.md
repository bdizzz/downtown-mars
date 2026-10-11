---
id: T-145
title: A thin rock wall half-covers corridors beside unexcavated outer-ring slots
status: done
size: M
area: render3d
touches: [src/render3d/rooms3d.ts, src/render3d/cylinder.ts]
blocked_by: []
notes: [N-0079]
created: 2026-10-11 15:52
---
## Problem
"In web 3d mode, sometimes corridors are obstructed by a thin wall of rock. This happened when there is a room on an inner ring, then an unexcavated segment adjacent on an outer ring, and a corridor running in/out along one side of the room. The unwanted wall sticks out from the unexcavated segment and covers the corridor halfway."

## Context
Rock faces and walls are built in `src/render3d/rooms3d.ts` (walls centred on the edge line, 0.25 m thick, DECISIONS: 3D view); corridors run on edges. Likely the unexcavated slot's rock face is drawn on its full edge, including the part where a radial corridor runs past its corner. T-079 (entry room walls showing through) and T-109 (cutaway rock face) are nearby fixes in the same code.

## Approach
Reproduce in a test save (a ring-1 room, rock beyond it on ring 2, a radial corridor along the room's side), find which face pokes in, and trim it where a corridor runs. Check Godot, which reuses the scene building through the bridge. Done: the corridor is clear in that layout.

## History
- 2026-10-11 15:52 opened from N-0079
- 2026-10-11 18:47 building on t-145-rock-wall-over-corridor (with T-079)
- 2026-10-11 18:54 built: rock faces on a border now follow the rock's carved outline, so a corridor joint's notch leaves no face across the corridor
