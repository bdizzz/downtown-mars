---
id: T-160
title: Upgrades for every other kind of room, in batches by family
status: open
size: L
area: rooms, balance
feature: F-017
touches: [data/upgrades.json, data/furniture.json, docs/ROOMS.md, tests/bot.ts]
blocked_by: [T-159]
notes: [N-0075]
created: 2026-10-11 16:09
---
## Problem
Several upgrades for each room type, tailored to it, some unlocked from the start, balanced so they offer a path toward small comfy holes or fast growth.

## Context
Read F-017 (`docs/tickets/F-017-room-upgrades.md`) first; it builds on F-003's Upgrade action (T-033). Room families as in ROOMS.md (homes, food, water, air, power, industry, services…).

## Approach
Propose the list per family in the PR first; may split into one PR per family. Bots install upgrades in the playthroughs. Done: every built room type has at least one upgrade.

## Docs to update
ROOMS.md, GUIDE.md.

## History
- 2026-10-11 16:09 opened from F-017 (agreed)
