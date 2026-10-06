---
id: T-046
title: Placing by area: rooms at any angle with their target area
status: open
size: L
area: sim, ui
touches: [src/sim/placement.ts, src/sim/geometry.ts, src/sim/commands.ts, src/worker/, src/ui/BuildPalette.tsx, src/view/buildCatalog.ts, data/config.json, data/rooms.json, src/sim/state.ts, tests/]
blocked_by: [T-045]
feature: F-004
notes: [N-0008]
created: 2026-10-06 00:32
---
## Problem
The switch: rooms go at any angle, sized by their target area (S/M/L/H = 100/200/400/800 m²), and slots are retired.

## Context
Read F-004 (`docs/tickets/F-004-rooms-by-area.md`) and its plan, `docs/PLAN-M17.md`, first; this is step 8 of its Steps. Built on F-004's own branch: the PR goes into `feature/f-004-rooms-by-area`, not main.

## Approach
Placement by (floor, ring, depth, start, span); the `build` command carries the angle (breaking: `feat(sim)!`); `ringSlots`, `pairedRings`, `nestedPairs` and `room.cells` removed; dig yields per 100 m²; the landing kit, bots and tests placed by angle. If F-003 has landed, its per-cell upgrade costs become per 100 m². Done: a new game plays through with rooms the same size on every ring; old saves load unchanged; `npm test` passes; browser check.

## Docs to update
PLAN-M17.md Notes as built; CLAUDE.md (Core spatial model); DECISIONS.md; DESIGN.md (space); ROOMS.md (sizes as areas); GUIDE.md: Building.

## History
- 2026-10-06 00:32 opened from F-004 (agreed)
