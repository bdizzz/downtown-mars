---
id: T-019
title: Thin black seams on ceilings between rooms and over unexcavated rock
status: open
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

## Approach
Find which it is: drop ceiling edges from the outlines, or build each ceiling/rock-top as one merged surface per floor (or close the gaps). Done: no seams on ceilings or over rock, from any camera; hover and selection boxes unchanged.

## History
- 2026-10-05 01:11 opened from N-0014
