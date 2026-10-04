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
Replace the planks floor with something Mars-plausible in both renderers and point homes/admin at it. Done: no wood-grain floors in web or Godot.

## Docs to update
- ART.md: floor materials.

## Open questions
- [ ] What replaces the planks? Proposed: warm **fibre-composite floor panels** (hemp fibre is in the crop catalog): long panels in the same warm tone, with a fine woven texture instead of grain.
- [ ] Furniture too? About 36 parts are drawn as wood. Proposed: yes, the same composite look, so nothing reads as wood.

## History
- 2026-10-04 18:03 opened from N-0007
