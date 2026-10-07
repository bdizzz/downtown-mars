---
id: T-073
title: Soil at a hole site matches the map's colour there; no sites on ice caps or glaciers
status: open
size: M
area: render3d, ui
touches: [src/render3d/stage3d.ts, src/render3d/terrain3d.ts, src/ui/MapScreen.tsx, src/ui/Globe.tsx, src/sim/founding.ts, data/mars-relief.jpg, data/mars-elevation.json, scripts/build-elevation.mjs, src/bridge/terrain.ts, godot/src/Terrain.cs]
blocked_by: []
notes: [N-0036]
created: 2026-10-06 09:45
---
## Problem
"We should color the soil at a hole site to match the Mars planet map where the particular hole is located. We should prevent players from placing hole sites on ice caps or glaciers."

## Context
- The map (web `Globe.tsx`/`MapScreen.tsx` and Godot's globe) draws `data/mars-relief.jpg`, built by `scripts/build-relief.mjs` from MOLA heights: coloured **by height**, lit from the north-west, with the **polar caps whitened**. The game's own lookups (deposits, site reports) use the 1° grid in `data/mars-elevation.json`.
- The 3D ground is one colour today (`C.ground` with a regolith shader in `src/render3d/stage3d.ts`); the horizon and near terrain come from `terrain3d.ts`, sent to Godot through `src/bridge/terrain.ts`.
- Founding a new hole picks a map location (`src/sim/founding.ts`, the map screen).

## Approach
Answered (Bryon, Oct 7): match the map as drawn; only the polar caps count as ice for now.

Add a colour per 1° cell to the elevation grid (sampled from the relief map's palette before shading, so it's the map's colour without its lighting), and an `ice` flag for the polar caps (and any glacier regions we mark). The site's ground, near terrain and horizon tint toward that colour, softened so it still reads as Mars dust under the game's lighting. The map refuses ice cells: the cursor shows "Ice cap: can't dig here" and founding is blocked there (checked in the sim command too). Done: sites in dark lowlands and bright highlands look different and match the map; clicking a cap won't place a hole; Godot matches.

## Docs to update
GUIDE.md: The map. DECISIONS.md: where holes can't go.

## Open questions
- [x] The map's colours are height tints, not Mars's real colours. Match the map as drawn (proposed: it's what the player sees), or use real colour imagery for both the map and the soil?
- [x] Which ice counts: the polar caps only (proposed, clear on the map), or also the mid-latitude buried glaciers (invisible on the map, so they'd need marking)?

## History
- 2026-10-06 09:45 opened from N-0036
- 2026-10-07 18:43 questions answered
