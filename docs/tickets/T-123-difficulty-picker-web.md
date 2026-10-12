---
id: T-123
title: "The difficulty picker on the web's new-game screen"
status: open
size: M
area: ui
feature: F-014
touches: [src/ui/]
blocked_by: [T-122, T-083]
notes: [N-0066]
created: 2026-10-10 00:40
---
## Problem
Pick easy, normal or hard when starting a new game, with a line on what each means.

## Context
Read F-014 first: its Design holds the decisions this task builds on.

Starter kits (T-164, Bryon Oct 12): hard starts with the bare kit (battery and the surface); normal offers it too as a "veteran" option; easy and normal default to the full kit.

## Approach
Add the picker to the new-game/welcome card (next to F-007's guided-tutorial choice); easy turns the guided tutorial on by default (still switchable). The level is shown somewhere in game (pause menu or settings) but can't be changed.

## History
- 2026-10-10 00:40 opened from F-014 (agreed)
- 2026-10-12 19:59 added the starter-kit choice from T-164
