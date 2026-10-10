---
id: T-120
title: "The bridge and Godot at any shaft radius"
status: open
size: M
area: godot, bridge
touches: [src/bridge/, godot/src/]
blocked_by: [T-119]
feature: F-013
notes: [N-0065]
created: 2026-10-10 00:40
---
## Problem
The Godot viewer draws holes of every size.

## Context
Read F-013 first: its Design holds the decisions this task builds on.

## Approach
Carry the radius through the bridge and fix Godot's own geometry (rock wall, cutaway, scenery, camera) at each size.

## History
- 2026-10-10 00:40 opened from F-013 (agreed)
