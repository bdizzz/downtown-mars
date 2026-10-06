---
id: T-027
title: Two-step flows: show where a use went next
status: open
size: S
area: ui, godot
touches: [src/sim/economy.ts, src/ui/FlowPanel.tsx, src/view/flows.ts, godot/src/]
blocked_by: []
feature: F-002
notes: [N-0005]
created: 2026-10-06 00:08
---
## Problem
The flow panel should be able to show a use in two steps (water → split into oxygen → air for new space · replacing breathed air · into the O2 reserve).

## Context
Read F-002 (`docs/tickets/F-002-air-mix.md`) and its plan, `docs/PLAN-M16.md`, first; this is step 2 of its Steps.

## Approach
The ledger records an optional `then` breakdown for a use; the web flow panel and Godot's charts show it as a second column. Nothing uses it yet except a test. Done: a recorded `then` shows up in both.

## Docs to update
PLAN-M16.md Notes as built.

## History
- 2026-10-06 00:08 opened from F-002 (agreed)
