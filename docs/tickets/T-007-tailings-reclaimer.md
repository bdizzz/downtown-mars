---
id: T-007
title: Tailings reclaimer, a late room that turns tailings back into gray water
status: done
size: M
area: data, rooms
feature: F-001
touches: [data/rooms.json, data/config.json, data/furniture.json, data/layouts.json, src/sim/people.ts]
blocked_by: [T-005]
notes: [N-0005]
created: 2026-10-04 18:03
---
## Problem
Tailings (heavily contaminated industrial water, from T-005) can only be stored or lost early on. Bryon wants an unlockable room later in the game that converts tailings into gray water, with high resource use.

## Context
- Named "tailings reclaimer" in the approved proposal (N-0005).
- Unlocks live in `config.unlocks.rooms` and `UNLOCK_GATES` (`src/sim/people.ts`); the recycling center (100 colonists) and hospital (300) are the nearest examples.
- A new room needs furniture and a layout too (FURNITURE.md, the `?furnish` tool), and a line in ROOMS.md / ROOM-STATUS.md.

## Approach
Add the room to `data/rooms.json` (uses tailings plus lots of power and some machinery or electronics, makes gray water), an unlock gate, a layout, and an unlock message. Done: past the unlock, a hole can reclaim its tailings and the charts show it.

## Docs to update
- ROOMS.md, ROOM-STATUS.md (rerun `node scripts/room-status.mjs`), GUIDE.md: Water, DECISIONS.md.

## Open questions
- [x] Unlocks at 300 colonists, with the hospital. (Bryon, Oct 4)
- [x] 2×1 room, 3 staff, tailings 20 + power 8 + machinery 0.2 → gray 18 a day; noise like the recycler. (Bryon, Oct 4)

## History
- 2026-10-04 18:03 opened from N-0005
- 2026-10-04 19:05 questions answered
- 2026-10-04 19:13 part of F-001 (T-012)
- 2026-10-07 19:05 building on t-007-tailings-reclaimer
- 2026-10-07 19:08 built
