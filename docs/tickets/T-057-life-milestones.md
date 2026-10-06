---
id: T-057
title: Life milestones: first harvest, Martian adult, third generation and more
status: open
size: M
area: sim, data
touches: [data/milestones.json, src/sim/milestones.ts, src/sim/people.ts, src/sim/events.ts]
blocked_by: [T-055]
feature: F-005
notes: [N-0025]
created: 2026-10-06 01:40
---
## Problem
New checks for F-005: first harvest, first Martian adult (someone born in the hole grows up), third generation (grandchild of an original colonist born), laid to rest (first death of old age), full ring (every slot on one floor's ring dug), good neighbors (belt ship rescued).

## Context
See F-005's Design. Population is in cohorts (`src/sim/people.ts`), so "born here" and generations may need a light count kept alongside (born-here adults, a generation counter) rather than per-person lineage. Good neighbors can use the existing `event` check from the belt ship's rescue choice.

## Approach
Add each check to the catalog and the sim, with tests. Done: each can be reached in a scripted run or a unit test.

## History
- 2026-10-06 01:40 opened from F-005's breakdown
