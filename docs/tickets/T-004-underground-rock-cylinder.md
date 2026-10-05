---
id: T-004
title: A rock cylinder round the rings when viewing a floor underground
status: done
size: M
area: render3d, godot
touches: [src/render3d/stage3d.ts, src/render3d/cylinder.ts, src/render3d/surfaces.ts, godot/src/]
blocked_by: []
notes: [N-0004]
created: 2026-10-04 16:12
---
## Problem
Viewing a floor below the surface, you can see far into the distance past the hole. Bryon wants a cylinder of rock along the **outer edge of the unlocked rings** that stops the view. Its height runs only from the current floor up to the surface (not infinitely tall; short when looking at floor 1). It must never block the camera's view of any room or corridor.

## Context
- `applyFloorCut` in `src/render3d/stage3d.ts` (~line 1611) already swaps the sky for a plain earth colour (`C.earth`) when a floor is picked; this replaces "infinite earth colour" with an actual wall of rock.
- Ring radii: `ringRadii` in `src/render3d/cylinder.ts`; only rings 1–3 are open now, so the cylinder sits at ring 3's outer radius and moves out if rings 4–6 open. Rock surfaces: `surfaces.ts`; the Cutaway's section face uses a similar earth texture.
- "Never obscure": render it inward-facing only (back faces culled from outside), so a camera outside the radius sees through it; and keep it at or beyond the outermost ring so it can't sit in front of rooms.
- Godot draws its own sky/background; it'll want the same cylinder.
- Added in review (Bryon, Oct 5): in Iso with a floor picked, the land is cut open through the hole's axis, like a planet cut-out. When a floor is picked, rooms3d lays a 3 km earth-coloured cap (`CAP.beyond`) at that floor, which fills an Iso view, so a cut face alone barely showed. So the far half's land comes back (sliced by a shader: `withSlice` in `surfaces.ts`, `slice`/`land` in Godot's view.gdshaderinc), with an opening over the rings, and the sky over it; the near half keeps the cap at floor level. The rock wall loses its near half too.

## Approach
Add an open, inward-facing cylinder mesh at the unlocked rings' outer radius, from the picked floor's bottom up to ground level, shown whenever the view is below ground (a floor picked, or walking underground); rebuild on floor change and when rings open. Done: Iso/Top on any underground floor shows rock beyond the rings instead of open distance; zooming out past it never hides anything. Same in Godot.

## Docs to update
- ART.md: underground views are closed in by rock.
- PLAN-GODOT.md if ported.

## Open questions
- [x] First person (walk) underground gets it too, whenever you're below ground (Bryon, Oct 4).

## History
- 2026-10-04 16:12 opened from N-0004
- 2026-10-04 16:14 questions answered
- 2026-10-04 19:29 building on t-004-underground-rock-cylinder
- 2026-10-04 19:34 built
