---
id: F-013
title: "Holes of different diameters (S to XL), set by the size of the lift"
status: draft
plan:
notes: [N-0065]
created: 2026-10-10 00:18
---
## Goal
"Consider the size of the lift to create holes of different diameters." Today's hole diameter is the smallest; work out M, L and XL diameters.

## Design
- The shaft radius R sets slots per ring: `slots(n) = round(2π · (R + (n − 0.5) · d) / w)`. The starter is R = 10 m (rings 1–3: 9, 16, 22 slots). Bigger R means more slots per ring, a wider shaft open to Mars, more gallery tube to build, and more light down the shaft.
- "The size of the lift": presumably the drill or lift that bores the shaft (`src/render3d/drillRig.ts` draws the shaft-boring machine). A bigger rig digs a wider hole, costs more and perhaps digs slower.
- Where the choice is made: when founding a hole (the first, or later ones from the network map), which ties in with F-011's base camp.
- A first guess to react to: S = 10 m (today), M = 15 m, L = 20 m, XL = 30 m radius. Ring 1 would then have about 9, 13, 16 and 22 slots.
- Rendering and the views assume today's R in places; the sim already takes `hole.shaftRadiusM`.

## Breakdown
Proposed; becomes tickets once this feature is agreed.
- Sizes in data (radius, cost, dig speed, what the lift needs), and the sim honouring any radius (slot counts, adjacency, galleries, light).
- Choosing the size when founding a hole (web), with its trade-offs shown.
- Views at any radius: 3D, plan, unrolled, cutaway, camera limits (T-051 capped zoom at six rings' width).
- The bridge and Godot at any radius.
- Balance: what makes a bigger hole worth it, and what it costs.

## Open questions
- [ ] Are the four sizes radii (10/15/20/30 m) or something else? Any feel for how much bigger XL should be?
- [ ] Is the size picked once at founding, or can a hole be widened later with a bigger lift?
- [ ] What's the trade-off for going bigger: cost up front, slower digging, more gallery to build and seal, more dust and cold through the wider shaft?
- [ ] Can the first hole be any size, or does it start small and bigger lifts unlock later?

## History
- 2026-10-10 00:18 opened from N-0065
