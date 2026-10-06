---
id: T-035
title: Material and finish looks in Godot, and the Upgrade control there
status: open
size: M
area: godot, bridge
touches: [godot/shaders/surfaces.gdshader, godot/src/Looks.cs, src/bridge/]
blocked_by: [T-033, T-034]
feature: F-003
notes: [N-0006, N-0007]
created: 2026-10-06 00:10
---
## Problem
The Godot viewer shows the same linings and floors, and its room panel's Upgrade control works.

## Context
Read F-003 (`docs/tickets/F-003-room-materials.md`) and its plan, `docs/PLAN-M15.md`, first; this is step 4 of its Steps. All numbers come from the plan's Defaults, in `data/materials.json`.

## Approach
The six wall surfaces and their floors in `surfaces.gdshader` and `Looks.cs`, the room's material passed through the bridge, refit stripes, and the Upgrade control working in the viewer. Done: the same rooms look the same in the viewer as on the web (`cd godot && dotnet build`, a test run per PLAN-GODOT.md).

## Docs to update
PLAN-GODOT.md (Status and next, notes as built), PLAN-M15.md Notes as built.

## History
- 2026-10-06 00:10 opened from F-003 (agreed)
