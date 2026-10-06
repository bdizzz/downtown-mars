---
id: T-059
title: Network milestones: kit sent, trade routes, holes linked, drifting apart
status: open
size: M
area: sim, data
touches: [src/sim/milestones.ts, src/sim/founding.ts, src/sim/network.ts, data/milestones.json]
blocked_by: [T-055]
feature: F-005
notes: [N-0025]
created: 2026-10-06 01:40
---
## Problem
F-005's network milestones: a hole that produced a kit to found another hole (its first successful founding), first trade route, then 3 and 5 holes linked, and drifting apart (one hole's culture clearly different from the others).

## Context
See F-005's Design. Founding is in `src/sim/founding.ts`. "Clearly different" needs a threshold on the culture distance between holes; pick one in data.

## Approach
Checks in the catalog and sim; the founding milestone goes to the hole that sent the kit, the network ones to the network section. Tests. Done: each reachable in a scripted two-or-more-hole run.

## History
- 2026-10-06 01:40 opened from F-005's breakdown
