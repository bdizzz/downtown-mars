---
id: T-183
title: The room panel's sections fold open and closed, with the controls moved into them
status: open
size: M
area: ui, godot
feature: F-019
touches: [src/ui/Inspector.tsx, src/ui/styles.css, src/ui/settings.ts, godot/src/Inspector.cs]
blocked_by: [T-182]
notes: [N-0097]
created: 2026-10-25 10:58
---
## Problem
Everything below the header folds into sections (Work, Home, Serves, Surroundings, Building, Seed kit, Storage), most of them closed.

## Context
Read F-019 (`docs/tickets/F-019-room-panel-hierarchy.md`) and its plan, `docs/PLAN-M18.md`, first; this is step 3 of its Steps. Web and Godot change together in this PR.

## Approach
Sections with the open rule in PLAN-M18 §5 and the open state remembered per section across rooms (local storage on the web, wrapped in try/catch; the viewer's settings in Godot). Rows gain icons and tones. Crop, holds, tank fill, priority, running and stop at go into Work; refit and demolish (at the bottom) into Building. Web and Godot. Done: the change looks the same in the web game and the Godot viewer.

## Docs to update
GUIDE.md: the room panel. PLAN-M18.md Notes as built.

## History
- 2026-10-25 10:58 opened from F-019 (agreed)
