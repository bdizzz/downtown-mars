---
id: T-180
title: Rooms lit in two modes, daylight and night, with overhead lights in rooms and corridors
status: open
size: L
area: godot, render3d
touches: [godot/src/Live.cs, godot/src/HoleScene.cs, godot/src/Lighting.cs, godot/src/Furniture.cs, src/bridge/, src/view/furnish.ts, data/furniture.json]
blocked_by: ["#94"]
notes: []
created: 2026-10-25 00:30
---
## Problem
A follow-up to T-101 (Bryon, in chat): "since we reduced the amount of ambient outside light available to rooms outside of ring 1, rooms should have two 'modes' of lighting":
- **Daylight:** "lamps shine brighter, more lights in each room. hallways have overhead lighting. we can add overhead lights to rooms and corridors that are not seen in most 3d views (but still give off light) and visible in first person view. the overall amount of light should not be too far off from when there was ambient atmosphere lighting in every room"
- **Nighttime:** "many overhead lights are off or dimmed, some lamps are dimmed as well."

## Context
T-101 (PR #94) lights a floor in view as underground in Godot: the sun reaches only the land (`SurfaceLayer`), rooms take night's ambient and dust glow (`_roomLight` = 0 in `Live.Daylight`), and a warm omni light in the shaft (`ShaftDaylight`) washes ring 1. So by day, with a floor in view, rooms past ring 1 now look as they do at night. The day/night switch already exists: `_light` (the hour's daylight, 0..1) and `_hole.SetNight` (lamp glass glow, `Furniture.SetNight`).

Lamps today: the bridge sends each floor's lamps (from the web's furnishing), and `HoleScene` makes an `OmniLight3D` per lamp on the floor in view, one floor above and two below; the 8 nearest within 40 m cast shadows (`ShadowLamps`). Each light costs every pixel it reaches (PLAN-GODOT, step 1 notes: 955 lamps on the showcase), so more lights per room need watching: an overhead light per room and per corridor run, no shadows, short range, may be cheaper than many lamps.

Before/after screenshots of T-101 are in PR #94's session.

## Approach
1. **Overhead lights:** one (or a few, by area) per room and per corridor run, on the ceiling, from the bridge alongside the lamps (or worked out in Godot from the scene's rooms and corridor strips). Ceiling fixtures drawn only in first person (a layer the overhead cameras leave out, as `CameraRig.LabelLayer` does for labels); their light shows in every view.
2. **Two modes by the hour**, from `_light`, underground only (a floor in view, or first person below ground): by day lamps brighter and overheads on, aiming for about the brightness rooms had with the old daytime ambient (compare against main's daytime screenshots from before T-101); by night overheads mostly off or dimmed, some lamps dimmed (picked by a stable hash of the lamp's position, so the same ones dim every night). Ease between them at dawn and dusk.
3. Numbers (energies, ranges, how many dim) in data or one constants block, not scattered.
4. Check frame rate on the showcase (`--bench`), as in PLAN-GODOT, before and after.

Done: by day, a floor in view looks about as bright as before T-101 but lit from inside (no sun shadows); by night it's dimmer and cosier; ceiling fixtures show only in first person; the frame rate holds.

## Docs to update
PLAN-GODOT.md: notes as built. GUIDE.md if the web gets it too.

## Open questions
- [ ] Godot only (like T-101), or the web's 3D view too?

## History
- 2026-10-25 00:30 opened from Bryon's follow-up to T-101 (in chat)
