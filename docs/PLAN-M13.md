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
