---
id: T-026
title: Living volume and the O2/CO2 mix
status: open
size: L
area: sim, ui
feature: F-002
touches: [src/sim/air.ts, src/sim/economy.ts, data/config.json, src/sim/save.ts, src/view/hudItems.ts, src/ui/TrendsPanel.tsx, tests/]
blocked_by: []
notes: [N-0005]
created: 2026-10-06 00:08
---
## Problem
The hole's air becomes a mix over its living volume: O2 and CO2 as % of what the dug space holds, with health bands, instead of plain stockpiles.

## Context
Read F-002 (`docs/tickets/F-002-air-mix.md`) and its plan, `docs/PLAN-M16.md`, first; this is step 1 of its Steps.

## Approach
`sim/air.ts`: living volume (dug cells, corridors and tubes), O2 and CO2 % over it, the bands and their health effects, breathing 1:1, the `air` config block. Life support (unchanged for now) and farms/parks feed the air, with life support's O2 stopping at the target. HUD "Air 21% O2", charts, a save migration, new games starting at target. Done: digging dilutes the air, and health follows the bands; `npm test` passes.

## Docs to update
PLAN-M16.md Notes as built; DECISIONS.md (air as a mix); GUIDE.md: Air.

## History
- 2026-10-06 00:08 opened from F-002 (agreed)
- 2026-10-06 09:47 building on t-026-air-volume-and-mix
