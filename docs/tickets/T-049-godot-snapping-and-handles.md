---
id: T-049
title: Snapping, handles and fill in Godot's build mode
status: open
size: M
area: godot
touches: [godot/src/BuildMode.cs, src/bridge/build.ts]
blocked_by: [T-048]
feature: F-004
notes: [N-0008]
created: 2026-10-06 00:32
---
## Problem
Godot's build mode catches up with the web: snapping and its toggle, drag handles, fill rooms and double-click to fill.

## Context
Read F-004 (`docs/tickets/F-004-rooms-by-area.md`) and its plan, `docs/PLAN-M17.md`, first; this is step 11 of its Steps. Built on F-004's own branch: the PR goes into `feature/f-004-rooms-by-area`, not main.

## Approach
Reuse the sim's snap finder and fill rules through the bridge; draw ticks and handles in `BuildMode.cs`. Done: `dotnet build` and a Godot test run placing, snapping, dragging and filling.

## Docs to update
PLAN-M17.md Notes as built; PLAN-GODOT.md.

## History
- 2026-10-06 00:32 opened from F-004 (agreed)
