---
id: T-105
title: Dismiss a notification with an × button
status: open
size: S
area: ui, godot
touches: [src/ui/Messages.tsx, src/ui/styles.css, godot/src/Live.cs]
blocked_by: []
notes: [N-0059]
created: 2026-10-09 13:03
---
## Problem
"You should be able to dismiss a notification manually by clicking an x button in the notification."

## Context
Web notifications are `src/ui/Messages.tsx`, in a `.messages` stack that has `pointer-events: none` (`styles.css`), so each message needs `pointer-events: auto` for its button. Godot shows the same messages somewhere around `godot/src/Live.cs`; keep the two in step.

## Approach
Add a small × to each message (big enough to tap on mobile) that removes it at once; the rest of the stack closes up. Messages still time out as now. Done on web and Godot.

## Docs to update
GUIDE.md: a line where notifications are described, if anywhere.

## History
- 2026-10-09 13:03 opened from N-0059
- 2026-10-09 19:19 building on t-100-housing-unlocks-sooner
