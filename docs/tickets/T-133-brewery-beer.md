---
id: T-133
title: "The brewery, and beer as a resource"
status: open
size: M
area: rooms, sim
touches: [data/rooms.json, data/crops.json, data/resources*, src/sim/]
blocked_by: []
feature: F-015
notes: [N-0068]
created: 2026-10-11 15:50
---
## Problem
Barley becomes beer: add beer as a resource and the brewery that makes it (ROOMS.md: M, barley 4 + water 4 + power 2 → beer 4, smell −1, pop 150).

## Context
Read F-015 first. Each room's catalog row is in `docs/ROOMS.md`; `docs/ROOM-STATUS.md` shows what's built.

## Approach
Add beer (stored, shown in the resource bar and flows), barley as a usable output of farms if it isn't yet, and the brewery room with its size ladder (microbrewery … brewing works) as ROOMS.md lists. Decide what beer is for until the bar arrives (a small happiness bump, or an export). Tests for the chain.

## Docs to update
ROOMS.md and ROOM-STATUS.md (rerun `node scripts/room-status.mjs`); GUIDE.md for new rooms or resources.

## History
- 2026-10-11 15:50 opened from F-015 (agreed)
