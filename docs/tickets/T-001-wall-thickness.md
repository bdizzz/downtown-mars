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
Build each wall once per edge (room–room, room–corridor, room–rock), as a box straddling the edge line or set into the room, rather than per room face. Keep the walls-down tagging per side. Done: 0.25 m walls everywhere in 3D, one wall between neighbours, doors and windows cut cleanly through the thickness, walls down/outlines/picking still right, furniture not clipping. Check Godot.

## Docs to update
- ART.md or DESIGN.md (3D section): walls are 0.25 m thick, one per shared edge.
- PLAN-GODOT.md if Godot needed changes.

## Open questions
- [ ] Where does the thickness go? (a) centred on the edge line, so a room loses 0.125 m on each walled side (proposed); or (b) entirely inside each room, with shared walls split.
- [ ] Walls along corridors and gallery tubes: same 0.25 m, eating into the corridor/tube side or the room side? And the walls facing rock?

## History
- 2026-10-04 16:12 opened from N-0001
