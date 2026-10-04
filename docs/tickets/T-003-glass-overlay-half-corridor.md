---
id: T-003
title: Windows tool highlights only the targeted wall's half of the corridor
status: done
size: S
area: render3d, godot
touches: [src/render3d/stage3d.ts, src/render3d/rooms3d.ts]
blocked_by: []
notes: [N-0003]
created: 2026-10-04 16:12
---
## Problem
Adding glass (the corridor tool's Windows mode) highlights the whole corridor, so it's hard to tell which room on that corridor gets the glass. Bryon wants the overlay to cover only the half of the corridor on the side of the targeted wall.

## Context
- The hover ghost is `ghostEdge` in `src/render3d/stage3d.ts` (~line 826), drawn for `info.edge.windows?.edges` (~line 868) with `corridorStripGeometry` from `rooms3d.ts` (the full corridor width).
- Needs to know which side of the edge the glazed wall faces; the windows proposal should already know which room it's for.
- Check the Godot viewer's hover overlay for the same (it may draw from the bridge's ghost info).
- Related: T-001 (wall thickness changes where the wall face is).

## Approach
Give `corridorStripGeometry` (or a sibling) an optional side, producing the half-width strip toward that room; use it for windows hover only. Done: hovering a wall in Windows mode lights up just that room's half of the corridor, in web and Godot.

## Docs to update
- GUIDE.md: Windows (if it describes the highlight).

## History
- 2026-10-04 16:12 opened from N-0003
- 2026-10-04 16:15 building on t-003-glass-overlay-half-corridor
- 2026-10-04 16:19 built
