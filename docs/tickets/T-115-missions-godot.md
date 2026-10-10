---
id: T-115
title: "Missions in Godot"
status: open
size: M
area: godot, bridge
touches: [src/bridge/, godot/src/]
blocked_by: [T-112, T-061]
feature: F-011
notes: [N-0061]
created: 2026-10-10 00:40
---
## Problem
The missions section of the milestones panel, its notices and the deconstruct choice, in the Godot viewer.

## Context
Read F-011 first: its Design holds the decisions this task builds on.

## Approach
Reuse the web's panel text through the bridge (shared view code in `src/view/`) and add the section to T-061's Godot milestones panel.

## History
- 2026-10-10 00:40 opened from F-011 (agreed)
