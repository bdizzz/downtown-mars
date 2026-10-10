---
id: T-129
title: "Vertical slice in Pixi: one floor in sprites, driven by the forked sim"
status: open
size: L
area: render2d, sim
touches: [the fork]
blocked_by: [T-127, T-128]
feature: F-012
notes: [N-0064]
created: 2026-10-10 00:52
---
## Problem
One floor, a few rooms and people, in sprites, driven by the real sim: the first playable glimpse of the 2D edition.

## Context
Read F-012 first: its Design holds the decisions this task builds on (a fork later; Pixi first; test round and square layouts).

## Approach
Done in the fork, once Bryon says to start it: copy the sim and data, a Pixi renderer for one floor in the chosen layout and art style, people walking, rooms working. Then write the edition's own plan.

## History
- 2026-10-10 00:52 opened from F-012 (agreed)
