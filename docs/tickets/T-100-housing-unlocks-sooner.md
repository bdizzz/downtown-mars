---
id: T-100
title: Standard homes unlock at 100 people and luxury at 200
status: done
size: S
area: balance
touches: [data/config.json, docs/ROOMS.md, docs/GUIDE.md]
blocked_by: []
notes: [N-0055]
created: 2026-10-09 01:58
---
## Problem
"Lessen the population requirements for unlocking more housing rooms. Use 100 instead of 200 and use 200 instead of 1000."

## Context
`data/config.json` → `unlocks.homes`: `{ basic: 50, standard: 200, luxury: 1000 }`. ROOMS.md (luxury "Pop 1,000") and GUIDE.md's unlock table (1,000: suites and residences) quote these. Tutorial steps or scripted playthroughs in `tests/` may assume the old thresholds.

## Approach
Change `standard` to 100 and `luxury` to 200; update the docs that quote them; run `npm test` and fix any bot that relied on the old numbers. Check whether the GUIDE's 1,000 row covers anything besides homes before moving it.

## Docs to update
ROOMS.md: luxury apartment unlock; GUIDE.md: unlocks table.

## History
- 2026-10-09 01:58 opened from N-0055
- 2026-10-09 19:19 building on t-100-housing-unlocks-sooner
- 2026-10-09 19:28 built
