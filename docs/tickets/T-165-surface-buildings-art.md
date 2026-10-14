---
id: T-165
title: Every surface building gets the collar and entry's new look
status: open
size: L
area: render3d, godot
touches: [src/render3d/scenery3d.ts, src/render3d/rooms3d.ts, data/furniture.json, godot/src/Scenery.cs]
blocked_by: []
notes: [N-0089]
created: 2026-10-13 20:43
---
## Problem
"I like the new art direction for the collar and surface-level entry room. Let's apply a similar aesthetic to all of the other buildings on the surface."

## Context
The look came in PR #67 (T-144, T-107): the concrete collar round the shaft and the surface entry. Surface buildings today: the landing pod, landing pad and solar array (`landingKit` in `data/config.json`), plus whatever else has `kind: surface` placement (check `data/rooms.json`). Drawn in `src/render3d/scenery3d.ts` / `rooms3d.ts`, Godot in `godot/src/Scenery.cs`. ART.md holds the art direction.

## Approach
Read PR #67's materials and shapes, write down the look in ART.md (concrete plinths, the palette, trim, lights), then rework each surface building to match, one at a time. Godot after Bryon has checked the web (as with T-144). Done: the surface reads as one set of buildings.

## Docs to update
ART.md: the surface look.

## History
- 2026-10-13 20:43 opened from N-0089
