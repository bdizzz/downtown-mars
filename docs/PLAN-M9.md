# Milestone 9 plan: the entrance, excavation and empty space

Goal: space is dug, not given. The drill sinks the shaft; every room is carved out of the rock first, and yields that rock. People and goods come and go through one entrance at the top, and floors are linked to it by stairs and elevators. A cargo elevator later brings the surface straight down to a floor of your choosing.

Decided Sep 28, 2026 (Bryon):
- **The entrance:** a mandatory room on floor 1 that can't be removed or moved. It's how people and goods get between the hole and the surface: functionally a staircase, but at the surface it looks like a large airlock.
- **Floors need stairs:** the shaft is open air, not a path. A floor's gallery is reachable only if stairs or elevators link it, floor by floor, back to the entrance. Floors that aren't linked get the "no access" warning.
- **The cargo elevator** unlocks later in the game. It reaches the surface and one other floor of your choosing. Every cell of its column on the floors in between must be unoccupied.
- **Demolishing** leaves empty space, not solid rock.
- **Two phases of construction:** excavating, then constructing (today's behaviour). Excavating costs nothing and yields rock (and ore, silica, ice) like the drill does. On empty space, excavation is skipped, and nothing is gained.
- **The drill digs the shaft only.** Digging a floor opens the shaft and the gallery and yields their rock. Every room slot stays solid rock until it's excavated.
- **Excavation jobs sit in the construction queue.** The drill stays separate.
- **An "empty room" build option** excavates ahead of time, so rooms can go in later.
- **Empty space** shows support pillars and no walls, and is public: walk-through, like a plaza.

## Defaults (chosen, not yet confirmed)

- **Cell state:** each cell is rock, empty (excavated, no room), or a room. Old saves: cells under rooms are excavated, and everything else is rock (their rock was already paid out by the old drill).
- **Excavation work:** 3 work-hours per slot, before the construction hours. A dorm (M, 2 slots) on rock is 6 + 12 hours.
- **Yield:** the drill's rock per slot, per excavated slot (2 rock, plus deposits). The drill itself yields the shaft's share: its area in slots, about 3 for a narrow hole.
- **The start:** the landing crew has blasted out rings 1 and 2 of floor 1, so the critical set can go straight in. The rest is rock.
- **The entrance:** S, ring 1, floor 1, slot 0, public, free. The battery bank from the landing kit moves to ring 2. At the surface, an airlock stands on the rim above it and takes the surface slots over it.
- **Old saves** keep an open shaft that links every floor, since their players built without stairs. New games need stairs.
- **The cargo elevator:** S, in any ring. It unlocks at 100 colonists in the hole. It stops at the surface and at its floor. The cells above (floor 1 down to the floor above its stop) must be rock or empty space, and become its shaft. It costs metal 40, machinery 8 and electronics 4, takes 40 hours plus a stretch per floor, and uses 3 power. A headframe stands on the rim above it.
- **Empty room:** three sizes (1, 2 and 4 slots, rotatable like other rooms). It costs nothing, and only its rock cells need excavating. Once the job is done it isn't a room at all: its cells are empty space.

## Shape of the change

- **Layout:** `open[floor][ring][slot]`, 1 where a cell is excavated. A room's cells become open when its excavation finishes. Demolishing a room leaves its cells open.
- **Construction jobs:** a room job carries `dig` (excavation work-hours, 0 on empty space) ahead of its `work`. The phase is "excavating" until `done ≥ dig`. The rock and deposits come in as the excavation proceeds, and the cells open when it ends.
- **Access:** each floor has its own gallery (`gallery:f`). Circle-0 vertices join their floor's gallery. The entrance joins the gallery of floor 1 to `surface`, and the cargo elevator joins its floor to `surface`. Stairs and elevators join what they touch on every floor they span, as now. Rooms, corridors and galleries count as reachable when they're linked to `surface`. Empty cells are walk-through, like one-cell plazas.
- **Views:** rock and empty space look different in all three views, and empty space has pillars. Rooms being excavated read "Excavating 40%". The entrance gets an airlock on the surface, and the cargo elevator a headframe. Hover says what excavating a rock cell takes and yields.

## Steps

1. **Excavation and empty space (sim).**
   - The `open` grid.
   - The drill yields only the shaft.
   - Demolishing leaves empty space, and empty cells are public.
   - Save v15.

   Tests. *See:* a demolished room leaves walkable empty space.
2. **Two-phase construction.**
   - Excavate, then construct, with the yield during excavation.
   - Excavation is skipped on empty space.
   - The empty-room build option.
   - Queue labels and the Inspector.

   *See:* a room on rock takes longer and brings rock in; the same room on empty space doesn't.
3. **The entrance and stairs.**
   - The entrance room and per-floor galleries.
   - Access from the surface.
   - The old-save open shaft.

   *See:* a floor without stairs is cut off until stairs reach it.
4. **The cargo elevator.** Unlocking, placement down a free column, and linking the surface to its floor. *See:* a deep floor reached straight from the surface.
5. **The look.**
   - Rock and empty space in the unrolled, plan and 3D views, with pillars.
   - The excavating phase.
   - The entrance airlock and the cargo headframe.
   - Hover text.

   *See:* it in the browser.
6. **Balance and tests.**
   - The scripted players build stairs and excavate.
   - Playthroughs checked and tuned.
   - README and notes.

## Notes as built
**Step 1, excavation and empty space:** `src/sim/excavation.ts`.
- **Cell state:** `layout.open` marks excavated cells. An excavated cell with no room is empty space (`emptyCells`).
- **The start:** rings 1 and 2 of floor 1 are dug out (`starterHole.openRings`), and every other cell starts as rock.
- **The drill** yields the shaft's area in slots (π R² over one slot's area, about 3.1 for a narrow hole) × the per-slot yields, and leaves the new floor's cells as rock.
- **Demolishing** leaves the room's cells excavated.
- **Access:** empty space is walk-through. Each empty cell joins its borders like a one-cell plaza.
- **For now,** placing a room digs its cells out at once. Step 2 moves this into the excavation phase.
- **Save v15:** only the cells under an old save's rooms are dug. The old drill already paid out their rock. `openShaft` is set for step 3.
- **Tests:** `tests/excavation.test.ts`. Corridor tests call `allRock` (tests/worlds.ts) so they stay about rock.
- **Known failing until step 6:** the scripted playthroughs (first month, network, people, tutorial). They starve for rock now that the drill yields only the shaft's share.

