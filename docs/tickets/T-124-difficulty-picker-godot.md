---
id: T-124
title: "The difficulty picker in Godot"
status: open
size: M
area: godot
touches: [godot/src/Welcome.cs, src/bridge/]
blocked_by: [T-123]
feature: F-014
notes: [N-0066]
created: 2026-10-10 00:40
---
## Problem
The same picker in the Godot viewer's new-game flow.

## Context
Read F-014 first: its Design holds the decisions this task builds on.

## Approach
Mirror the web picker in `godot/src/Welcome.cs`, passing the level through the bridge.

## History
- 2026-10-10 00:40 opened from F-014 (agreed)
