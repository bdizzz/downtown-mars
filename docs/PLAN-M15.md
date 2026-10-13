# Milestone 15 plan: room materials, finishes and floors

Goal: a room carved out of bare rock early can be **upgraded in place** later, to smoothed rock, brick or metal, each with a finer finish, and its floor can be upgraded on its own. Upgrades make a room nicer to live or work in and slower to wear out, by different amounts for different kinds of room.

Feature: `docs/tickets/F-003-room-materials.md` (from Bryon's notes N-0006 and N-0007, Oct 4, 2026).

## Decided (Bryon, Oct 4)

- ~~**No refund** for the old material.~~ (Revised Oct 6: taking out brick or metal refunds **50%** of it, rounded down, the inlay's glass lost, and a room can be stripped back to bare rock; see Upgrading.) An upgrade costs the new one and goes through the **construction queue** (M7).
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
- **Moves allowed:** any step up to any other material's step; skipping a step costs both (rock → patterned brick: brick 12, 6 h a cell). Going back down (metal → brick) is allowed and costs the new material in full; going back to bare rock is allowed too (revised Oct 6): it's free, and **salvages** half the old lining's material.
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
- **Downgrades and salvage** (Bryon, Oct 6): any lining can change to any other, including back to bare rock. The old lining's brick or metal comes partly back: **50%** of what it cost, rounded down, the inlay's glass lost, paid when the job is done. Stripping is a refit job at **half** the lining's work per cell, the room at half output while it runs; cancelling refunds what was paid and salvages nothing.
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

- `data/materials.json` holds the walls table (a fine finish's cost and work are on top of its base step's, as in the plan), the floorings (fibre panels, costing `fiber`, from T-036's hemp), the four kinds and what each gets (`kinds`: comfort share and wear benefit), `byCategory` (the heavy categories), `byRoom` (per-room overrides; kept here rather than in `rooms.json`, so all the lining numbers sit together), `shared` (scale 0.5, max 0.5), `leastWear` and `exempt`.
- `src/sim/materials.ts`: `liningOf`, `flooringOf`, `liningKind`, `liningComfort` (homes), `sharedLiningComfort` (everyone), `liningWear` and `liningText`. A room's kind: `byRoom`, then homes (rooms that house), then people rooms (`condition.json`'s cleanable list, so the restroom counts as people though its category is water), then `byCategory`, else other.
- **Shared comfort** is the plain average of the people rooms' lining comfort (walls plus floor), times `shared.scale`, capped at `shared.max`. Only built, active people rooms count; workshops and stores don't dilute it.
- **Wear:** `stepCondition` multiplies each room's decay by `liningWear`: `1 − (1 − wear) × wearBenefit`, never below `leastWear` (metal panels on a heavy room: ×0.4).
- **The room panel** (`panelRows`, shared with Godot) has a **Walls** row for every room that can have a lining: "Patterned brick, fibre-composite panels floor: comfort +1, wears 15% slower".
- **Console:** `dm.lining(roomId, material, finish?)` and `dm.floor(roomId, flooring?)` (the `consoleLining` command) set a lining outright, for free. Nothing else sets one yet.
- **Save v20:** no migration needed (absent fields are bare rock).

- **Floors in room-colour mode (T-076, Oct 8).** Room colours tint walls and floors by category, but a floor's texture is always what the room is built from, the same as with room colours off: `withFloor(material, finish)` in `surfaces.ts` lays the finish's own pattern, colour and sheen, tinted 40% by the room's colour (Godot: `floor_look` in `surfaces.gdshader`, set from the `room:…:<finish>:…` material name in `Looks.cs`). The per-category floor kinds (stone, tiles, plate, paving, concrete) are gone. The finish is still `roomFinish(type)` (the material the build cost uses most); T-034 swaps in `room.material` and `finish` in one place in `buildLayout`, so both modes follow it. Floor upgrades (T-037) should go through the same path rather than reintroducing per-kind floors.

- **Looks in the web 3D view (step 3, T-034, Oct 8).**
  - `roomLook(room)` (`src/view/roomFinish.ts`) is what a room looks like: its lining as `rock`, `rock_fine`, `brick`, `brick_fine`, `metal` or `metal_fine`, or, for rooms that can't have one (`canLine`: the entrance, stairs and lifts, empty rooms), `roomFinish(type)` as before. `buildLayout` and the plan's room-colours-off fill (`planDraw.ts`) both use it, so **every ring room now looks bare rock until it's refitted**, whatever its build cost (as the plan says; before, a clinic looked brick because its cost is mostly brick).
  - `FINISH_LOOK` in `surfaces.ts` has the three fine finishes beside rock, marscrete, brick and metal; each fine pattern calls its base step's (`smoothRockTone` over `rockTone`, `inlaidMetalTone` over `metalTone`). Walls' waist and shoulder bands are measured from the floor (`srfAbove`, as grime does). Details are in ART.md ("Room linings").
  - **Corridor floors** take the same surface as their finish (`withSurface`), not just bare rock's strata.
  - **Refit band:** `withRefit` paints hazard stripes 0.25–0.85 m below the top of the walls, over every other pattern and the grime (at `<alphamap_fragment>`, after they've all multiplied in). `buildLayout` takes a `refitting(room)` test; `stage3d`'s `refitRooms` counts any built room with its own job in the queue (other than an `extend`), which is what T-033's `upgrade` job will be, so the stripes and the queue's existing % label (`drawProgress`) light up with no further change. Nothing makes such a job yet, so the band has been checked only on a test page. Walls lowered by walls-down lose the band (it's measured after they drop); the far walls keep it.
  - **Godot:** material names now carry the new finishes (`finish:brick_fine:…`, `room:…:metal_fine:…`, and `:refit` on the end while refitting). `Looks.cs` maps the fine finishes to their base step's look for now; their own patterns and the refit band are T-035.

- **The Upgrade action (step 2, T-033, Oct 13).**
  - **Command and job:** `upgradeRoom { roomId, material, finish }` queues an `upgrade` job (`construction.ts`) carrying `to`, what was `paid` and the `salvage` due. Walls only; floors (`{ roomId, flooring }`) are T-037's.
  - **Pricing** is `refitPlan` (`materials.ts`), per cell times `room.cells.length`. Within a material only the finish moves: up pays the fine step, down strips it. To another material the old lining is stripped whole (half its work, `salvage.stripWork`) and the new one put in whole (base plus fine), so brick → metal panels on an M room is metal 12, 9 h, salvaging brick 8. The share and what's lost (`rock`, `glass`) are `salvage` in `materials.json`; the half output and the −0.5 comfort are `refit`. Smoothed rock salvages nothing (its cost is rock, which is lost).
  - **One at a time:** a new order replaces the queued one, refunding it; ordering the lining the room already has just calls the queued refit off. Cancelling (`cancelJob`, the queue's ✕, or the panel's "Cancel the refit") and demolishing (`dropRoomJobs`) refund what was paid. With construction time off it's done at once.
  - **Under way** (`refitting`: its job has done any work): `runRoom` multiplies the rate by `refit.output` with the limit `refit` ("half speed while it's refitted", no trouble badge), and `homeFactors` adds `refitComfort`. The economy runs before construction in a tick, so the half rate shows from the tick after the crews start.
  - **Done:** `finishRefit` sets the lining (bare rock clears `material` and `finish`), condition 1, any repair dropped, the salvage paid (ledger label "Salvage"), and the news: "Dorm 3 refitted in brick." or "Dorm 3 stripped back to bare rock: brick 8 salvaged."
  - **UI:** `refitOptions` (`roomPanel.ts`, for Godot too) lists every other lining with what it gives (`liningText` of the room as it would be), its cost or "free", its salvage and work-hours, greyed with the reason (`refitRefusal`, counting a queued refit's refund). The web inspector shows it as a **Refit** picker under the rows; a queued refit shows its progress at the top as construction does ("Refit in brick: 12% · 1st in the queue…"), with Cancel. `JobView` gained `lead` ("Refit" or "Strip"), `to` and `paid`; the Construction panel reads "Refit *Galley* in inlaid metal". The 3D refit stripes and the plan's % label (T-034) light up with no further change.
  - **2D:** `liningAccent` (`planDraw.ts`) gives a lined room's colour (as with room colours off); the plan draws a 2 px outline 0.9 m inside the room (`outlineCells` gained an `inset`), the unrolled view a rect 2.5 px inside each row. Not drawn with room colours off in the plan, where the fill already shows the lining.
  - **Bots** (`tendLinings`, `tests/adaptive.ts`, once a day with an empty queue): a home in brick when brick is over 60, as planned, or else smoothed rock when rock is over 120, because the first month's bot never makes brick (it sits at 50) and the brick rule alone never fires. Its three dorms get smoothed in the 30-day playthrough.
  - **Not built here:** the Upgrade control in Godot (T-035), floors (T-037). Demolishing a lined room doesn't salvage its lining (the room's own 50% refund only).

- **Fibre (step 5, T-036).** Fiber hemp is a crop in `data/crops.json` with `"makes": "fiber"`; `roomSpec` swaps the farm's raw food for whatever its crop makes, so any future non-food crop is data only. `fiber` is a material in `data/resources.json`, so storage takes it with no change. It shows in the resource bar once there's some, and in Trends under Materials. The farm keeps its O2 and CO2 exchange. Hemp has its own planter and rack (tall stalks with fanned leaves) in `scripts/furniture.mjs`.
