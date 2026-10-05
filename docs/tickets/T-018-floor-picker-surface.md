---
id: T-018
title: Rename the floor picker's "All" to "Surface"
status: open
size: S
area: ui, godot
touches: [src/ui/FloorPicker.tsx, godot/src/]
blocked_by: []
notes: [N-0013]
created: 2026-10-05 01:11
---
## Problem
"We should rename the 'all' floor to 'surface'."

## Context
- `src/ui/FloorPicker.tsx`: `button(null, "All", "Show every floor")` (3D only).
- Not the trend chart's "All" time range (`src/ui/trends.ts`), which is a different thing.
- Godot's floor picker probably has its own label; check `godot/src/`. The README/GUIDE may mention "All".

## Approach
Change the label (and its tooltip, e.g. "The surface and every floor") in web and Godot, and the docs that mention it.

## Docs to update
- GUIDE.md (and README.md) where they mention the floor picker's "All".

## History
- 2026-10-05 01:11 opened from N-0013
