---
id: T-002
title: Walls down (Iso) only lowers walls that hide another room
status: done
size: M
area: render3d, godot
touches: [src/render3d/rooms3d.ts, src/render3d/stage3d.ts, godot/src/ViewSettings.cs, godot/src/Live.cs]
blocked_by: []
notes: [N-0002]
created: 2026-10-04 16:12
---
## Problem
In Iso with "walls down" on, walls that only hide a corridor are lowered too. Bryon wants a wall lowered only when it hides **another room**: walls that only cover a corridor, or rock, keep standing. Which walls those are depends on the camera's angle, so it's re-evaluated as the camera moves.

## Context
- Walls down is a vertex-shader trick in `src/render3d/rooms3d.ts` (`WALLS_GLSL`, `inTheWay`, `loweredAt`). Each wall is tagged with its outward normal; a **longer normal** marks "something to see across it", which lowers it from either side. Today that tag likely counts a corridor as something to see; the fix may be as small as not tagging room–corridor edges (and gallery-tube edges), leaving the "seen from behind" rule for the room's own walls.
- But "hides another room" really depends on angle: a wall facing a corridor can still hide the room *beyond* the corridor from a steep or low camera. A true answer means a per-wall test of what's behind it from the camera (CPU, re-run when the camera moves; cheap enough at one floor in Iso).
- Hangings follow their wall (`HANG_GLSL`); outlines use `aWall2`.
- Godot has its own walls-down setting (`godot/src/ViewSettings.cs`, `Live.cs`); check whether it uses the same tags from the bridge.

- As built: the wall tag's length is now 1 (nothing across), or 2 + the distance to the room across (`roomBeyond` walks out from the wall through corridors and hairlines, up to 4 m; shaft, tubes and rock give none). Each wall face is judged whole (review: Bryon): a `Face` gathers its pieces as they're drawn (a curved wall across all the room's cells, keyed by floor, radius and side), and `aFace` says where it stands: a flat face's plane, or a curved face's radius and angles. One averaged plane isn't enough for a curved face: a ring-2 room on a 9-slot ring spans 160°, and the camera can be behind its near end while in front of the plane. So `inFront` gives the camera's least and most distance in front of the arc, and a face drops if any of it would. The shader test (`inTheWay` / `IN_THE_WAY_GLSL`, Godot `wall_in_the_way`) lowers a face from its own side when the line over its top is still above stub height where the room across starts (review: the stubs hide the floor below that line anyway).

## Approach
Start with the tag change (corridor- and rock-facing walls are never "see-across"), then add an angle check: lower a wall only if a ray from the camera through it reaches a room cell within a few metres beyond it. Done: in Iso with walls down, walls in front of corridors/rock stay up, walls in front of rooms drop, and it updates as you orbit. Same in Godot.

## Docs to update
- GUIDE.md: walls down.
- DECISIONS.md (3D view): walls down lowers only walls that hide a room.

## Open questions
- [x] Walk-through rooms and plazas count as rooms (lowered); gallery tubes count as corridors (kept) (Bryon, Oct 4).
- [x] Every view that has walls down, not just Iso (Bryon, Oct 4).

## History
- 2026-10-04 16:12 opened from N-0002
- 2026-10-04 16:14 questions answered
- 2026-10-06 09:48 building on t-002-walls-down-ignore-corridors
- 2026-10-06 09:58 built
