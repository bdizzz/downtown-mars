---
id: T-101
title: "Godot: floors stay lit as underground in daytime, daylight only through the shaft"
status: open
size: M
area: godot, render3d
touches: [godot/src/Lighting.cs, godot/src/HoleScene.cs, godot/src/Cutaway.cs]
blocked_by: []
notes: [N-0056]
created: 2026-10-09 01:58
---
## Problem
In Godot, looking at a floor in free view during the day, "the engine is making complex shadows." Floors should be lit "as if those floors are still underground; only bright daylight comes through the shaft and bleeds into the hole from there."

## Context
Viewing a floor cuts away the rock above it, so the sun's directional light falls straight onto rooms and casts shadows from walls and furniture. `godot/src/Lighting.cs` holds the sun and shadows. The web 3D view may handle this differently; check `src/render3d/` for how it lights a floor in view and match it.

## Approach
When a floor is in view, keep the sun off the room interiors (light layers / cull mask, or no sun shadows below ground), light rooms by their own lamps and ambient, and let daylight enter only via the shaft: e.g. a light or bright fill at the shaft that spills into ring-1 rooms through gallery glass and open walls. Done: daytime floor view looks like night's lamp-lit rooms plus a warm wash from the shaft, no long sun shadows across rooms.

## Open questions
- [x] Should the web 3D view get the same treatment, or is this Godot-only? Godot only for now.

## Docs to update
PLAN-GODOT.md: notes as built.

## History
- 2026-10-09 01:58 opened from N-0056
- 2026-10-09 questions answered: Godot only for now
- 2026-10-09 13:02 questions answered
