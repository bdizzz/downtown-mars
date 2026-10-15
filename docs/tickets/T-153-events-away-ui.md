---
id: T-153
title: The top bar shows workers away and injured; event cards show the stake and the trip
status: open
size: M
area: ui, godot
feature: F-016
touches: [src/view/hudItems.ts, src/ui/ResourceBar.tsx, src/ui/EventCards.tsx, src/ui/Office.tsx, src/bridge/, godot/src/]
blocked_by: [T-151, T-152]
notes: [N-0076]
created: 2026-10-11 16:09
---
## Problem
"We'll need a way to show visually in the resource UI at the top of the screen that some number of workers are on a mission like this and not working a normal job", with the tooltip giving details; injured and healing workers as a separate indicator, perhaps only in the tooltip.

## Context
Read F-016 (`docs/tickets/F-016-event-wagers.md`) first. Events with choices are M14: `docs/PLAN-M14.md`, `src/sim/events.ts`, `data/events.json`. The worker item is `res:employed` in `src/view/hudItems.ts`, shared with Godot through the bridge.

## Approach
A small "away" mark on the worker count; the tooltip lists who's away, on what, back when, and how many are healing. The event card shows what you're putting up and for how long (no odds). Godot through the shared view code. Done: during the meteorite run, the top bar shows 10 away and the tooltip says when they're back.

## History
- 2026-10-11 16:09 opened from F-016 (agreed)
- 2026-10-14 21:21 T-151: snapshot workforce has away and injured; the card's stake label now shows only the crew (4 colonists), not the machinery going with it
