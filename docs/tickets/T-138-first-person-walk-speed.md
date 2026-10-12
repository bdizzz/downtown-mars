---
id: T-138
title: Walk faster in first person
status: done
size: S
area: render3d, godot
touches: [src/render3d/stage3d.ts, godot/src/CameraRig.cs]
blocked_by: []
notes: [N-0070]
created: 2026-10-11 15:52
---
## Problem
"When in first person view, you should walk a little more quickly than presently, since you might get bored walking a long distance."

## Context
`WALK` in `src/render3d/stage3d.ts` (around line 87): walk 3 m/s, run 9 m/s. Godot has its own first-person speeds (likely `godot/src/CameraRig.cs`). The touch joystick is analog up to running (DECISIONS: first person on touch).

## Approach
Raise the walk speed to about 4.5 m/s (a brisk walk; run stays 9, or goes to 10), same in Godot. Done: walking a ring of the starter hole takes noticeably less time.

## History
- 2026-10-11 15:52 opened from N-0070
- 2026-10-11 18:41 building on t-139-grab-a-drink
- 2026-10-11 18:53 built: walk 4.5 m/s, run 10 (web and Godot; Godot ran at 3 and 6)
