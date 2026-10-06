---
id: T-037
title: Floor upgrades, starting with fibre-composite panels
status: open
size: M
area: sim, render3d
touches: [data/materials.json, src/sim/commands.ts, src/view/roomPanel.ts, src/render3d/surfaces.ts, godot/shaders/surfaces.gdshader, godot/src/Looks.cs]
blocked_by: [T-033, T-034, T-035, T-036]
feature: F-003
notes: [N-0006, N-0007]
created: 2026-10-06 00:10
---
## Problem
A room's floor can be upgraded on its own, independent of its walls; the first flooring is fibre-composite panels (+0.25 comfort in homes).

## Context
Read F-003 (`docs/tickets/F-003-room-materials.md`) and its plan, `docs/PLAN-M15.md`, first; this is step 6 of its Steps. All numbers come from the plan's Defaults, in `data/materials.json`.

## Approach
`flooring` upgrades as `upgrade` jobs (fibre 3 and 1.5 h a cell), the room panel's Floor control, taking panels out free and instant, panels kept when the walls change; floor looks (warm woven-looking tiles) in web 3D and Godot. Done: panels go down in a home without touching its brick walls.

## Docs to update
GUIDE.md: Building, ART.md, PLAN-M15.md Notes as built (and close out the plan).

## History
- 2026-10-06 00:10 opened from F-003 (agreed)
