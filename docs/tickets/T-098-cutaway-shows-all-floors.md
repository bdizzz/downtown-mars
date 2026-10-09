---
id: T-098
title: Cutaway always shows every floor and the surface; the floor picker hides there
status: open
size: S
area: ui, godot
touches: [src/ui/FloorPicker.tsx, src/ui/App.tsx, src/render3d/stage3d.ts, src/view/cameras.ts, godot/src/CameraRig.cs, godot/src/Live.cs]
blocked_by: []
notes: [N-0053]
created: 2026-10-08 20:01
---
## Problem
"We don't need the floor picker in cutaway mode; always show all floors and the surface in this mode. Going to another mode returns the floor picker to the same floor it was before going to cutaway mode."

## Context
The 3D view's cameras are now Free view (was Iso) and Cutaway (T-052 dropped Shaft and Top); Godot has `Overview { Iso, Cutaway }` in `godot/src/CameraRig.cs`. The floor picker (`src/ui/FloorPicker.tsx`) applies in both, hiding everything above the picked floor; Page Up/Down and the arrow keys step floors (`src/ui/App.tsx`). T-091 made the cutaway's ground solid down to floor 1.

## Approach
In Cutaway, hide the floor picker and show the whole hole from the surface down, ignoring the picked floor; keep the picked floor as it was (don't reset it), so switching back to Free view restores it. The floor keys do nothing in Cutaway (or switch to Free view on that floor; the build session can pick). Same in Godot. Done: entering Cutaway always shows everything with no picker; leaving it puts you back on the floor you had.

## Docs to update
GUIDE.md: The views (Cutaway).

## History
- 2026-10-08 20:01 opened from N-0053
