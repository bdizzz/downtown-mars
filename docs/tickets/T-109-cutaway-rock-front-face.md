---
id: T-109
title: Cutaway view is missing the rock's front face
status: open
size: S
area: render3d
touches: [src/render3d/stage3d.ts, src/render3d/cylinder.ts]
blocked_by: []
notes: [N-0063]
created: 2026-10-10 00:18
---
## Problem
"When in cutaway view, the 'front face' of rock seems to be missing. This is what obscures everything that isn't rooms and excavated space in the hole."

## Context
T-091 (done) filled the cut face through the crust above floor 1. The cut face below that, where the cutaway slices through unexcavated rock, seems not to be drawn, so you see into the rock. T-098 (open) changes the cutaway to always show every floor and the surface; the two touch the same code, so check for overlap with its PR before building. Godot has its own `godot/src/Cutaway.cs`; check whether it shows the same gap.

## Approach
Draw the cut plane's face across all solid rock, with holes only where rooms, corridors and the shaft are excavated. Done: in Cutaway, rock reads as a solid cross-section on every floor.

## History
- 2026-10-10 00:18 opened from N-0063
- 2026-10-10 01:11 building on t-109-cutaway-rock-front-face
