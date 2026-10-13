---
id: T-152
title: Commit less than an event asks for, for a smaller stake and different odds
status: done
size: M
area: sim, ui
feature: F-016
touches: [src/sim/events.ts, data/events.json, src/ui/Office.tsx, src/ui/EventCards.tsx]
blocked_by: [T-150]
notes: [N-0076]
created: 2026-10-11 16:09
---
## Problem
Besides agree and deny, a choice can let you commit fewer colonists or resources than asked for: a smaller wager that can change the odds. Denying can come with a short dip in happiness.

## Context
Read F-016 (`docs/tickets/F-016-event-wagers.md`) first. Events with choices are M14: `docs/PLAN-M14.md`, `src/sim/events.ts`, `data/events.json`. Event cards: `src/ui/EventCards.tsx`, `src/ui/Office.tsx`. The odds stay hidden (Bryon).

## Approach
A choice can declare a range (min to asked) for colonists or a resource; the card shows a stepper; the command carries the amount; the outcome weights scale with the share committed (data). Deny's mood effect already exists. Done: commit half the machinery and the event rolls with the scaled weights.

## History
- 2026-10-11 16:09 opened from F-016 (agreed)
- 2026-10-13 00:46 building on t-150-rolled-outcomes (with T-150)
- 2026-10-13 00:58 built with T-150; the web and Godot cards have the stepper
