---
id: T-144
title: A concrete collar round the top of the shaft, with the drill's cable machinery
status: open
size: M
area: render3d, godot
touches: [src/render3d/drillRig.ts, src/render3d/shafts3d.ts, src/render3d/scenery3d.ts, godot/]
blocked_by: []
notes: [N-0078]
created: 2026-10-11 15:52
---
## Problem
"A 'concrete collar' around the top of the hole, where it transitions to surface", for realism and to keep rock from crumbling in, with machinery on it managing the cables that rise through the shaft from the drill. Purely decorative: not selectable, no resources, costs, maintenance or effects.

## Context
The drill rig is drawn in `src/render3d/drillRig.ts`; the shaft in `shafts3d.ts`. The shaft dome (M12) also sits at the top, so the collar needs to fit under it. Surface buildings (T-107, T-108) will sit around the shaft too.

## Approach
A ring of concrete (marscrete-coloured) lining the top couple of metres of the shaft and lipping onto the surface, a winch and pulley frame on it with cables running down to wherever the drill is now. Not pickable. Godot in the same PR, but only after Bryon has checked the web version's look (`/try`). Done: the top of the hole reads as engineered, and the cables follow the drill as it goes deeper.

## Open questions
- [x] Godot in the same PR, or a follow-up? → Same PR, but build the Godot version only after Bryon has checked the web one for looks. (Bryon, Oct 11)

## History
- 2026-10-11 15:52 opened from N-0078
- 2026-10-11 16:08 questions answered
- 2026-10-12 20:07 building on t-144-concrete-collar (with T-107)
- 2026-10-12 20:20 web built; Godot once Bryon has checked the look
