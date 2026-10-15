---
id: T-169
title: Corridors drawn over unexcavated rock show on the rock's top, not its floor
status: open
size: S
area: render3d
touches: [src/render3d/stage3d.ts, src/render3d/rooms3d.ts, src/view/corridorPlan.ts]
blocked_by: []
notes: [N-0093]
created: 2026-10-13 20:43
---
## Problem
"When drawing a corridor over unexcavated rock, paint the corridor over the top 'ceiling' of the rock instead of at the 'bottom' of that segment." Both the hover for a single corridor and dragging (snaking) a chain.

## Context
The corridor preview is drawn in the 3D build mode (`src/render3d/stage3d.ts`), planned by `src/view/corridorPlan.ts`; along rock it's at floor height, so the rock block hides it. T-104 (snake rules) touches the same planning.

## Approach
Where a previewed segment runs beside or through uncut rock, lift its preview to the top of the rock; at floor height where it's open. Check Godot's build preview too. Done: snaking a corridor across rock shows the whole path.

## History
- 2026-10-13 20:43 opened from N-0093
- 2026-10-15 11:22 building on t-163-first-person-spawn
