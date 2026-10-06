---
id: T-060
title: Closed loop milestone: water treatment returns more than it loses
status: open
size: S
area: sim, data
touches: [src/sim/milestones.ts, data/milestones.json]
blocked_by: [T-055, T-005]
feature: F-005
notes: [N-0025]
created: 2026-10-06 01:40
---
## Problem
F-005's "closed loop": over a whole month, water treatment returns more than the hole loses.

## Context
See F-005's Design. Needs F-001's water loop (T-005: clean → gray → treatment, tailings as the leak).

## Approach
A monthly tally of treated water against losses; a check in the catalog. Test. Done: reachable once treatment outpaces the leak.

## History
- 2026-10-06 01:40 opened from F-005's breakdown
