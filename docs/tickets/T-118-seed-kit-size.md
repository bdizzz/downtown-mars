---
id: T-118
title: "Pick the new hole's size when assembling the seed kit"
status: open
size: M
area: sim, ui
touches: [src/sim/founding.ts, src/ui/]
blocked_by: [T-117]
feature: F-013
notes: [N-0065]
created: 2026-10-10 00:40
---
## Problem
The size is chosen once, when building the seed kit at an existing hole; a bigger hole needs more resources and a larger drill built and sent with the kit.

## Context
Read F-013 first: its Design holds the decisions this task builds on.

## Approach
Add a size choice to seed-kit assembly (`src/sim/founding.ts`, the kit staging rooms), with each size's extra resources and drill, and the trade-offs shown (slower digging, more gallery, more dust and cold). The founded hole gets that radius.

## History
- 2026-10-10 00:40 opened from F-013 (agreed)
