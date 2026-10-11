---
id: T-141
title: A 1×1 lounge with couches, a TV and games tables, lifting comfort nearby
status: open
size: M
area: rooms, data
feature: F-015
touches: [data/rooms.json, data/furniture.json, data/layouts.json, docs/ROOMS.md]
blocked_by: []
notes: [N-0073]
created: 2026-10-11 15:52
---
## Problem
"Before jumping into the rest of the room catalog we have planned out, we should add a 1x1 'lounge' room with furniture like couches, tvs, games tables, etc. this should add a comfort bonus to nearby rooms."

## Context
ROOMS.md has a "Bar and lounge" (S, beer and cooked food, entertainment +2 r2) waiting on entertainment as a system (F-015, grade C); DECISIONS keeps the name "Bar and lounge". This lounge is a different, simpler room: no inputs beyond maybe power, a comfort neighbour effect only, which exists already (neighbour effects in `data/rooms.json`). Homes already have `sofa`, `tv_unit`, `coffee_table` in `furniture.json`; a games table is new.

## Approach
Add `lounge` to `data/rooms.json` (S, 0 staff, comfort +1 r1 or so, a small build cost), a games table model, a layout template; ROOMS.md row; rerun `node scripts/room-status.mjs`. Done: build a lounge next to dorms and see their comfort rise.

## Docs to update
ROOMS.md (the lounge row, and how it differs from the bar and lounge), ROOM-STATUS.md (regenerated), GUIDE.md: rooms.

## Open questions
- [ ] Staffed or not, and does it use anything (power)? (Claude's default: no staff, power 0.5.)
- [ ] Comfort strength and reach? (Default: +1, radius 1.)
- [ ] Unlocked from the start, or at a population? (Default: from the start.)
- [ ] Does the later "Bar and lounge" become just "Bar", now that the lounge is its own room? (DECISIONS reverted "Bar" once.)

## History
- 2026-10-11 15:52 opened from N-0073
