# Milestone 13 plan: doors everywhere, windows as an upgrade

Goal: every room that touches something walkable has a way in, and windows become something the player chooses to put in.

Asked for by Bryon, Sep 30, 2026: rooms beside a corridor sometimes had no door (a life support with a corridor along it, no way in); windows should be an upgrade, off by default, placed with an "Add windows" tool on walls that face a corridor, the shaft or a walk-through room, and they raise the room's comfort.

## Defaults (to confirm or change)

- **Doors:** one per floor of a room, on the best wall it has: along a gallery tube first (the middle of the run, as before), else the longest stretch of built corridor along any wall, else a walk-through room (a plaza, stairs) beside it. A wall needs room for the door and its frame (1.9 m). Public rooms are open and have none.
- **Windows:** a room keeps a list of glazed borders. The **Add windows** tool glazes a whole wall at a click (Shift-click takes it out), only where a corridor, the shaft (tube or not) or a walk-through room is across it. Cost: metal by length (glass comes too late to be the price).
- **Comfort from windows:** the best view a room has, plus a little for each extra glazed wall, capped. Shaft 1.5 (1 behind a tube), a plaza or stairs 0.75, a corridor 0.25. This replaces the automatic shaft view.
- **Old saves:** rooms keep the shaft windows they had.
- **Bots:** glaze their homes.

## Steps

1. **Doors on any wall.** One opening model (`view/doors.ts`) for 3D walls, walking, furnishing and the 2D views.
2. **Windows as an upgrade.** Sim (room windows, command, comfort, save migration), the tool, views, bots, docs.

## Notes as built

**Step 1, doors on any wall:**
- `doorways(layout, room)` (`view/doors.ts`) picks one door a floor as above; each `Doorway` names its border, its cell and which wall of the cell (`inner`, `outer`, `left`, `right`). `acrossEdge` says what a door could open onto across a border (a tube, corridor or walk-through room; built on `viewAcross` in `sim/windows.ts` since step 2).
- 3D: `openingsOf(layout, room)` gives a room's doors and window spans; `roomGeometry` cuts both through whichever walls they're in (curved faces and side walls) and builds their glass and door frames, cached with the room's shape. Windows still follow the old rule (ring 1's shaft face) until step 2.
- Walking: `inDoorway` handles side walls, so you can walk in from a corridor along any wall.
- Furnishing: a frame keeps every doorway on its floor clear (`Frame.doors`, footprints), not just the front one. Fixed on the way: a gallery tube no longer pulls a ring-1 room's furniture back half a corridor (the tube is in the shaft, outside the wall).
- 2D and plan: door marks only where a room's door actually is, not wherever a corridor touches it.

