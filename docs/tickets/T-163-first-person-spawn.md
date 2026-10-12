---
id: T-163
title: First person never starts stuck in the shaft on floors without a gallery tube
status: open
size: S
area: render3d, godot
touches: [src/render3d/stage3d.ts, godot/src/]
blocked_by: []
notes: [N-0087]
created: 2026-10-12 19:55
---
## Problem
"When entering first person mode, if the floor doesn't have an inner glass walkway, then find an appropriate corridor to place the camera. Right now the camera gets stuck in the shaft and unable to move."

## Context
`src/render3d/stage3d.ts`: placing the walker on entering (around line 1245) and `moveWalkerTo` (around line 1257) fall back to a spot halfway into the open shaft when nothing walkable is within `WALK.searchReach` (40 m). Floor 1 always has a full gallery tube; deeper floors only what the player builds (M11). `walkClear` decides what's walkable.

## Approach
Search the floor's walkable places (corridors, tubes, walk-through rooms, then any room) for the one nearest the camera's view, with no distance limit; if the floor has none, go to the nearest floor that does. Never put the walker in the open shaft. Same in Godot's first person. Done: enter first person on a deep floor with only a radial corridor and you can walk.

## History
- 2026-10-12 19:55 opened from N-0087
