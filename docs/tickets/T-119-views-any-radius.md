---
id: T-119
title: "Every view at any shaft radius"
status: open
size: L
area: render3d, render2d
touches: [src/render3d/, src/render2d/, src/view/]
blocked_by: [T-117]
feature: F-013
notes: [N-0065]
created: 2026-10-10 00:40
---
## Problem
The 3D view, plan, unrolled, cutaway and camera limits work at any shaft radius.

## Context
Read F-013 first: its Design holds the decisions this task builds on.

## Approach
Find assumptions of the starter radius in the views (shaft collar, drill rig, galleries, dome, cutaway, camera zoom caps from T-051) and drive them from the hole's radius. Check each size by eye.

## History
- 2026-10-10 00:40 opened from F-013 (agreed)
