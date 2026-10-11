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
Corridor linings in `materials.json`, priced per corridor segment the way rooms are per cell; an upgrade job for a corridor through the construction queue; a corridor panel Upgrade control; the room surfaces on corridor walls and floors, web and Godot. Done: refit a corridor in brick and it looks like a brick room.

## Docs to update
PLAN-M15.md (corridors), GUIDE.md: Building.

## Open questions
- [ ] What does a lined corridor do besides look nice: nothing, or less airlock dust and smell along it, or comfort for the rooms it serves? (Claude's default: looks and wear only.)
- [ ] Do the existing corridor finishes (marscrete…) fold into the new materials, or stay a separate choice?

## History
- 2026-10-11 15:52 opened from N-0074
