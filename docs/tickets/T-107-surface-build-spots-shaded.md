---
id: T-107
title: In build mode, show where surface buildings can go, and brighten a spot on hover
status: open
size: M
area: render3d, godot
touches: [src/render3d/stage3d.ts, src/render3d/scenery3d.ts, godot/src/BuildMode.cs, godot/src/Scenery.cs]
blocked_by: []
notes: [N-0062]
created: 2026-10-10 00:18
---
## Problem
"When in build mode, we should show slightly shaded areas on the surface where surface buildings can be built. When hovering over one with a surface room (like the solar panels) selected, these shaded areas become more opaque (like the current presentation on hover)."

## Context
Surface rooms take slots on one surface ring (`geometry.surfaceSlots: 12` in `data/config.json`, `surface` in `src/sim/placement.ts`). There's already a hover highlight for a surface spot; this adds a faint highlight on every free spot while build mode is open. T-108 adds surface rings 2 and 3, so draw spots generically per surface slot.

## Approach
Once a surface room is picked in build mode, draw a faint tint on each free surface spot it fits (the run of slots it needs); hovering a spot shows the current stronger highlight. With no surface room picked, nothing extra shows. Done on web and Godot: open build mode and the buildable surface spots are visible at a glance.

## Open questions
- [x] When do the faint spots show? Only once a surface room is picked.

## History
- 2026-10-10 00:18 opened from N-0062
- 2026-10-10 questions answered: spots show once a surface room is picked
- 2026-10-10 00:38 questions answered
