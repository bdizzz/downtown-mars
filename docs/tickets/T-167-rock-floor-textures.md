---
id: T-167
title: A richer bare-rock floor, and smoothed rock as nearly plain rock rather than tiles
status: done
size: M
area: render3d, godot
touches: [src/render3d/surfaces.ts, godot/shaders/surfaces.gdshader]
blocked_by: []
notes: [N-0091]
created: 2026-10-13 20:43
---
## Problem
"Improve the floor texture for 'bare rock' to be less lo-fi. Additionally, the smoothed rock shouldn't show in square tiles; instead it should be a nearly textureless version of bare rock."

## Context
The surfaces are procedural shaders: `src/render3d/surfaces.ts` (web) and `godot/shaders/surfaces.gdshader`, from F-003 (T-034, T-035). Smoothed rock is bare rock's "fine" finish (PLAN-M15.md).

## Approach
Bare rock floor: more detail at a couple of scales (grain, chisel marks, a few cracks and pebbles), in the cozy palette. Smoothed rock: the same base colour and large-scale variation, the fine detail almost gone, no tile seams. Same in Godot. Done: side-by-side shots of both, before and after, in the PR.

## History
- 2026-10-13 20:43 opened from N-0091
- 2026-10-13 20:49 building on t-167-rock-floor-textures (with T-165)
- 2026-10-13 20:55 built: richer bare-rock floor (web and Godot), smoothed rock without tiles (web; Godot has no fine finishes until T-035)
