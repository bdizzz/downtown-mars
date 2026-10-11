---
id: T-150
title: Events with rolled outcomes: weighted results per choice, odds shifting with the stake
status: open
size: M
area: sim, events
feature: F-016
touches: [src/sim/events.ts, data/events.json, tests/]
blocked_by: []
notes: [N-0072, N-0076]
created: 2026-10-11 16:09
---
## Problem
A choice can lead to one of several outcomes, rolled when it resolves (at once, or when a duration ends), with the odds depending on how much was committed. Bryon's example: the meteorite run returns all, some or none of its machinery, and ore or nothing.

## Context
Read F-016 (`docs/tickets/F-016-event-wagers.md`) first. Events with choices are M14: `docs/PLAN-M14.md`, `src/sim/events.ts`, `data/events.json`. Effects already include `followUp` (an effect some days later); the RNG is seeded, so rolls stay deterministic.

## Approach
Outcome tables in `events.json`: per choice, several weighted results, each a list of existing effects, with independent rolls allowed (machinery back, and separately ore found, with exclusions like no ore after a catastrophe). Resources committed are held for the duration and returned per the outcome. Odds are hidden from the player (Bryon). Tests with fixed seeds for each branch. Done: a test event resolves into each outcome across seeds.

## Docs to update
PLAN-M14.md or a new section in EVENTS.md: how outcomes work; the `_note` in events.json.

## History
- 2026-10-11 16:09 opened from F-016 (agreed)
