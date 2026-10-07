---
id: T-016
title: Believable mesas and mountains on the horizon, more 3D, more of them, and big craters
status: open
size: L
area: render3d, godot
feature: F-008
touches: [src/render3d/terrain3d.ts, src/bridge/terrain.ts, godot/src/Terrain.cs]
blocked_by: [T-073]
notes: [N-0011, N-0035]
created: 2026-10-05 00:52
---
## Problem
On sites with the "mesa" horizon, "the mesa doesn't look believable and there's only one of them." Bryon suggests adding some large craters to the horizon too.

N-0035 widens it to every horizon style: "a more refined pass at the distant geologic features on the horizon (mountains and plateaus). Can we make them a little more 3D?"

## Context
- `src/render3d/terrain3d.ts`: `horizonStyle` picks mountains, mesas or hills per site; `skyline()` gives the mesa style **1–3 mesas** (`1 + floor(rand × 2.4)`, so often just one), each a flat-topped bump of 60–120 m with steep sides on a single ring 1,500 m out; `horizon()` builds the ring as a faceted ridge (mesas get a shallower front: `h × 0.35`).
- Being one silhouette line, a mesa reads as a flat-topped bump: no layered strata, no talus slopes, no depth (everything sits at the same distance).
- The bridge sends the horizon to Godot (`src/bridge/terrain.ts`) and `godot/src/Terrain.cs` builds it "faceted as the web's", so changes should flow through, but check.
- Local craters already exist in the near ground (`LAND.craters`); these would be far, large ones on the skyline.

## Approach
**More 3D (N-0035):** today each horizon is one faceted ridge on a ring, so it reads as a cut-out. Give mountains and plateaus real depth: separate landforms with their own footprint (a cone or massif, a plateau block), placed at a few distances so nearer ones overlap farther ones, lit by the sun so their sides shade differently through the day, with aerial perspective (farther = paler, dustier). Keep them low-poly and faceted to match the art style and stay cheap.

More mesas (say 3–6, of different widths and heights, some buttes), at a few distances rather than one ring, with stepped strata ledges, a talus slope at the foot and a slightly eroded top edge; and a few large craters as low, wide raised rims on the skyline (a rim with a dip behind it). Done: a mesa site looks like a believable mesa landscape from the rim, and mountains and plateaus on every site have visible depth and shading as the camera orbits, in web and Godot.

## Docs to update
- ART.md: the horizon.

## Open questions
- [x] Every site gets one or two large horizon craters, with more on mesa and hills sites (flatter land shows them best). (Bryon, Oct 5)

## History
- 2026-10-05 00:52 opened from N-0011
- 2026-10-05 00:53 questions answered
- 2026-10-06 09:46 added N-0035: mountains and plateaus too, more 3D; size M → L
- 2026-10-07 18:58 moved into F-008; waits on T-073
