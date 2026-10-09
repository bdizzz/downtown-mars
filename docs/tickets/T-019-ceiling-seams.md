---
id: T-019
title: Thin black seams on ceilings between rooms and over unexcavated rock
status: done
size: M
area: render3d
touches: [src/render3d/rooms3d.ts, src/render3d/stage3d.ts]
blocked_by: []
notes: [N-0014]
created: 2026-10-05 01:11
---
## Problem
"There are thin black lines on the ceiling borders between rooms." They show on an empty floor too, "above all the room segments of unexcavated rock." Neither should be visible. Removing them "shouldn't affect any hover or selection boxes though."

## Context
- Ceilings and the rock above rooms are built in `src/render3d/rooms3d.ts` (around lines 658–700: "a ceiling over a room or empty space on the floor below", the crust's underside). Seams like this are usually either outline lines (`outlineGeometry`, `EdgesGeometry` at 30°) drawn along every segment, or hairline gaps / T-junctions between per-segment meshes letting the dark background show through.
- Hover and selection use separate overlay geometry in `stage3d.ts` (`outline`, `ghostEdge`, `fillCells`), which should stay as is.
- Check Godot too, since the bridge reuses the web's scene building.
- As built: two causes. The picked floor's rock lid drew a hairline spoke at every slot border (`floorCap`'s grid lines): the seams over unexcavated rock, and between rooms along their shared wall tops. And floors, ceilings and the lid split each cell's arcs into 4 equal steps, so neighbouring rings (with different slot widths) didn't share corners and their chords left slivers along ring borders. Fix: no lid lines; `flatPiece` (and `flatRing` for whole cells) keeps to the hole-wide `ARC_GRID`, as solid walls already did. Outlines (room trouble colours) and the hover/selection overlays are unchanged.

## Approach
Find which it is: drop ceiling edges from the outlines, or build each ceiling/rock-top as one merged surface per floor (or close the gaps). Done: no seams on ceilings or over rock, from any camera; hover and selection boxes unchanged.

## History
- 2026-10-05 01:11 opened from N-0014
- 2026-10-08 23:05 building on t-019-ceiling-seams
- 2026-10-08 23:21 built
