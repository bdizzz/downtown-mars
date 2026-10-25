---
id: T-149
title: A floor directory: every floor and its rooms, click one to open it
status: open
size: M
area: ui
touches: [src/ui/TrendsPanel.tsx, src/ui/Dock.tsx, src/ui/, src/view/]
blocked_by: []
notes: [N-0084]
created: 2026-10-11 15:52
---
## Problem
"A 'floor directory' panel (accessible from the charts area) that lists all the floors and all the rooms on each floor. Clicking on a room will show the detail panel for that room."

## Context
The Charts area: `src/ui/TrendsPanel.tsx` (with Maintenance and others as tabs or siblings, see `Dock.tsx`). Room details: the Inspector, through `src/view/roomPanel.ts` (shared with Godot). Room names: `RoomName.tsx`.

## Approach
A Directory tab in the Charts area: floors top to bottom, each listing its rooms (name, size, a status dot for stalled, worn or under construction). Clicking a room selects it, opens its panel and moves the camera to its floor. Filters: by kind of room, and only rooms with problems. Building the list in `src/view/` lets Godot reuse it later; add the directory to PLAN-GODOT.md's Status and next. Done: find a room by name on floor 6 and jump to it.

## Docs to update
PLAN-GODOT.md: Status and next (the directory, for a follow-up), GUIDE.md.

## Open questions
- [x] Godot too, now or later? (Default: later.) → Later; add it to PLAN-GODOT.md's Status and next so it gets a follow-up ticket. (Bryon, Oct 11)
- [x] Any grouping or filter (by kind of room, only rooms with problems), or a plain list first? → With filters: by kind of room, and only rooms with problems. (Bryon, Oct 11)

## History
- 2026-10-11 15:52 opened from N-0084
- 2026-10-11 16:08 questions answered
- 2026-10-24 23:53 building on t-149-floor-directory
