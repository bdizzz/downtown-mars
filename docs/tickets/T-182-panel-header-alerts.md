---
id: T-182
title: The room panel's header and alerts: a status pill, headline chips, warnings raised to the top
status: open
size: M
area: ui, godot
feature: F-019
touches: [src/ui/Inspector.tsx, src/ui/styles.css, godot/src/Inspector.cs]
blocked_by: [T-181]
notes: [N-0097]
created: 2026-10-25 10:58
---
## Problem
The panel opens with what matters: a colored status, the headline numbers, and every warning in one place.

## Context
Read F-019 (`docs/tickets/F-019-room-panel-hierarchy.md`) and its plan, `docs/PLAN-M18.md`, first; this is step 2 of its Steps. Web and Godot change together in this PR.

## Approach
Status pill (tone color, the `roomState` sentence as its tooltip) and headline chips (staff and main output; a home's residents and happiness; a store's fill), then the alerts band, with Connect moved into it. The old state line goes; condition moves to the glance band. Web and Godot. Done: the change looks the same in the web game and the Godot viewer.

## Docs to update
GUIDE.md: the room panel. PLAN-M18.md Notes as built.

## History
- 2026-10-25 10:58 opened from F-019 (agreed)
