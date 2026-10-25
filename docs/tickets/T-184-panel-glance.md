---
id: T-184
title: The room panel at a glance: chips, signed meters and tooltips
status: open
size: M
area: ui, godot
feature: F-019
touches: [src/view/roomPanel.ts, src/ui/Inspector.tsx, src/ui/styles.css, godot/src/Inspector.cs]
blocked_by: [T-183]
notes: [N-0097]
created: 2026-10-25 10:58
---
## Problem
Numbers show as chips and meters instead of sentences, and long explanations move into tooltips.

## Context
Read F-019 (`docs/tickets/F-019-room-panel-hierarchy.md`) and its plan, `docs/PLAN-M18.md`, first; this is step 4 of its Steps. Web and Godot change together in this PR.

## Approach
The glance band (condition meter, felt effects, a home's comfort, noise and wellbeing, meals and restroom, a service's reach, storage), signed −3…+3 meters for felt effects and a home's factors, resource chips for uses and makes in Work, and the long text (factor breakdowns, the windows hint, the crowding rule) moved into tooltips. Web and Godot. Done: the change looks the same in the web game and the Godot viewer.

## Docs to update
GUIDE.md: the room panel. PLAN-M18.md Notes as built.

## History
- 2026-10-25 10:58 opened from F-019 (agreed)
