---
id: T-079
title: The entry room's walls show through other rooms' walls at some angles
status: open
size: M
area: render3d
touches: [src/render3d/rooms3d.ts, src/render3d/stage3d.ts, godot/src/]
blocked_by: []
notes: [N-0043]
created: 2026-10-06 19:31
---
## Problem
"Sometimes the walls of the entry room fight for visibility through other rooms' walls, and you can see portions of the entry room wall from within another room at certain angles."

## Context
Sounds like z-fighting or a draw-order issue: the entrance (M9) is built differently from ordinary rooms (`src/render3d/rooms3d.ts`), so its walls may sit on the same plane as a neighbour's (coplanar faces flicker), be drawn without depth writes, or be transparent and sorted wrong. T-001 (real wall thickness, shared walls single) touches the same code and may fix or change this; T-019 adds ceiling seams.

## Approach
Reproduce next to the entrance at a few angles, find whether it's coplanar walls, render order or a material flag, and fix at the cause (share the wall as other rooms do, or offset it, or fix depth settings). Check Godot for the same. Done: no entrance wall shows through or flickers from inside a neighbouring room at any angle.

## History
- 2026-10-06 19:31 opened from N-0043
