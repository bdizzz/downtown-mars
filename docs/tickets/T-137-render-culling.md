---
id: T-137
title: Skip drawing rooms and furniture the 3D camera can't see
status: open
size: L
area: render3d
touches: [src/render3d/rooms3d.ts, src/render3d/furniture3d.ts, src/render3d/stage3d.ts, src/render3d/people3d.ts]
blocked_by: []
notes: [N-0069]
created: 2026-10-11 15:52
---
## Problem
"If you are in free view and looking at floor 2, i'm not sure if ALL of the rooms and furniture way down on floor 7 are being drawn in full." Find out what the 3D view draws that the camera can't see, and stop drawing it. Furniture is likely the biggest saving. Complications Bryon named: windows let you see through any number of rooms, and the shaft shows rooms on many floors.

## Context
Three.js does frustum culling per object, but only if objects are split up finely and their bounds are right; merged or instanced meshes covering a whole floor or hole defeat it. Look at how `rooms3d.ts` and `furniture3d.ts` batch geometry first. Walls down (DECISIONS: 3D view) already reasons about what hides what, in the shader.

## Approach
Measure first: draw calls, triangles and frame time on a big save (`renderer.info`), in Free view, Cutaway and first person. Then the cheap wins: per-floor (or per-room) groups so frustum culling works, and furniture and people skipped on floors well outside the view. Only if that isn't enough, a conservative visibility test: a room is visible if it's in the frustum and either faces the shaft, or connects to a visible room through a window, door or corridor (a portal walk). Never cull something that should show; a missing room is worse than a slow frame. Done: before and after numbers in the PR, nothing visibly missing in any camera.

## Open questions
- [x] Godot too, or the web only for now? (Its renderer culls differently; Claude's default: web first, Godot a follow-up if the numbers show it's needed.) → Yes, web first; Godot a follow-up if the numbers show it's needed, logged in PLAN-GODOT.md's Status and next. (Bryon, Oct 11)

## History
- 2026-10-11 15:52 opened from N-0069
- 2026-10-11 16:08 questions answered
