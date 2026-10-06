---
id: T-033
title: The Upgrade action: refit a room in place through the construction queue
status: open
size: L
area: sim, ui
touches: [src/sim/commands.ts, src/sim/construction.ts, src/sim/condition.ts, src/view/roomPanel.ts, src/ui/ConstructionPanel.tsx, src/render2d/, tests/bot.ts]
blocked_by: [T-032]
feature: F-003
notes: [N-0006, N-0007]
created: 2026-10-06 00:10
---
## Problem
The player can refit a room's walls to another material and finish, paid for and built through the construction queue, while the room keeps working at half output.

## Context
Read F-003 (`docs/tickets/F-003-room-materials.md`) and its plan, `docs/PLAN-M15.md`, first; this is step 2 of its Steps. All numbers come from the plan's Defaults, in `data/materials.json`.

## Approach
The `upgradeRoom` command and `upgrade` job (both-steps pricing, one at a time per room, replace refunds the first, cancel refunds in full); half output and the 0.5 comfort dip once work starts; condition back to 100% when done, with a news line; the room panel's Upgrade control (shared with Godot through `roomPanel.ts`), the Construction panel's "Refit … in brick" label, the 2D/plan accent border; bots refit homes in brick. Done: upgrade a dorm to brick and watch it run at half speed until it's done; `npm test` passes.

## Docs to update
GUIDE.md: Building (refits), DECISIONS.md, PLAN-M15.md Notes as built.

## History
- 2026-10-06 00:10 opened from F-003 (agreed)
