---
id: T-009
title: No wooden-looking floors (there's no wood on Mars)
status: open
size: S
area: render3d, godot
touches: [src/render3d/rooms3d.ts, src/render3d/surfaces.ts, godot/src/Looks.cs, godot/shaders/surfaces.gdshader]
blocked_by: []
notes: [N-0007]
created: 2026-10-04 18:03
---
## Problem
In Godot (and maybe the web) some floors look like wood. There's no wood resource in the game, so no floor should look wooden.

## Context
- The web gives homes and admin rooms a `planks` floor (`src/render3d/rooms3d.ts` around line 1070; the planks pattern is in `surfaces.ts`, colour 0x9a6a44, "varnished planks"). Godot mirrors it: `godot/src/Looks.cs` (`["planks"]`) and `godot/shaders/surfaces.gdshader` (floor look 0 = planks).
- Furniture also has a `wood` part material (`PART_MAT.wood`, about 36 `"wood"` parts in `data/furniture.json`, plus "composite" drawn as wood).

## Approach
**Floors match the room's building material** (Bryon, Oct 4), including its finish. Rooms have no material yet (that's T-008), and today they're all dug from rock, so homes and admin get a rock floor (a smoothed stone, warmer than the industrial ones) instead of planks; once T-008 lands, floors follow each room's material and finish. Furniture's wood parts get a fibre-composite look. Fibre-composite **floor panels** as a comfort upgrade belong to T-008. Done: no wood grain anywhere, in web or Godot.

## Docs to update
- ART.md: floor materials.

## Open questions
- [x] Floors match the room's building material and finish, not a fixed floor per room type. Fibre-composite panels become a separate floor upgrade with a comfort boost (in T-008). (Bryon, Oct 4)
- [x] Furniture's wood parts get a fibre-composite look too. (Bryon, Oct 4)

## History
- 2026-10-04 18:03 opened from N-0007
- 2026-10-04 19:05 questions answered
