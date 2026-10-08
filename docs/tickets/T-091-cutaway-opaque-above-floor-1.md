---
id: T-091
title: In the cutaway view, the ground between the surface and floor 1 is opaque
status: open
size: S
area: render3d, godot
touches: [src/render3d/stage3d.ts, src/render3d/terrain3d.ts, godot/src/]
blocked_by: []
notes: [N-0052]
created: 2026-10-08 02:06
---
## Problem
"In cutaway view, the space between the surface and the first floor should be opaque."

## Context
The Cutaway camera slices the hole along a plane through the shaft's axis (`src/render3d/stage3d.ts`: `CUTAWAY`, the cut face of the ground drawn as rock from the surface's profile down, "the cutaway's face is dark"). The band of ground above floor 1 apparently isn't filled (you see through it, or into the surface layer). T-052 removes the Shaft and Top cameras but keeps Cutaway. T-004 added the rock cylinder round the rings underground.

## Approach
Make the cut face solid from the surface down to the top of floor 1 (and between floors where there's rock), matching the rest of the cut face, including under the entrance and the shaft's rim. Check Godot's cutaway too. Done: in Cutaway at any angle, nothing shows through the ground above floor 1.

## History
- 2026-10-08 02:06 opened from N-0052
- 2026-10-08 02:10 building on t-091-cutaway-opaque-above-floor-1
