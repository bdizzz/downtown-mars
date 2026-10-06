---
id: T-068
title: Rooms you can hear in the 3D view, fading with distance and floor
status: open
size: M
area: audio, render3d
touches: [src/audio/, src/render3d/, data/sounds.json]
blocked_by: [T-066]
feature: F-006
notes: [N-0032]
created: 2026-10-06 02:20
---
## Problem
F-006's positional ambience: busy rooms hum, whir or chatter near the camera.

## Context
See F-006's Design. The 3D view knows the camera and the floor in view; rooms and whether they're running are in the snapshot. Keep it cheap: a few loops shared per room category, not a voice per room.

## Approach
Per category a soft loop (farm fans, workshop clatter, canteen chatter) on the ambience bus, its level from the nearest running rooms of that kind on the floor in view, by distance; Web Audio panners optional. Done: moving the camera around a floor changes what you hear, gently; it's quiet over rock.

## History
- 2026-10-06 02:20 opened from F-006's breakdown
