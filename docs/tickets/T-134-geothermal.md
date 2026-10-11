---
id: T-134
title: "The geothermal plant, unlocked at 15 floors deep"
status: open
size: M
area: rooms, sim
touches: [data/rooms.json, data/config.json, src/sim/costs.ts]
blocked_by: []
feature: F-015
notes: [N-0068]
created: 2026-10-11 15:50
---
## Problem
Add the geothermal plant (ROOMS.md: L, water 2 → power 25, noise and heat, unlocks at a depth of 15 floors).

## Context
Read F-015 first. Each room's catalog row is in `docs/ROOMS.md`; `docs/ROOM-STATUS.md` shows what's built.

## Approach
Add a depth unlock (rooms unlocked by floors dug, next to the population unlocks in `unlocks`), the room itself, and a hint for when it unlocks. Check heat as an effect exists or map it to comfort.

## Docs to update
ROOMS.md and ROOM-STATUS.md (rerun `node scripts/room-status.mjs`); GUIDE.md for new rooms or resources.

## History
- 2026-10-11 15:50 opened from F-015 (agreed)
