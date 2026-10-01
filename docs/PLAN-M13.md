# Milestone 13 plan: doors everywhere, windows as an upgrade

Goal: every room that touches something walkable has a way in, and windows become something the player chooses to put in.

Asked for by Bryon, Sep 30, 2026: rooms beside a corridor sometimes had no door (a life support with a corridor along it, no way in); windows should be an upgrade, off by default, placed with an "Add windows" tool on walls that face a corridor, the shaft or a walk-through room, and they raise the room's comfort.

## Defaults (to confirm or change)

- **Doors:** one per floor of a room, on the best wall it has: along a gallery tube first (the middle of the run, as before), else the longest stretch of built corridor along any wall, else a walk-through room (a plaza, stairs) beside it. A wall needs room for the door and its frame (1.9 m). Public rooms are open and have none.
- **Windows:** a room keeps a list of glazed borders. The **Add windows** tool glazes a whole wall at a click (Shift-click takes it out), only where a corridor, the shaft (a tube, or under the dome) or a walk-through room is across it. Cost: metal by length (glass comes too late to be the price).
- **Comfort from windows:** the best view a room has, plus a little for each extra glazed wall, capped. Shaft 1.5 (1 behind a tube), a plaza or stairs 0.75, a corridor 0.25. This replaces the automatic shaft view.
- **Old saves:** rooms keep the shaft windows they had.
- **Bots:** glaze their homes.

## Steps

1. **Doors on any wall.** One opening model (`view/doors.ts`) for 3D walls, walking, furnishing and the 2D views.
2. **Windows as an upgrade.** Sim (room windows, command, comfort, save migration), the tool, views, bots, docs.

## Notes as built

**Step 1, doors on any wall:**
- `doorways(layout, room)` (`view/doors.ts`) picks one door a floor as above; each `Doorway` names its border, its cell and which wall of the cell (`inner`, `outer`, `left`, `right`). `acrossEdge` says what's across a border (shaft, corridor, public, or nothing); windows will use it too.
- 3D: `openingsOf(layout, room)` gives a room's doors and window spans; `roomGeometry` cuts both through whichever walls they're in (curved faces and side walls) and builds their glass and door frames, cached with the room's shape. Windows still follow the old rule (ring 1's shaft face) until step 2.
- Walking: `inDoorway` handles side walls, so you can walk in from a corridor along any wall.
- Furnishing: a frame keeps every doorway on its floor clear (`Frame.doors`, footprints), not just the front one. Fixed on the way: a gallery tube no longer pulls a ring-1 room's furniture back half a corridor (the tube is in the shaft, outside the wall).
- 2D and plan: door marks only where a room's door actually is, not wherever a corridor touches it.
