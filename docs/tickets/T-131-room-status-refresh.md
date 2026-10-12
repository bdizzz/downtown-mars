---
id: T-131
title: "Refresh ROOM-STATUS's grades, add a parked status, and propose rooms to park"
status: done
size: S
area: docs
feature: F-015
touches: [scripts/room-status.mjs, docs/ROOM-STATUS.md, docs/ROOMS.md]
blocked_by: []
notes: [N-0068]
created: 2026-10-11 15:50
---
## Problem
The room readiness grades are out of date (fiber, glass and materials now exist), and the catalog needs a way to park rooms that don't earn their place.

## Context
Read F-015 first. Each room's catalog row is in `docs/ROOMS.md`; `docs/ROOM-STATUS.md` shows what's built.

## Approach
Update the hand-kept "needs first" notes in `scripts/room-status.mjs` against what's built now, add a **parked** status (shown with its reason in ROOM-STATUS.md and marked in ROOMS.md), and propose which rooms to park, starting with the escalator. Bryon confirms the list in the PR.

## Docs to update
ROOMS.md and ROOM-STATUS.md (rerun `node scripts/room-status.mjs`); GUIDE.md for new rooms or resources.

## History
- 2026-10-11 15:50 opened from F-015 (agreed)
- 2026-10-12 01:35 building on t-131-room-status-refresh
- 2026-10-12 01:41 built; parked list for Bryon to confirm in the PR
