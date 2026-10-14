---
id: T-168
title: Windows between two rooms, showing through to the room next door
status: open
size: M
area: sim, render3d
touches: [src/sim/edges.ts, src/sim/happiness.ts, src/view/, src/render3d/rooms3d.ts, godot/src/]
blocked_by: []
notes: [N-0092]
created: 2026-10-13 20:43
---
## Problem
"When placing windows on a wall that has a room on the other side instead of a corridor, the window should show through to the other room. You pay resources the same as if placing the windows between a corridor and a room."

## Context
DECISIONS (M13): the corridor tool's Windows mode glazes a wall "only where the shaft, a corridor or a walk-through room is across it"; glass 2 per 10 m. Window comfort for homes: shaft 1.5, tube 1, plaza or stairs 0.75, corridor 0.25. This lifts the "only where" rule for room-to-room walls.

## Approach
Allow glazing a wall between two rooms, same cost; draw it as glass you can see through in 3D (web and Godot). Done: glaze the wall between a park and a home and see the park from inside.

## Docs to update
DECISIONS.md: windows between rooms; GUIDE.md: Windows.

## Open questions
- [ ] Does a window onto another room count for comfort, and how much? (Claude's default: by what's across it: a park or plaza 0.75, another room 0.25 like a corridor, and a noisy or smelly room nothing.)
- [ ] Does glass between rooms let noise or smell through more than a wall? (Default: no; same as a wall.)

## History
- 2026-10-13 20:43 opened from N-0092
