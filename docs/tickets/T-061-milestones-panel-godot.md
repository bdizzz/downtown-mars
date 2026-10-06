---
id: T-061
title: The milestones panel in Godot
status: open
size: M
area: godot, bridge
touches: [godot/, src/bridge/, src/view/]
blocked_by: [T-056]
feature: F-005
notes: [N-0025]
created: 2026-10-06 01:40
---
## Problem
F-005's panel in the Godot viewer.

## Context
See F-005's Design and `docs/PLAN-GODOT.md`. Reuse T-056's panel text from `src/view/` through the bridge rather than porting it.

## Approach
Bridge sends the panel's rows; Godot draws them with a button to open it. Done: same content as the web panel, checked with a test run.

## Docs to update
PLAN-GODOT.md: Status and next.

## History
- 2026-10-06 01:40 opened from F-005's breakdown
