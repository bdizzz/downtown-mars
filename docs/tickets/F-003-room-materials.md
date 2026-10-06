---
id: F-003
title: Room materials, finishes and floors, upgraded in place
status: agreed
plan: docs/PLAN-M15.md
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

The plan (`docs/PLAN-M15.md`, proposed Oct 5):
- **Every room starts as bare rock**; its build cost stays as it is (fittings and equipment), so no balance moves. The lining is `room.material` (`rock`, `brick`, `metal`) and `room.finish` (`base`, `fine`), absent meaning bare rock; the floor is `room.flooring`, absent meaning "matches the walls". Corridors keep their own finishes but share the new surface looks.
- **A new `data/materials.json`:** cost and work per cell (bigger rooms cost more), comfort and a wear multiplier per step. Smoothed rock (rock 4, +0.25, wear ×0.95), brick (brick 8, +0.5, ×0.85), patterned brick (+brick 4, +0.75), metal panels (metal 6, +0.5, ×0.7), inlaid metal (+metal 3 and glass 1, +1).
- **By kind of room:** homes feel the comfort in full; people rooms (galley, restroom, clinic…) add to shared comfort the way their wear takes from it (up to +0.5); heavy rooms (industry, power, air, water) get no comfort but double the wear benefit; the rest get the wear benefit only.
- **Upgrading** is an `upgrade` construction job, paid on commit and refunded if cancelled. Once crews start, the room runs at half output and a home loses 0.5 comfort until it's done; then its condition is back to 100%.
- **Floors:** fibre-composite panels (fibre 3 a cell, +0.25). Nothing makes fibre yet, so a small task adds **fiber hemp** as a farm crop with a `fiber` material output.
- **Looks** are procedural surfaces beside the rock and corridor ones (`render3d/surfaces.ts`, `godot/shaders/surfaces.gdshader`); 2D and plan views get only an accent border.
- **Later:** marscrete linings, glass, more floorings, cave-in resistance. (Picking the material when building is now T-038.)

Context: DECISIONS.md has glass as optional and marscrete replacing brick at 1.5×; ROOMS.md has a material substitution section. Corridors already carry a finish (`layout.corridors[id] = "marscrete"`, `data/corridors.json`), purely a look; rooms don't. Windows (M13) are the nearest example of an in-place upgrade. Looks: `rooms3d.ts` (around line 1070), `surfaces.ts`; Godot `godot/src/Looks.cs`, `godot/shaders/surfaces.gdshader`. Comfort: `sim/happiness.ts` (`homeFactors`), `sim/condition.ts` (`sharedWear`, `homeWearComfort`, decay), `sim/amenities.ts`, `sim/care.ts`. Output limits: `conditionOutput` in `condition.ts`. Jobs: `sim/construction.ts`.

## Open questions
- **Rooms start as bare rock whatever their build cost?** Answered (Bryon, Oct 6): yes by default, but build mode gets a **building material** picker, defaulting to bare rock, so a room can be built straight away in a higher material. It always costs bare rock's cost plus the upgrade's, whichever way the room got there. → T-038
- **Condition back to 100% when a refit finishes?** (Proposed: yes, a fresh lining; it makes refitting a worn room doubly worth it.)
- **Half output only once crews start**, not while the job waits in the queue? (Proposed: once started.)
- **Can a lining be downgraded** (metal → brick), paying the new one in full? (Proposed: yes; never back to bare rock.)
- **The numbers** in PLAN-M15's tables are first guesses for the playthroughs to tune.

## Breakdown
Agreed Oct 6. In build order; 5 can go any time before 6.
- (M) Materials in the sim: `data/materials.json`, `room.material`, `finish` and `flooring`, comfort for homes and shared rooms by kind of room, the wear multiplier, an inspector line, save version bump (set by tests and the console only) → T-032
- (L) The Upgrade action: `upgradeRoom` command and `upgrade` job, half output and the refit comfort dip, both-steps pricing, cancel and refund, the room panel's Upgrade control, Construction panel label, 2D and plan accent border, bots refit homes in brick → T-033
- (M) Looks in the web 3D view: smoothed rock, brick, patterned brick, metal panels, inlaid metal, their floors, refit stripes → T-034
- (M) Looks in Godot: the same surfaces, the material through the bridge, the Upgrade control working in the viewer → T-035
- (S) Fibre: fiber hemp as a farm crop making a new `fiber` material, stored like other dry goods → T-036
- (M) Floor upgrades: `flooring` upgrades starting with fibre-composite panels, the panel's Floor control, floor looks in web 3D and Godot → T-037
- (M) Build in a material: build mode's material picker (defaults to bare rock), cost = bare rock + upgrade, work = build + refit; web and Godot → T-038

## History
- 2026-10-04 19:12 made from T-008 (T-012 moved room materials into a feature)
- 2026-10-05 09:07 planning on f-003-room-materials
- 2026-10-06 00:11 agreed
- 2026-10-06 00:15 build-mode material picker added as T-038 (Bryon)
