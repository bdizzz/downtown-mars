---
id: T-020
title: Sun and stars move across the sky by the site's latitude (equinox)
status: open
size: M
area: render3d, godot
touches: [src/render3d/stage3d.ts, src/render3d/sky3d.ts, src/render3d/lights3d.ts, godot/src/, godot/shaders/]
blocked_by: []
notes: [N-0015]
created: 2026-10-05 01:11
---
## Problem
Stars should move through the sky accurately, like the sun. Both should follow the site's **latitude**. No seasons: "pick an equinox position for all this to be built from."

## Context
- The sun: `sunDir.set(Math.cos(a), Math.sin(a), 0.3)` in `src/render3d/stage3d.ts` (around line 585): the same fixed arc everywhere. It also drives the shaft light and shadows.
- The stars: cells in the sky shader (`src/render3d/sky3d.ts`, `SKY.starsBy`), fixed to the sky dome as far as I can tell, so they don't turn.
- Sites have a place on the map (latitude/longitude; `sim/network.ts` has latitude bounds for the first site). A site without a place on the map (before one is chosen) needs a default.
- At the equinox the sun rises due east, sets due west, and peaks at altitude 90° − |latitude|, toward the equator. The stars turn once a sol around the celestial pole, which stands |latitude| above the north (or south) horizon. (Mars's north pole points near Deneb, about 25° tilt; that hardly matters for a procedural starfield.)
- Godot draws its own sky and sun; it needs the same.

## Approach
Give the scene a north (say −z), compute the sun's direction from the time of day and the site's latitude at the equinox, and rotate the star field about the celestial pole by the same hour angle (in the shader, turn the view direction before looking up the star cells). Done: at a site at 40°N the sun arcs low to the south and stars wheel round a point 40° up in the north; at the equator the sun passes overhead. Same in Godot.

## Docs to update
- ART.md (sky), DECISIONS.md (sky by latitude, at the equinox).

## Open questions
- [x] Procedural stars that turn correctly, or a real star map (recognisable constellations, as seen from Mars)? Proposed: keep the procedural field for now. (Bryon, Oct 5: agreed)
- [x] Which way is north on a site? Proposed: fixed in scene terms (−z), shown as a small compass mark on the map/Top view later if wanted. (Bryon, Oct 5: agreed)

## History
- 2026-10-05 01:11 opened from N-0015
- 2026-10-05 01:17 questions answered
