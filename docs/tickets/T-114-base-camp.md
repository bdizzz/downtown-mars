---
id: T-114
title: "Later holes start with a base camp that works like the landing pod"
status: open
size: M
area: sim, data
touches: [src/sim/founding.ts, data/config.json, data/rooms.json, src/render3d/]
blocked_by: [T-111]
feature: F-011
notes: [N-0061]
created: 2026-10-10 00:40
---
## Problem
Holes after the first start with a base camp instead of a landing pod, colonists arriving by rover with resources in tow. It behaves just like the pod, including its own move-out mission.

## Context
Read F-011 first: its Design holds the decisions this task builds on.

## Approach
A second landing kit for founded holes (`src/sim/founding.ts`, `network.seedKit`), a `base_camp` surface room with the pod's provisions, and the move-out mission keyed to whichever of the two a hole has. A simple 3D model or a re-dressed pod.

## History
- 2026-10-10 00:40 opened from F-011 (agreed)
