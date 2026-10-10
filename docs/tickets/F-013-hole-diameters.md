---
id: F-013
title: "Holes of different diameters (S to XL), set by the size of the lift"
status: agreed
plan:
branch: feature/f-013-hole-diameters
notes: [N-0065]
created: 2026-10-10 00:18
---
## Goal
"Consider the size of the lift to create holes of different diameters." Today's hole diameter is the smallest; work out M, L and XL diameters.

## Design
- The shaft radius R sets slots per ring: `slots(n) = round(2π · (R + (n − 0.5) · d) / w)`. The starter is R = 10 m (rings 1–3: 9, 16, 22 slots). Bigger R means more slots per ring, a wider shaft open to Mars, more gallery tube to build, and more light down the shaft.
- **Sizes (shaft radius):** S 10 m (today), M 15 m, L 25 m, XL 40 m. Ring 1 then has about 9, 13, 19 and 28 slots.
- **Where it's chosen:** once, when building the seed kit at an existing hole to found another (`src/sim/founding.ts`, `network.seedKit` in data; rooms with `stagesSeedKit` stage it). A bigger hole needs a bigger drill sent with the kit, so more resources amassed and a larger drill built first. Size is fixed after founding.
- **The first hole is always S.**
- **Costs of going bigger: all of them:** more up front (the drill and kit), slower digging, more gallery tube to build and seal, and more dust and cold down the wider shaft. Ties in with F-011's base camp, which new holes start with.
- Rendering and the views assume today's R in places; the sim already takes `hole.shaftRadiusM`.

## Breakdown
Agreed; each line names its ticket.
- Sizes in data (radius, cost, dig speed, what the lift needs), and the sim honouring any radius (slot counts, adjacency, galleries, light). → T-117
- Choosing the size when assembling the seed kit (web): the larger drill to build and the extra resources, with the trade-offs shown. → T-118
- Views at any radius: 3D, plan, unrolled, cutaway, camera limits (T-051 capped zoom at six rings' width). → T-119
- The bridge and Godot at any radius. → T-120
- Balance: what makes a bigger hole worth it, and what it costs. → T-121

## Open questions
- [x] Sizes? Radii S 10, M 15, L 25, XL 40 m.
- [x] Picked once? Yes, when building the seed kit; bigger needs more resources and a larger drill.
- [x] Trade-offs? All of them.
- [x] First hole? Always small.

## History
- 2026-10-10 00:18 opened from N-0065
- 2026-10-10 questions answered: sizes, chosen with the seed kit, all trade-offs, first hole small
- 2026-10-10 00:35 questions answered
- 2026-10-10 00:40 agreed
- 2026-10-10 00:46 built on feature/f-013-hole-diameters
