---
id: T-156
title: Room upgrades in the sim: several per room type, cost, monthly upkeep, effects
status: open
size: L
area: sim, data
feature: F-017
touches: [data/upgrades.json, src/sim/construction.ts, src/sim/economy.ts, src/sim/save.ts, tests/]
blocked_by: [T-033]
notes: [N-0075]
created: 2026-10-11 16:09
---
## Problem
Each room type has several upgrades to pick from, each with an up-front cost and/or a monthly upkeep, changing the room's effects. Some are unlocked from the start whether or not you can afford them (a path toward small, comfy holes or fast growth).

## Context
Read F-017 (`docs/tickets/F-017-room-upgrades.md`) first; it builds on F-003's Upgrade action (T-033). Room effects and inputs are in `data/rooms.json`; a game day is a month (T-021), so upkeep is an input per day.

## Approach
`data/upgrades.json` (per room type: id, name, cost, upkeep, effect changes, furniture swaps, unlock); `room.upgrades` in the sim and save (version bump); installing goes through T-033's upgrade job (construction queue, half output while it runs); upkeep is drawn like any input, and when it can't be paid the upgrade idles (its effects off) rather than stalling the room. Two test upgrades in data. Done: install one in a test, see its effect and its upkeep, starve the upkeep and see it idle.

## Docs to update
DESIGN.md or a new PLAN section: room upgrades; DECISIONS.md: upkeep idles the upgrade.

## History
- 2026-10-11 16:09 opened from F-017 (agreed)
