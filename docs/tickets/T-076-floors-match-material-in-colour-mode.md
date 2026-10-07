---
id: T-076
title: Floors keep the building material's texture in room-colour mode
status: open
size: S
area: render3d, godot
feature: F-003
touches: [src/render3d/rooms3d.ts, src/bridge/, godot/src/]
blocked_by: []
notes: [N-0040]
created: 2026-10-06 19:31
---
## Problem
"When in colored room mode, we currently show a variety of different floor textures. Floor textures should match the building material always, regardless of room coloring mode or not."

## Context
The 3D view's room-colour mode (`roomColors` in `src/render3d/rooms3d.ts`, setting in `src/ui/settings.ts`) tints rooms by kind, and the floors vary with it. Rooms have no building material yet: F-003 adds material and flooring (T-032 in the sim, T-034 the web looks, T-037 floor upgrades), defaulting to bare rock. Until then "the building material" is the default floor everyone gets outside colour mode.

## Approach
Colour mode keeps tinting **both walls and floors** by room kind (Bryon, Oct 7), but the floor's **texture** stays the same as without colour mode: the room's material and flooring (today the default), only tinted. No per-kind floor patterns. Make sure T-034 builds on this rather than reintroducing per-kind floors. Godot the same. Done: toggling colour mode changes floor tint but never a floor's texture.

## Docs to update
ART.md: room-colour mode.

## History
- 2026-10-06 19:31 opened from N-0040
- 2026-10-07 18:43 questions answered
- 2026-10-07 18:58 moved into F-003
