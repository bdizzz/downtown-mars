---
id: T-142
title: Corridors upgrade their materials like rooms, with the same looks and costs
status: open
size: L
area: sim, render3d
feature: F-003
touches: [src/sim/construction.ts, src/sim/commands.ts, data/materials.json, data/corridors.json, src/render3d/surfaces.ts, src/view/, godot/src/Looks.cs]
blocked_by: [T-033, T-034]
notes: [N-0074]
created: 2026-10-11 15:52
---
## Problem
"Corridors should be able to have their building materials upgraded, just like rooms with all the same visual changes and an analogous resource cost."

## Context
Read F-003 and `docs/PLAN-M15.md` first. Corridors already carry a finish (`layout.corridors[id]`, `data/corridors.json`), purely a look; the plan says they "keep their own finishes but share the new surface looks". This ticket makes them real upgrades through the same Upgrade action (T-033) and looks (T-034).

## Approach
One list of linings for rooms and corridors, with **marscrete** added between bare rock and brick (so rooms get it too, with its own look); existing corridor finishes map onto it. Corridor linings in `materials.json`, priced per corridor segment the way rooms are per cell; an upgrade job for a corridor through the construction queue. **Upgrading is drawing over it** (Bryon, Oct 13): the corridor tool in another finish, dragged over existing corridor, refits those segments in that finish instead of skipping them (priced and salvaged like a room's refit, `refitPlan` in `materials.ts`; the same finish over itself does nothing; new segments in the same drag are still carved). The hover proposal shows the refit's cost. A corridor panel Upgrade control as well, if there's a corridor panel; the room surfaces on corridor walls and floors, web and Godot. Looks and wear only for now. Done: refit a corridor in brick and it looks like a brick room; line a room in marscrete.

## Docs to update
PLAN-M15.md (corridors, marscrete in the ladder), DECISIONS.md (marscrete as a lining), GUIDE.md: Building. Idea for later: a hole-wide bonus by the share of corridors upgraded to a given level.

## Open questions
- [x] What does a lined corridor do besides look nice: nothing, or less airlock dust and smell along it, or comfort for the rooms it serves? (Claude's default: looks and wear only.) → Looks and wear only for now. Later, maybe a hole-wide bonus by what share of corridors is upgraded to a given level. (Bryon, Oct 11)
- [x] Do the existing corridor finishes (marscrete…) fold into the new materials, or stay a separate choice? → Yes: one list of materials for rooms and corridors. Marscrete joins it, between bare rock and brick, so rooms get marscrete linings too. (Bryon, Oct 11)

## History
- 2026-10-11 15:52 opened from N-0074
- 2026-10-11 16:08 questions answered
- 2026-10-13 02:19 upgrade by drawing a corridor in another finish over an existing one (Bryon)
