---
id: T-179
title: Try 0.5 m thick walls instead of 0.25 m
status: done
size: S
area: render3d, data
touches: [data/config.json, src/render3d/rooms3d.ts, src/view/doors.ts, src/view/furnish.ts, godot/src/]
blocked_by: []
notes: [N-0096]
created: 2026-10-24 23:44
---
## Problem
"Let's try using 0.5m for wall thickness, not 0.25m."

## Context
One number: `geometry.wallThicknessM` in `data/config.json` (0.25), read as `WALL_T` in `src/render3d/cylinder.ts` and used by `rooms3d.ts` (walls centred on edge lines, mitres, corridor stops), `src/view/doors.ts` and `src/view/furnish.ts` (furniture clearance). DECISIONS (3D view) records "0.25 m thick". Godot gets the scene through the bridge, but check for its own copy of the number.

## Approach
Set it to 0.5 and look for what breaks: furniture against walls, doors and window reveals, mitres at corners, corridor ends, walls-down stubs, labels (T-077), first-person walking room. Fix those, screenshots before and after in the PR, and `/try` it so Bryon can judge. Done: 0.5 m walls everywhere with nothing clipping, or a note on why it doesn't work.

## Docs to update
DECISIONS.md: 3D view (wall thickness), if it sticks.

## History
- 2026-10-24 23:44 opened from N-0096
- 2026-10-24 23:48 building on t-179-thicker-walls
- 2026-10-25 00:02 built: 0.5 m walls; three wall-mounted items nudged to fit; first-person walker keeps its gap from the wall
