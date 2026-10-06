---
id: T-028
title: The electrolyzer and the CO2 scrubber replace life support
status: open
size: M
area: rooms, data
touches: [data/rooms.json, data/furniture.json, data/layouts.json, data/tutorial.json, data/config.json, src/sim/air.ts, src/render2d/, godot/src/]
blocked_by: [T-026, T-027]
feature: F-002
notes: [N-0005]
created: 2026-10-06 00:08
---
## Problem
Life support splits into two rooms: an electrolyzer that makes O2 from water (only to reach the target, water used up for good) and a CO2 scrubber (CO2 → O2 plus a little soil).

## Context
Read F-002 (`docs/tickets/F-002-air-mix.md`) and its plan, `docs/PLAN-M16.md`, first; this is step 3 of its Steps.

## Approach
Life support becomes the scrubber, keeping its id `life_support`, renamed and dry. The new electrolyzer (`runsWhile`, water 10 + power 6 → O2 40) with its two-step flows (new space, replacing breathed air). The domed shaft joins the volume, pressurized before it opens. Furniture, layout, 2D art, Godot model; parks take CO2; tutorial step and landing kit. Done: a steady colony's electrolyzer idles, digging makes it run.

## Docs to update
ROOMS.md (life support → CO2 scrubber, electrolyzer), ROOM-STATUS.md (rerun), PATHWAYS.md (Air), GUIDE.md, PLAN-M16.md Notes as built.

## History
- 2026-10-06 00:08 opened from F-002 (agreed)
