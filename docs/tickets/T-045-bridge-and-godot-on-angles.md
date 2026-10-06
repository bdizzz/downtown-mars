---
id: T-045
title: The bridge and Godot on angles
status: open
size: M
area: godot, bridge
touches: [src/bridge/, godot/src/PlanView.cs, godot/src/Live.cs, godot/src/BuildMode.cs]
blocked_by: [T-043, T-044]
feature: F-004
notes: [N-0008]
created: 2026-10-06 00:32
---
## Problem
The bridge's snapshot and Godot's plan view, live view and build mode read slots. They read the new location.

## Context
Read F-004 (`docs/tickets/F-004-rooms-by-area.md`) and its plan, `docs/PLAN-M17.md`, first; this is step 7 of its Steps. Built on F-004's own branch: the PR goes into `feature/f-004-rooms-by-area`, not main.

## Approach
Snapshot and scene carry spans; `PlanView.cs`, `Live.cs` and `BuildMode.cs` read them (placement still on slots until T-046). Done: `npx tsc --noEmit -p tsconfig.node.json`, `dotnet build`, and a Godot test run as in PLAN-GODOT.md "Testing the viewer".

## Docs to update
PLAN-M17.md Notes as built; PLAN-GODOT.md.

## History
- 2026-10-06 00:32 opened from F-004 (agreed)
