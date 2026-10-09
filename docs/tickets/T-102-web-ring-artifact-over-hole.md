---
id: T-102
title: "Web: a sun-dependent ring artifact hovers over the hole in surface view"
status: open
size: S
area: render3d
touches: [src/render3d/scenery3d.ts, src/render3d/stage3d.ts]
blocked_by: []
notes: [N-0057]
created: 2026-10-09 01:58
---
## Problem
"There is a weird graphical artifact hovering over the hole in surface mode during the daytime. It looks like it is dependent on the position of the sun but it shouldn't be visible in the form or shape that it currently is." If it's meant to be something, fix why it shows as a ring above the hole.

## Context
Candidates in `src/render3d/scenery3d.ts`: the shaft dome's foot ring (`makeDome`, only if a dome is built), the surface ring (`SURFACE_RING_M`), or a shadow/light-shaft effect. Sun-dependence hints at a shadow-casting mesh or a sun-lit transparent surface. Reproduce in surface mode at a few times of day, then find the mesh (toggle visibility in the console).

## Approach
Identify the mesh, decide what it's meant to be, and either fix its shape/placement or hide it when it shouldn't show. Done: no floating ring over the hole in daytime surface view.

## History
- 2026-10-09 01:58 opened from N-0057
- 2026-10-09 19:19 building on t-100-housing-unlocks-sooner
