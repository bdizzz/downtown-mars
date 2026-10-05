---
id: F-003
title: Room materials, finishes and floors, upgraded in place
status: draft
plan:
notes: [N-0006, N-0007]
created: 2026-10-04 19:12
---
## Goal
Rooms built from cheap bare rock early can later be **upgraded in place** to brick or metal, and each material has a finer **finish** (bare rock → smoothed rock, brick → patterned brick, metal → inlaid decorative metal). Floors are their own upgrade on top. Upgrades raise each room type's own comfort (and other values) to different degrees.

## Design
Bryon's answers (Oct 4, first written up in T-008 and T-009):
- No refund for the old material; the upgrade costs the new one and goes through the **construction queue** (M7: `docs/PLAN-M7.md`, `data/construction.json`).
- The room stays **usable while upgrading, at half output** (homes at reduced comfort).
- Upgrades change **comfort and condition wear**; cave-in resistance only once cave-ins exist.
- **Two steps per material** (base and finished) for rock, brick and metal; marscrete and glass later.
- Straight from rock to finished brick is allowed, paying the full cost of **both** steps.
- **Floors** match the room's material and finish by default, and are **their own upgrade**, independent of the walls: e.g. **fibre-composite panels** (hemp fibre), which only change the floor and add comfort. More floor finishes can follow.

Context: DECISIONS.md has glass as optional and marscrete replacing brick at 1.5×; ROOMS.md has a material substitution section. Corridors already carry a material (`layout.corridors[id] = "marscrete"`); rooms may not. Windows (M13) are the nearest example of an in-place upgrade done with a tool. Looks: `rooms3d.ts` (around line 1070), `surfaces.ts`; Godot `godot/src/Looks.cs`, `godot/shaders/surfaces.gdshader`. Comfort: `sim/amenities.ts`, `sim/care.ts`.

Big enough for a plan doc of its own (the next free `docs/PLAN-M*.md`), written by `/build F-003` and linked in `plan:` above.

## Breakdown
Proposed; becomes tickets once this feature is agreed.
- A material and finish per room in the sim and saves, and a data table of materials × finishes with cost, comfort and condition modifiers
- The Upgrade action: room panel, construction job, half output while upgrading, both-steps pricing
- Looks per material and finish in the web 3D view
- Looks per material and finish in Godot
- Floor upgrades, starting with fibre-composite panels

## History
- 2026-10-04 19:12 made from T-008 (T-012 moved room materials into a feature)
- 2026-10-05 09:07 planning on f-003-room-materials