**Step 2, windows as an upgrade:**
- `room.windows` (border ids); `sim/windows.ts`: `viewAcross` (shaft, corridor, walk-through room), `wallOf` (a room's borders along the same line on a floor, with something across), `windowCost`, `windowRefusal`, `glazedWalls` (the ones that still see something: filling a corridor in leaves its windows blind, and they come back with it), `windowComfort`. Walk-through rooms and plans can't have windows.
- `setWindows { roomId, edges, on }`: putting them in charges `windows.costPer10m` for the borders not glazed yet (a part-started 10 m counts whole); taking them out is free. **Changed from the plan:** 5 rock per 10 m, not metal. With any metal price the playtest bots, short of metal early, left their homes unglazed for days and births fell by a third to a half over four seeds; rock tracks the old numbers (fused regolith panes).
- **Comfort** (`config.windows`, homes only, replacing the automatic shaft view): each glazed wall's view averaged along its length (open shaft 1.5, through a tube 1, a walk-through room 0.75, a corridor 0.25); the best wall counts, +0.25 for each other one, up to 2; the dome's atrium +0.5 on top for a room glazed onto the shaft. Averaging (not the best stretch) keeps a part-tubed shaft face where it was.
- **Save v17:** old saves keep their shaft windows: every private ring-1 room gets its shaft borders glazed.
- **Tool:** the corridor tool's **Windows** button (a pane chip). Hovering a border picks the room on the pointer's side (or the private one across it) and lights up its whole wall: green with the cost and the home's resulting comfort in the status line, red with the reason. Click glazes it; Shift-click (or Erase) clears it. No dragging.
- **Views:** 3D cuts window bands (a wall of glass onto the open shaft) into whichever walls are glazed, side walls included, with glass; furniture doesn't hang on glazed walls. 2D and plan draw panes along the room's side of each glazed border, around its door. The room card and inspector say what the windows look out on and the comfort they give (and how to add them).
- **Bots:** `tendWindows` glazes each home's best wall once a day. The people playthrough's thresholds came down (births 15 → 10, day-80 population 150 → 130): its seed runs a little lower, other seeds don't.

**Step 3, windows cost glass (Bryon, Oct 1):**
- `windows.costPer10m` is glass 2 (a ring-1 bunk dorm's shaft wall: 4 glass).
- The landing kit brings 100 glass (`startingStock`); the landing pod's storage grows from 500 to 600 units, 100 of them allocated to glass.
- The glassworks needs no unlock any more (the "glassworks" gate is gone) and is easier: 2 staff (was 3), power 3 (was 4), glass 3 a day (was 2), built from rock 20 and metal 4 (was brick 10, metal 5, machinery 1).
- Bots build a glassworks when glass drops under 20 with homes still unglazed. Save v18: old saves get the kit's 100 glass (topped up to it) and the pod 100 units allocated to glass (a legacy pod with its own space grows by that much).

**Afterwards, the drill (Bryon, Oct 1):**
- **A boring machine in 3D** (`makeDrillRig`, now `render3d/drillRig.ts`): a steel cutterhead the width of the shaft with disc cutters and spokes, a safety-orange drum body, four gripper pads on rams, a deck with a cab, rail, mast and lamps, and a hoist cable up the middle of the shaft to the rim. Its origin is the cutter face, at the dig front (where the orange ring already was), so it lowers as the drill works; with the drill at its last floor it rests on the bottom. The cutterhead turns and the lamps blink while it's boring and the game runs; paused, it sits still. The grippers brace on the fresh bore once there's room below the deepest floor, and fold in clear of its gallery ledge until then. About 6.5 m tall, so it stays below ground while floor 2 is dug. Hidden with the floors above a picked floor.
- **More detail (Oct 1):** the cutterhead gained gauge cutters round its rim, six toothed muck buckets, flanged spokes with hose runs, a bolted hub and a pilot bit; a main bearing ringed with eight drive motors; the drum has bolted panel seams and ribs, a hazard-striped band (canvas texture), vents, a hatch with a wheel, a number plate, a ladder to the deck and hose bundles; gripper arms on rams with chrome rods and ribbed pads; a muck conveyor up the side with rock lumps riding it into a skip of spoil hung from a lattice mast's boom and sheave; a gratinged deck with posts, rails and toe ring; a cab with windows on three sides, door, roof unit, spinning beacon and aerial; a power pack with radiator and exhaust stacks; oil and coolant tanks on saddles; a cable reel paying out a power line up the shaft beside the hoist cable; gas bottles, crates, a toolbox, and floodlights. Materials are double-sided so the cutaway shows the far half. While boring the head and beacon turn, the belt runs and the reel pays out.
- **Slower below floor 3:** `digging.slowFromFloor` 4, `slowFactor` 2: floors 2 and 3 take 3 and 3.6 days as before, floor 4 about 8.6 days (was 4.3), and each deeper one 20% more again.
- The network playthrough founds its second hole a little later (day 50.3), so its checks moved: founded before minute 55 (was 50), the child at 15 people or more (was 20), and the child's route home set up (its first load may still be loading).

**Afterwards (Oct 1): the rig lower, ring 1 only, and gaps filled:**
- **The rig half a floor lower** (`RIG_DROP` = FLOOR_H / 2, `render3d/cylinder.ts`): the rig and the glowing front are drawn that far below the sim's dig front, so the cutterhead and grippers clear the deepest floor's gallery tubes; the last floor's shaft wall reaches that much lower to frame it. View only: the sim's progress and pace are unchanged, and the model's size is too.
- **New holes start with ring 1 dug** (`starterHole.openRings` 1, was 2). The landing kit's rooms get their own cells dug (the battery bank in ring 2), reached through ring 1's empty space.
- **No more see-through cracks:** empty space's floor runs to its cells' edges (it was inset 6 cm all round, leaving a crack between two empty cells and along the gallery tube). A gallery tube's slab has a back edge at the shaft wall, and where an empty cell or a walk-through room opens onto the tube, a strip of rock closes the 0.3 m between the tube's roof and the ceiling.
