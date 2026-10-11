---
id: T-151
title: Workers away on an event and injured workers healing, both out of the workforce
status: open
size: L
area: sim, events
feature: F-016
touches: [src/sim/events.ts, src/sim/people.ts, src/sim/economy.ts, src/sim/save.ts, tests/]
blocked_by: [T-150]
notes: [N-0076]
created: 2026-10-11 16:09
---
## Problem
Colonists committed to an event leave the worker pool for its duration; an outcome can injure some, who stay out while they heal. Nobody dies, and everyone heals fully (Bryon).

## Context
Read F-016 (`docs/tickets/F-016-event-wagers.md`) first. Events with choices are M14: `docs/PLAN-M14.md`, `src/sim/events.ts`, `data/events.json`. Workers are assigned to rooms from the people in `src/sim/people.ts` and the economy; find where the workforce count comes from and subtract these pools there.

## Approach
Two pools in the sim state: away (per event, until it resolves) and healing (per person or group, days left). Healing is faster with a clinic nearby their home (Bryon; a multiplier in data). Both in the snapshot and the save (version bump). Done: commit 5 workers, see 5 fewer employed until they return; injured ones come back after their days.

## Docs to update
DECISIONS.md: nobody dies on events; GUIDE.md: Events; README if save format notes live there.

## History
- 2026-10-11 16:09 opened from F-016 (agreed)
