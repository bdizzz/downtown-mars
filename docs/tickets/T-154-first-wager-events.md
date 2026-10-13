---
id: T-154
title: The first wager events: the meteorite run and the jammed drill
status: open
size: M
area: events, data
feature: F-016
touches: [data/events.json, src/sim/events.ts, docs/EVENTS.md]
blocked_by: [T-153]
notes: [N-0076]
created: 2026-10-11 16:09
---
## Problem
Bryon's two examples as real events: a meteorite-collecting trip (10 machinery and some colonists for a day; all, 8 or none of the machinery back; 25 metal ore or nothing; injuries possible), and an instant one, "the drill is jammed and we need someone to get underneath it".

## Context
Read F-016 (`docs/tickets/F-016-event-wagers.md`) first. Events with choices are M14: `docs/PLAN-M14.md`, `src/sim/events.ts`, `data/events.json`. This is the first content on T-150–T-153's machinery.

## Approach
Both events in `events.json` with triggers in `events.ts` (the meteorite run once there's machinery to spare; the jam while drilling), outcomes and odds as Bryon described, a partial-commit option and a deny. Done: both turn up in a playthrough and resolve each way across seeds.

## Docs to update
EVENTS.md: both events, marked built.

## History
- 2026-10-11 16:09 opened from F-016 (agreed)
- 2026-10-13 00:58 T-150 added meteorite_run to events.json (machinery stake, console only, no trigger): T-154 adds its trigger, crew and injuries, and the GUIDE entry once wagers turn up in play
