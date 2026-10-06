---
id: T-055
title: Milestone catalog and tracking in the sim
status: open
size: M
area: sim, data
touches: [data/milestones.json, data/events.json, src/sim/events.ts, src/sim/milestones.ts, src/sim/state.ts]
blocked_by: []
feature: F-005
notes: [N-0025]
created: 2026-10-06 01:40
---
## Problem
The first task of F-005: one list of milestones, tracked per hole with the day each was reached.

## Context
See F-005's Design. Fold M14's `celebrations.milestones` (`data/events.json`) into a new `data/milestones.json`; a milestone can carry `celebrate: true` to propose a festival as today. Keep the existing checks (`population`, `born`, `floors`, `domed`, `event`). Older saves: milestones already passed are marked reached (day unknown) without news, as celebrations do now.

## Approach
Catalog with id, title, group, check and threshold; per-hole `milestones: { id, day }[]` in state and the snapshot; a message when one is reached. Unit tests for reaching, saving and old saves. Done: existing celebrations behave as before, now driven by the catalog.

## Docs to update
DECISIONS.md: milestones and celebrations are one list. PLAN-M14.md notes as built if the celebrations move.

## History
- 2026-10-06 01:40 opened from F-005's breakdown
