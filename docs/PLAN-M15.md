# Milestone 15 plan: room materials, finishes and floors

Goal: a room carved out of bare rock early can be **upgraded in place** later, to smoothed rock, brick or metal, each with a finer finish, and its floor can be upgraded on its own. Upgrades make a room nicer to live or work in and slower to wear out, by different amounts for different kinds of room.

Feature: `docs/tickets/F-003-room-materials.md` (from Bryon's notes N-0006 and N-0007, Oct 4, 2026).

## Decided (Bryon, Oct 4)

- **No refund** for the old material. An upgrade costs the new one and goes through the **construction queue** (M7).
- **Usable while upgrading, at half output**; homes at reduced comfort.
- Upgrades change **comfort and condition wear**. Cave-in resistance only once cave-ins exist.
- **Two steps per material** (base and finished) for rock, brick and metal. Marscrete and glass later.
- **Skipping a step is allowed** (bare rock straight to patterned brick), paying the full cost of both steps.
- **Floors** match the walls by default and are **their own upgrade**, independent of the walls. The first: **fibre-composite panels** (hemp fibre), which only change the floor and add comfort.

## What a room's material is

Today a room's build cost (`cost` in `data/rooms.json`) is a recipe of rock, brick, metal and machinery, but nothing records what its walls are: every room is drawn as the rock it was carved from. This plan keeps it that way at first and adds the lining on top:

- **Every room starts as bare rock**, whatever its build cost. The build cost stays what it is (the room's fittings and equipment), so no existing balance moves.
- **The lining is a property of the room:** `room.material` (`rock`, `brick`, `metal`) and `room.finish` (`base` or `fine`). Absent means bare rock, so old saves need no migration beyond the version bump.
- **The floor:** `room.flooring`, absent meaning "matches the walls"; otherwise a flooring id (`fibre_panels` first).
- **Corridors** keep their own finishes (`data/corridors.json`), which are only a look. They share the new surface shaders, so a brick corridor and a brick room look alike.

## Defaults (to confirm or change)

All numbers live in a new `data/materials.json`; nothing in sim code.

**Walls.** Costs and work are **per cell** (a 10 m slot on one floor: an S room is 1 cell, M 2, L 4), so bigger rooms cost more to line.

| Material | Step | Name | Cost per cell | Work per cell | Comfort (homes) | Wear |
| --- | --- | --- | --- | --- | --- | --- |
| Rock | base | Bare rock (default) | — | — | 0 | ×1 |
| Rock | fine | Smoothed rock | rock 4 | 2 h | +0.25 | ×0.95 |
| Brick | base | Brick | brick 8 | 3 h | +0.5 | ×0.85 |
| Brick | fine | Patterned brick | brick 4 more | 3 h more | +0.75 | ×0.85 |
| Metal | base | Metal panels | metal 6 | 3 h | +0.5 | ×0.7 |
| Metal | fine | Inlaid metal | metal 3, glass 1 more | 4 h more | +1 | ×0.7 |

- **Comfort is the total** for that step, not added to the one before. **Wear** multiplies the room's daily condition decay (`data/condition.json`).
- **Moves allowed:** any step up to any other material's step; skipping a step costs both (rock → patterned brick: brick 12, 6 h a cell). Going back down (metal → brick) is allowed and costs the new material in full; going to bare rock isn't offered (there's nothing to buy).
- **Different degrees by kind of room** (`materials.json` `byCategory`, with an optional per-room override in `rooms.json`):
  - **Homes** feel the comfort in full.
  - **People rooms** (the cleanable ones: galley, restroom, clinic, gym, park, school…) add to everyone's **shared comfort** the way their wear already takes from it (`sharedWear` in `condition.ts`): the average lining comfort of the shared rooms, weighted like wear, up to +0.5.
  - **Heavy rooms** (industry, power, air, water) get no comfort, but double the wear benefit (metal panels on a smelter: wear ×0.4).
  - Others (storage, logistics, offices) get the wear benefit only.
- **Which rooms can be upgraded:** ring rooms that have walls. Not surface buildings, the entrance, stairs and elevators, empty rooms, or a room still under construction (`materials.json` `exempt`).

**Floors.**

| Flooring | Cost per cell | Work per cell | Comfort (homes) |
| --- | --- | --- | --- |
| Matches the walls (default) | — | — | 0 |
| Fibre-composite panels | fibre 3 | 1.5 h | +0.25 |

- Floor comfort adds to the walls' (fibre panels in a patterned-brick home: +1). People rooms count it towards shared comfort as for walls; heavy rooms ignore it.
- Changing the walls later keeps the panels; taking panels out (back to matching) is free and instant.
- **Fibre needs a source.** Nothing makes fibre yet: farms grow only food crops. A small step adds **fiber hemp** as a crop (ROOMS.md: yield 6, water 4, power 3 for an L farm) whose output is a new `fiber` material instead of raw food, stored like other dry goods.

**Upgrading.**

- **A construction job** of a new kind, `upgrade`: `{ roomId, to: { material, finish } }` or `{ roomId, flooring }`, its work from the table times the room's cells. Paid on commit; cancelling refunds in full (from the queue panel's ✕, or by demolishing the room).
- **One upgrade at a time per room** (walls or floor). Asking again while one is queued replaces it, refunding the first.
- **While queued or under way** the room keeps running at **half output** (a new `upgrading` limit beside `worn` in its status, through `conditionOutput`'s factor), and a home's comfort drops by **0.5** ("being refitted"). The half rate applies from the moment the job is **started** (first work-hour), not while it waits in the queue.
- **Done:** the room takes its new material, condition goes back to 100% (a fresh lining), and the news says "Dorm 3 refitted in brick."
- **Bots** upgrade their homes to brick once brick is above 60 with nothing else queued, so the playthroughs exercise it.

**UI.**

- **Room panel** (`src/view/roomPanel.ts`, shared with Godot): a "Walls: Bare rock" line with an **Upgrade** control listing the five other steps, each with its cost, time and comfort change, greyed with the reason when it can't be afforded; a "Floor: matches walls" line with the same for floorings. While upgrading, the room's queue progress as for construction.
- **Room card and inspector** say what the lining gives ("Brick: comfort +0.5, wears 15% slower").
- **Construction panel** lists the job as "Refit Dorm 3 in brick".
- **2D unrolled and plan views:** a thin inner border in the material's accent colour (bare rock none); the full look is 3D's job.

**Looks (3D, web then Godot).** Procedural, in `render3d/surfaces.ts` beside the rock and corridor surfaces, so nothing is unwrapped:

- Bare rock: as now. Smoothed rock: the same strata, flattened and sealed (less grain, a soft sheen).
- Brick: laid courses, the corridor brick. Patterned brick: herringbone or banded courses with a darker accent row at waist height.
- Metal panels: light steel panels with seams and rivets. Inlaid metal: the same with a decorative inlay band and brass trim.
- Floors follow the walls (polished stone, brick pavers, steel plate). Fibre panels: warm woven-looking square tiles.
- While upgrading, the room shows a band of the hazard stripes from M7 at the top of its walls and a % label, so it reads as busy but in use.

## Steps

1. **Materials in the sim.** `data/materials.json`, `room.material`, `finish` and `flooring`, comfort for homes and shared rooms, the wear factor, the inspector line, save version bump. Set only by tests and the console yet. *See:* a home's comfort changes when its material is set from the console.
2. **The Upgrade action.** The `upgradeRoom` command and the `upgrade` job, half output and the refit comfort dip while it runs, both-steps pricing, cancel and refund, the room panel's Upgrade control, the Construction panel's label, the 2D accent border, bots. *See:* upgrade a dorm to brick and watch it work at half speed until done.
3. **Looks in the web 3D view.** Six wall surfaces, their floors and the refit stripes. *See:* each step in a room in 3D.
4. **Looks in Godot.** The same surfaces in `godot/shaders/surfaces.gdshader` and `Looks.cs`, the material passed through the bridge, the panel's Upgrade control working there. *See:* the same rooms in the viewer.
5. **Fibre.** The fiber hemp crop and the `fiber` material, storage for it. *See:* a hemp farm fills a store with fibre.
6. **Floor upgrades.** `flooring` upgrades (fibre-composite panels), the panel's Floor control, floor looks in web 3D and Godot. *See:* panels go down in a home without touching its brick walls.

Each step leaves the game working when merged on its own; 5 can go any time before 6.

## Later

- **Marscrete** as a cheaper, plainer alternative to brick (DECISIONS: 1.5× the brick, comfort −1 against brick, better cave-in resistance), once the concrete plant is built.
- **Glass** linings (glass block walls) and more floorings (mycelium composite boards, rugs).
- **Cave-in resistance** per material, once cave-ins exist.
- **Choosing the material when building** (paying for the room and the lining together), if upgrading every room afterwards turns out to be tedious.

## Notes as built

**Step 1, materials in the sim (T-032, Oct 6).**

- `data/materials.json` holds the walls table (a fine finish's cost and work are on top of its base step's, as in the plan), the floorings (fibre panels, costing `fiber`, which T-036 adds), the four kinds and what each gets (`kinds`: comfort share and wear benefit), `byCategory` (the heavy categories), `byRoom` (per-room overrides; kept here rather than in `rooms.json`, so all the lining numbers sit together), `shared` (scale 0.5, max 0.5), `leastWear` and `exempt`.
- `src/sim/materials.ts`: `liningOf`, `flooringOf`, `liningKind`, `liningComfort` (homes), `sharedLiningComfort` (everyone), `liningWear` and `liningText`. A room's kind: `byRoom`, then homes (rooms that house), then people rooms (`condition.json`'s cleanable list, so the restroom counts as people though its category is water), then `byCategory`, else other.
- **Shared comfort** is the plain average of the people rooms' lining comfort (walls plus floor), times `shared.scale`, capped at `shared.max`. Only built, active people rooms count; workshops and stores don't dilute it.
- **Wear:** `stepCondition` multiplies each room's decay by `liningWear`: `1 − (1 − wear) × wearBenefit`, never below `leastWear` (metal panels on a heavy room: ×0.4).
- **The room panel** (`panelRows`, shared with Godot) has a **Walls** row for every room that can have a lining: "Patterned brick, fibre-composite panels floor: comfort +1, wears 15% slower".
- **Console:** `dm.lining(roomId, material, finish?)` and `dm.floor(roomId, flooring?)` (the `consoleLining` command) set a lining outright, for free. Nothing else sets one yet.
- **Save v19:** no migration needed (absent fields are bare rock).
