---
id: T-135
title: "The chemical plant (plastics, methane) and the mycelium vat (mycelium composite)"
status: open
size: L
area: rooms, sim
touches: [data/rooms.json, src/sim/, data/]
blocked_by: []
feature: F-015
notes: [N-0068]
created: 2026-10-11 15:50
---
## Problem
Two new material chains: the chemical plant turns CO2 and water into plastics and methane; the mycelium vat grows mycelium composite, a wood substitute, from organic waste.

## Context
Read F-015 first. Each room's catalog row is in `docs/ROOMS.md`; `docs/ROOM-STATUS.md` shows what's built.

## Approach
Add plastics, methane and mycelium composite as resources, the two rooms from their ROOMS.md rows, and at least one use for each so they aren't dead ends (materials and finishes from F-003, build costs, or fuel). Ties into the air loop (CO2, F-002) and waste. Tests for both chains.

## Docs to update
ROOMS.md and ROOM-STATUS.md (rerun `node scripts/room-status.mjs`); GUIDE.md for new rooms or resources.

## History
- 2026-10-11 15:50 opened from F-015 (agreed)
