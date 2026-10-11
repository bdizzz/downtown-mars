---
id: T-143
title: Set the cutaway's slice angle, from a flat cut down to a quarter wedge
status: open
size: M
area: render3d, godot
touches: [src/render3d/rooms3d.ts, src/render3d/stage3d.ts, src/render3d/cylinder.ts, src/ui/, godot/src/CameraRig.cs]
blocked_by: []
notes: [N-0077]
created: 2026-10-11 15:52
---
## Problem
"We should add the ability to adjust the 'slice angle' of cutaway view. The current behavior would be considered 180 degrees, resulting in a flat line across the entire colony. This would be the maximum angle, and for example 90 degrees would show only the front-most quarter of the hole removed."

## Context
The cut is a half-line from the axis at an angle (`rooms3d.ts` around line 1186, "Where the cutaway's cut … runs through solid rock"); a flat cut is two such half-lines 180° apart. A wedge means two cut faces meeting at the axis, with the rock face drawn on both. T-130 (zoom in Cutaway) touches the same camera controls.

## Approach
Make the cut a wedge with a width from 90° to 180°, centred on the camera's facing; draw the cut rock face on both sides. A control for it: a small slider in Cutaway (web), mirrored in Godot. Done: drag it to 90° and only the front quarter of the hole is removed.

## Open questions
- [ ] The control: a slider in the view, keys (like [ and ]), or both? Is the angle saved in settings?
- [ ] Should anything below 90° be allowed?

## History
- 2026-10-11 15:52 opened from N-0077
