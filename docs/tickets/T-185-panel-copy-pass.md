---
id: T-185
title: The room panel's copy pass: shorter row text, every room family checked
status: open
size: S
area: ui, godot
feature: F-019
touches: [src/view/roomPanel.ts, docs/GUIDE.md]
blocked_by: [T-184]
notes: [N-0097]
created: 2026-10-25 10:58
---
## Problem
With labels, icons and tooltips carrying the meaning, the rows can say less.

## Context
Read F-019 (`docs/tickets/F-019-room-panel-hierarchy.md`) and its plan, `docs/PLAN-M18.md`, first; this is step 5 of its Steps. Web and Godot change together in this PR.

## Approach
Shorten each row's text, look at every room family on screen in both viewers (a home, a farm, a tank, a service, a store, the staging bay, something under construction) and fix what reads badly, and update the room panel's screenshots in GUIDE.md. Done: the change looks the same in the web game and the Godot viewer.

## Docs to update
GUIDE.md: the room panel. PLAN-M18.md Notes as built.

## History
- 2026-10-25 10:58 opened from F-019 (agreed)
