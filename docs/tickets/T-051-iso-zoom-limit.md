---
id: T-051
title: Cap Iso's zoom-out at six rings' width plus a little padding
status: done
size: S
area: render3d, godot
touches: [src/render3d/stage3d.ts, src/render3d/cylinder.ts, godot/src/CameraRig.cs]
blocked_by: []
notes: [N-0022]
created: 2026-10-06 00:48
---
## Problem
"Limit the amount you can zoom out in iso mode": far enough to see the full width of **6 rings** plus a small amount of padding, no further.

## Context
- Web: `ISO = { start: 1.6, min: 12, max: 400, … }` in `src/render3d/stage3d.ts` (line ~80), clamped at line ~492 (`cam.iso` is the distance to the floor's centre). 400 m is far more than a starter hole needs.
- Ring radii: `ringRadii` in `src/render3d/cylinder.ts`. Only rings 1–3 are open today; Bryon's limit is the width of ring 6 regardless, so the cap doesn't move when rings open later.
- Godot's Iso camera: `godot/src/CameraRig.cs` (`_dist`); it should get the same cap.
- T-052 renames Iso to "Free view"; same camera.

## Approach
Work out the distance at which ring 6's outer diameter, plus about 10% padding, just fits the view (from the camera's field of view, the window's aspect and Iso's elevation), and use that as the max instead of 400 (recomputed on resize, and from the hole's shaft radius). Same in Godot. Done: scrolling out in Iso stops with all six rings' footprint just inside the screen, on a wide and a narrow window.

## History
- 2026-10-06 00:48 opened from N-0022
- 2026-10-06 02:19 building on t-051-iso-zoom-limit
- 2026-10-06 02:23 built
