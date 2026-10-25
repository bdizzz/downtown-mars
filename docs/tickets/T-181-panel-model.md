---
id: T-181
title: The room panel as one model: status, headline, alerts, glance and sections
status: open
size: M
area: ui, bridge
feature: F-019
touches: [src/view/roomPanel.ts, src/view/roomState.ts, src/view/icons.ts, src/bridge/inspect.ts, godot/src/Inspector.cs, tests/]
blocked_by: []
notes: [N-0097]
created: 2026-10-25 10:58
---
## Problem
The panel's content becomes one structured model both viewers can draw from, before anything changes on screen.

## Context
Read F-019 (`docs/tickets/F-019-room-panel-hierarchy.md`) and its plan, `docs/PLAN-M18.md`, first; this is step 1 of its Steps. Web and Godot change together in this PR.

## Approach
`panelModel(s, room)` in `view/roomPanel.ts` with the types in PLAN-M18 §7, `roomTone()` beside `isProblem` in `view/roomState.ts`, the new icons in `view/icons.ts`; the bridge sends the model in `inspected`. Both viewers still draw today's flat rows (from `panelRows`, now a flattening of the model), so nothing changes on screen. Tests: every room in the dev saves gives a model; every row `panelRows` gives today lands in exactly one section; every warning is also an alert. Done: the change looks the same in the web game and the Godot viewer.

## Docs to update
PLAN-M18.md Notes as built.

## History
- 2026-10-25 10:58 opened from F-019 (agreed)
