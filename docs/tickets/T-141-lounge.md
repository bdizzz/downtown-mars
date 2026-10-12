---
id: T-141
title: A 1×1 lounge with couches, a TV and games tables, lifting comfort nearby
status: done
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
Add `lounge` to `data/rooms.json` (S, no staff, power 0.5, comfort +1 radius 2, a small build cost, unlocked from the start), a games table model, a layout template; ROOMS.md row; rerun `node scripts/room-status.mjs`. Done: build a lounge next to dorms and see their comfort rise.

## Docs to update
ROOMS.md (the lounge row; "Bar and lounge" renamed "Bar"), DECISIONS.md (the bar's name), ROOM-STATUS.md (regenerated), GUIDE.md: rooms.

## Open questions
- [x] Staffed or not, and does it use anything (power)? (Claude's default: no staff, power 0.5.) → No staff, power 0.5. (Bryon, Oct 11)
- [x] Comfort strength and reach? (Default: +1, radius 1.) → +1 comfort, radius 2. (Bryon, Oct 11)
- [x] Unlocked from the start, or at a population? (Default: from the start.) → Unlocked from the start. (Bryon, Oct 11)
- [x] Does the later "Bar and lounge" become just "Bar", now that the lounge is its own room? (DECISIONS reverted "Bar" once.) → Yes: the catalog's "Bar and lounge" becomes just "Bar" (update DECISIONS.md, which reverted that rename once). (Bryon, Oct 11)

## History
- 2026-10-11 15:52 opened from N-0073
- 2026-10-11 16:08 questions answered
- 2026-10-12 01:07 building on t-132-grade-a-rooms
- 2026-10-12 01:17 built
