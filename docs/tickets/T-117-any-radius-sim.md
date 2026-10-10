---
id: T-117
title: "Hole sizes in data, and the sim working at any shaft radius"
status: open
size: L
area: sim, data
touches: [data/config.json, src/sim/]
blocked_by: []
feature: F-013
notes: [N-0065]
created: 2026-10-10 00:40
---
## Problem
The sim honours any shaft radius: S 10, M 15, L 25, XL 40 m, with slot counts, adjacency, galleries and light following.

## Context
Read F-013 first: its Design holds the decisions this task builds on.

## Approach
Sizes in data (radius, drill cost, dig speed, what the lift needs). Audit the sim for the starter radius baked in (slot counts come from the formula; check adjacency by angular overlap, gallery length, shaft light, dust and cold through the shaft) and make it follow `hole.shaftRadiusM`. The first hole is always S. Tests at each size.

## History
- 2026-10-10 00:40 opened from F-013 (agreed)
