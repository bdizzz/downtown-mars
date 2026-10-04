---
id: T-008
title: Upgrade a room's building material and finish in place
status: open
size: XL
area: sim, ui
touches: [data/rooms.json, data/construction.json, src/sim/construction.ts, src/sim/commands.ts, src/sim/amenities.ts, src/view/roomPanel.ts, src/render3d/rooms3d.ts, src/render3d/surfaces.ts, godot/src/Looks.cs]
blocked_by: []
notes: [N-0006]
created: 2026-10-04 18:03
---
## Problem
Rooms are usually built from bare rock early because it's cheapest. Once brick and metal are available, Bryon wants to upgrade a room **in place** to the better material. No refund for the old material; the upgrade costs the new one, and it goes through the **construction queue**. On top of that, each material has finer **finishes**: bare rock → smoothed rock, brick → patterned brick, metal → inlaid decorative metal. Each room type keeps its own base comfort (and other values), and these upgrades raise them to different degrees.

## Context
- DECISIONS.md: "Glass is optional on every room; substitutes cost more and lower comfort. Marscrete can replace brick at 1.5× with a comfort penalty but better cave-in resistance." ROOMS.md has a material substitution section. Check how much of that is built: corridors carry a material (`layout.corridors[id] = "marscrete"`), rooms may not.
- Construction time and the queue: M7 (`docs/PLAN-M7.md`, `data/construction.json`). Windows (M13) are the nearest example of an in-place upgrade done with a tool.
- The 3D look already varies walls/floors by room type (`rooms3d.ts` around line 1070, `surfaces.ts`); material and finish should show (rock strata, brick courses, metal panels), in Godot too (`godot/src/Looks.cs`, `godot/shaders/surfaces.gdshader`).
- Comfort works through neighbor effects and home comfort (`sim/amenities.ts`, `sim/care.ts`).

**Floors (from T-009's answers):** a room's floor always matches its building material and finish by default. On top of that, the **floor is its own upgrade**, independent of the walls: e.g. **fibre-composite panels** (hemp fibre), which only change the floor and give a comfort boost. More floor finishes can follow.

## Approach
XL: worth a short plan of its own (`docs/PLAN-M15.md` or similar) before building. Rough pieces: a material + finish tier per room in the sim and saves; a data table of materials × finishes with cost and comfort/condition/other modifiers; an Upgrade action in the room panel that queues a construction job; the look per material and finish in web and Godot; bots unaffected. Floor upgrades are a separate action with their own cost and comfort. Done: you can take a rock bunk dorm to patterned brick, pay brick, watch it build, and see comfort rise; and lay fibre-composite floors in it for a little more.

**Becomes a feature (T-012).** Bryon wants this planned as a feature (an epic): the plan, details and how to break the work into tasks live in the feature, and task tickets are written only once the feature is agreed. Until T-012 lands, this ticket stands in for the feature.

## Docs to update
- DECISIONS.md, DESIGN.md (materials), ROOMS.md (material substitution), GUIDE.md: Building, ART.md (material looks).

## Open questions
- [x] Usable while upgrading, at half output (homes at reduced comfort). (Bryon, Oct 4)
- [x] Upgrades change comfort and condition wear; cave-in resistance only once cave-ins exist. (Bryon, Oct 4)
- [x] Two finish steps (base and finished) for rock, brick and metal; marscrete and glass later. (Bryon, Oct 4)
- [x] Straight from rock to finished brick is allowed, paying the full cost of **both** steps: converting to brick, then brick base → finished. (Bryon, Oct 4)

## History
- 2026-10-04 18:03 opened from N-0006
- 2026-10-04 19:05 questions answered