**Step 2, two-phase construction:** `src/sim/construction.ts`.
- **Jobs:** a room or stair-extension job on rock carries `dig` (3 work-hours per rock cell, `excavationHoursPerSlot` in `data/construction.json`) and `digCells`, ahead of its building hours.
- **Excavating:** while the job is in the dig phase, rock and deposits come in with the hours worked (`yieldRock`), and each cell opens as its hours are done. A blueprint on a floor still being dug digs every cell once its floor is ready.
- **On empty space** there's no dig part and no yield. The job goes straight to building.
- **Empty rooms:** `empty_room_s`, `empty_room_m` and `empty_room_l` (S, M, L; free) sit in a new Excavation group of the palette.
  - They're `excavationOnly`: when the job is done, the room is removed and its cells are empty space ("Empty room dug out.").
  - Placing one where everything is already dug is refused ("Already dug out").
- **Cancelling** partway (cancel, demolish or undo) leaves the cells dug so far open, and keeps their rock.
- **Sandbox (`instant`):** a room is dug and built on the spot, rock included. Blueprints are dug when their floor is.
- **Placement** reports `rock`, the cells still to dig, for the hover.
- **UI:** the queue shows each job's `phase`, and its label reads "Water tank (excavating)". The Inspector says "Excavating · 40%".
- **Tests:**
  - Dug cell by cell with rock coming in.
  - No dig on empty space.
  - An empty room leaves empty space, which the next room builds on straight away.
  - Cancelling keeps what's dug.
  - Stair tests updated for the rock their new floors bring up.
