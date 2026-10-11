---
id: T-155
title: A batch of new events and office visits, many of them wagers, balanced to pay off
status: open
size: L
area: events, balance
feature: F-016
touches: [data/events.json, src/sim/events.ts, docs/EVENTS.md, tests/bot.ts]
blocked_by: [T-154]
notes: [N-0072]
created: 2026-10-11 16:09
---
## Problem
"Let's plan out some more of those." More events and office visits, mixing wagers, instant events and plain visits, balanced so that higher cost and higher risk pay more, and an incentive to keep spare capacity.

## Context
Read F-016 (`docs/tickets/F-016-event-wagers.md`) first. Events with choices are M14: `docs/PLAN-M14.md`, `src/sim/events.ts`, `data/events.json`. `docs/EVENTS.md` lists the unbuilt events.

## Approach
Propose 8–10 from EVENTS.md's unbuilt list (Bryon agreed the plan proposes them) in the PR description first, then build them; bots that accept and refuse in the playthroughs; tune so wagers pay on average. Done: a long playthrough sees a good spread of them.

## Docs to update
EVENTS.md (marked built), GUIDE.md: Events.

## History
- 2026-10-11 16:09 opened from F-016 (agreed)
