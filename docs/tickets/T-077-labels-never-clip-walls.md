---
id: T-077
title: Room labels centred on the room and never clipping a wall
status: open
size: M
area: render3d, godot
touches: [src/render3d/rooms3d.ts, src/view/font.ts, src/bridge/, godot/src/HoleScene.cs]
blocked_by: []
notes: [N-0041]
created: 2026-10-06 19:31
---
## Problem
"Sometimes the room labels clip through the walls of the room (or a neighboring room). Perhaps they should be centered on the room. But we should still make sure they never clip a wall."

## Context
Labels are sprites at a fixed size (`LABEL = { px: 40, heightM: 1.1 }` in `src/render3d/rooms3d.ts`, materials cached by text). A long name on a narrow (S, one-slot) room, or a label placed off-centre, pokes into or through walls. Godot draws labels too (`_hole.ShowLabels`).

## Approach
Anchor each label at the centre of the room's floor area (its angular middle, mid-depth), and fit it: shrink (down to a minimum), wrap to two lines, or abbreviate so its width stays inside the room's inner width with a margin; keep it below the wall tops. If it still can't fit, show it only on hover. Done: no label crosses a wall at any zoom or angle in a hole with S rooms on all rings, in web and Godot.

## History
- 2026-10-06 19:31 opened from N-0041
