---
id: T-030
title: Too much oxygen: a fire-risk warning and the vent event
status: done
size: S
area: events, ui
feature: F-002
touches: [data/events.json, src/sim/events.ts, src/sim/air.ts, src/view/hudItems.ts]
blocked_by: [T-026]
notes: [N-0005]
created: 2026-10-06 00:08
---
## Problem
Above 23.5% O2 the hole shows a fire-risk warning, and after a while an event offers to vent the excess air to the planet (lost for good).

## Context
Read F-002 (`docs/tickets/F-002-air-mix.md`) and its plan, `docs/PLAN-M16.md`, first; this is step 5 of its Steps.

## Approach
The warning in the HUD and messages; the event after half a day above 23.5% with the O2 tanks full: vent to 21% (the vented O2 is gone) or hold. Done: the event fires in a test and venting brings O2 back to target.

## Docs to update
EVENTS.md (vent excess air), DECISIONS.md (the vent exception to "nothing vents"), PLAN-M16.md Notes as built.

## History
- 2026-10-06 00:08 opened from F-002 (agreed)
- 2026-10-10 01:11 building on t-109-cutaway-rock-front-face
- 2026-10-10 01:20 built
