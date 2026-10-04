---
id: T-001
title: Give room walls a real thickness (0.25 m, shared walls single)
status: open
size: L
area: render3d, godot
touches: [src/render3d/rooms3d.ts, src/render3d/cylinder.ts, src/render3d/furniture3d.ts, src/view/, godot/src/]
blocked_by: []
notes: [N-0001]
created: 2026-10-04 16:12
---
## Problem
Room walls are zero-thickness planes, which "isn't realistic when you think too much about what you're looking at." Bryon wants walls 0.25 m thick, and two rooms that share a wall get **one** 0.25 m wall, not two.

## Context
- Room geometry is built in `src/render3d/rooms3d.ts` (`roomGeometry`, `buildLayout`); walls carry `aWall`/`aWall2` tags for walls down (`WALLS_GLSL`), outlines come from `outlineGeometry`, and picking checks `loweredAt`. All of those have to keep working on a solid wall (top face, two sides, end caps at doors/windows).
- Windows (glass) and doors cut into walls; they'd need a reveal/depth now.
- Furniture is laid out from `data/layouts.json` against the room's inner faces; if walls eat into the room, wall hangings and against-the-wall pieces need to sit on the new inner face.
- The Godot viewer gets its scene from the bridge reusing the web's scene building, so it may come along for free; check it in Godot too.
- Related: T-002 (walls down), T-003 (glass overlay).

## Approach
Build each wall once per edge (room–room, room–corridor, room–rock), as a box centred on the edge line (0.125 m each side, the same for corridor, tube and rock edges), rather than per room face. Keep the walls-down tagging per side. Done: 0.25 m walls everywhere in 3D, one wall between neighbours, doors and windows cut cleanly through the thickness, walls down/outlines/picking still right, furniture not clipping. Check Godot.

## Docs to update
- ART.md or DESIGN.md (3D section): walls are 0.25 m thick, one per shared edge.
- PLAN-GODOT.md if Godot needed changes.

## Open questions
- [x] Where does the thickness go? Centred on the edge line, so a room loses 0.125 m on each walled side (Bryon, Oct 4).
- [x] Walls along corridors, gallery tubes and rock: the same 0.25 m, centred on the edge line like every other wall (Bryon, Oct 4).

## History
- 2026-10-04 16:12 opened from N-0001
- 2026-10-04 16:14 questions answered
