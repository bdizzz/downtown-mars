---
id: T-148
title: Full gray-water tanks no longer stall rooms; the extra is lost
status: open
size: S
area: sim, balance
touches: [src/sim/economy.ts, src/sim/resources.ts, data/resources.json, tests/]
blocked_by: []
notes: [N-0083]
created: 2026-10-11 15:52
---
## Problem
"Rooms shouldn't stall if gray water tanks are full; in this case gray water should be lost permanently."

## Context
`src/sim/economy.ts` (around line 346): rooms that make a `backsUp` resource (only gray water, in `data/resources.json`) slow to what the tanks can take, with limit `drain:gray_water`. People already overflow instead of stalling.

## Approach
Drop the backs-up stall: make what fits, lose the rest (and count it, so the player can see water is being wasted: a warning or a news line). Probably remove `backsUp` altogether. Update the playthrough tests that expect stalls. Done: fill the gray tanks and the galley keeps cooking.

## Docs to update
DECISIONS.md (replace "Full gray tanks stall the rooms that use water"), GUIDE.md: Water, PATHWAYS.md: water.

## Open questions
- [ ] This reverses a decision in DECISIONS.md ("Full gray tanks stall the rooms that use water"). Confirm the reversal? Without the stall, nothing pushes the player to build a recycler except clean water running low; is a "gray water overflowing" warning enough?

## History
- 2026-10-11 15:52 opened from N-0083
