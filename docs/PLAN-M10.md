# Milestone 10 plan: furnishing rooms in 3D

Goal: rooms in the 3D view look lived in. Each room type has a short list of items that belong there (bunks and lockers in a dorm, planters in a farm, a furnace in the smelter). A saved layout template for each room says where they go, so rooms read as deliberate: not crowded, and not a random scatter.

Decided Sep 28, 2026 (Bryon):
- **Items are code-built low-poly models.** Each is a small list of simple shapes (boxes, cylinders, spheres) with colours, in `data/furniture.json`, assembled at runtime like the surface props. There are no asset files, and the data carries over to Godot.
- **Templates are anchored to walls.** There's one template per room type and shape (for example `bunk_dorm:2x1`). Each item is pinned to a wall (back, front, left or right) or the centre, with offsets in metres. Items keep their size and stay against their wall as the room stretches from ring 1 to ring 6. What doesn't fit in a small room is left out, in the template's priority order.
- **A dev tool** places items into templates and saves them into the project files.

## Defaults (chosen, not yet confirmed)

- **Which rooms:** every room built inside the hole, except empty rooms and stairs and elevators (their shapes are the furniture). That's 31 room types. Surface buildings already have their props.
- **When:** only built rooms are furnished. Blueprints and rooms under construction stay bare, apart from their construction stripes.
- **The room's frame:**
  - **Walls:** a room is an annular sector. Its front wall faces the shaft (ring 1) or the inner ring, its back wall is the outer one, and left and right are its sides. Sides stand parallel to their borders, as the walls do.
  - **Placements:** each placement names its wall and gives `x` (along the wall from its middle, in metres), `y` (out from the wall to the item's back) and an optional extra turn. A centre placement's `y` runs out from the room's middle toward the back.
  - **Facing:** items face away from their wall, into the room.
- **Repeats:** a placement can repeat along its wall every so many metres, as many times as fit (up to a limit). That's how rows of bunks, planters, shelves and desks fill a wide room without a template per width.
- **Fitting:**
  - An item must lie inside the room's floor, with 0.15 m to spare from the walls.
  - It must keep a 0.5 m aisle clear of items already placed.
  - It must keep the doorway clear: ring-1 rooms have a door in the middle of the shaft face.
  - Items are placed in template order, skipping any that don't fit, until items cover 35% of the floor (the crowding cap).
- **Models:**
  - Parts use shared named colours ("metal", "dark", "panel", "plant", "glow" and so on), and "accent" is the room's category colour, so category colour survives into the furniture.
  - Screens and lights glow a little at night, like the windows.
  - Furniture isn't pickable, so clicks land on the room.
- **Performance:** each room's furniture is merged into one mesh per material and cached like room shapes, so it's rebuilt only when that room changes.
- **The dev tool:**
  - **Where:** a dev-only page (`?furnish` in the dev build), not part of the shipped game.
  - **Layout:** a top-down 2D editor of the room's shape on the left, a live 3D preview on the right, the room type, shape and ring to preview, and the room's item list.
  - **Editing:** click an item to add it, drag to move (it snaps to walls), rotate, set repeats, reorder priority, and delete.
  - **Saving:** a small Vite dev-server endpoint writes `data/layouts.json`.
  - **Previewing:** the preview can switch rings to show how the template fits rooms of every size.

## Steps

1. **The catalogue.**
   - Items and their models in `data/furniture.json`, and the list of items per room type.
   - `docs/FURNITURE.md` lists them.
   - Tests: every furnished room type has items, and every item's parts fit its footprint.
2. **Models.** Build items from their parts in 3D (`src/render3d/furniture3d.ts`), with shared materials and night glow.
3. **Layout and fitting.**
   - The template format.
   - The room frame (walls, sides, doorway).
   - Placing, repeating, and fitting with priority and the crowding cap, in `src/view/furnish.ts`, with no Three.js.
   - Tests: items stay inside and apart, the doorway stays clear, small rooms drop low-priority items, and repeats fill wide rooms.
4. **Furnished rooms in the game.** Built rooms on visible floors get their furniture, cached per room. It hides with floor cuts, and walls down doesn't touch it.
5. **The dev tool.** The editor and preview, saving through the dev server.
6. **Templates for every room.**
   - One per room type and shape, 39 in all (the eight L rooms have two shapes each).
   - Checked across rings 1–6 in the tool and in the game, and tuned for crowding.
   - README and notes.

## Notes as built
**Step 1, the catalogue:** `data/furniture.json`, `src/view/furniture.ts`, `docs/FURNITURE.md`.
- **Items:** 76, each a few parts (box, cylinder or sphere) with a centre, size, colour and optional rotation. "Glow" parts light up at night.
- **Colours:** 23 named colours: metals, panel, composite, plants, water, rust, hazard orange, screen glow, grow-light pink, fire, lamp and so on. "accent" is the room's category colour, so a dorm's bunks are housing blue and a clinic's trim is health pink.
- **Rooms:** 31 furnished room types, each listing 2–6 items that belong there. `isFurnished` leaves out surface buildings, empty rooms, and stairs and elevators.
- **Footprints** always cover their parts: a part's box is computed after its rotation, in the same Euler order as Three.js (`partBounds`).
- **Tests:**
  - Every furnished room has items, and every listed room and item is real.
  - Parts fit their footprint and stand on the floor.
  - Only defined colours are used.
  - Nothing is taller than a floor.

**Step 2, models:** `src/render3d/furniture3d.ts`.
- **Building:** each part is a unit box, cylinder (12 sides) or sphere (10 × 8), scaled, rotated and moved into place.
- **Merging:** `furnitureMeshes` merges every placed item's parts into one mesh per material, so a room's furniture is a handful of draw calls, and eight bunks cost what one does.
- **Materials** are shared by colour. Glowing parts share emissive materials that `setFurnitureGlow` brightens at night.
- **Tests:** every item builds, with one mesh per colour and within its footprint. Placing and a quarter turn (width and depth swap) work. A room's worth merges.
- **The dev tool starts here:** `?furnish` in the dev build (`src/devtools/`, loaded only in dev, so it isn't bundled into a release). For now it has a catalogue: pick a room type, or all items, and orbit its models on floor tiles. Checked in the browser: the dorm's items and all 76.

**Step 3, layout and fitting:** `src/view/furnish.ts` (no Three.js), `data/layouts.json`.
- **Templates:** keyed `type:WxD`, as a list of placements in priority order. A placement names an item, a wall (back, front, left, right or centre), `x` along the wall from its middle, `y` out from the wall, an optional `turn`, and an optional `repeat` (every so many metres, up to a limit, working out from `x` both ways).
- **The room's frame (`frameOf`):**
  - The floor's annular sector, pulled in from each wall by the walls' own hairline (or half a corridor where one runs along that side), plus a 0.15 m gap.
  - Its left and right walls stand parallel to their borders, as in 3D.
  - A ring-1 room that isn't public has a doorway in the middle of its shaft face, where the 3D view draws the door.
  - A cargo elevator is furnished at its stop.
- **Placing (`place`):** an item's back goes against its wall and its front faces into the room (a centre item faces the front).
  - Back and front items sit `x` metres round the wall at their own radius.
  - Left and right items sit `x` metres toward the back from the room's middle radius.
- **Fitting (`fit`):** placements are tried in order. An item must have every corner inside the walls, stay a 0.5 m aisle from the items already placed (a separating-axis test with the gap added), and keep out of the doorway (1.8 m wide, 1.6 m deep). Items stop once they cover 35% of the floor. A repeat stops each way at the first copy past the walls or the cap, skipping copies that are only blocked. Numbers are in `FIT`.
- **`furnish`** gives a built room's items. Blueprints, rooms under construction, and room types or shapes without a template get none.
- **Tests:**
  - Inside the walls and an aisle apart, in ring 1 and ring 2.
  - More repeats in the wider room.
  - Items face away from their wall.
  - The doorway is kept clear (and only ring-1 rooms have one).
  - What doesn't fit is skipped, and the crowding cap holds.
  - A corridor pulls a wall back.
  - Only built rooms with a template are furnished.

**Step 4, furnished rooms in the game:** `roomFurniture` in `src/render3d/rooms3d.ts`.
- **Which rooms:** every built room gets its template fitted and merged into meshes. Blueprints, rooms under construction, and rooms faded in X-ray get none.
- **Caching:** by the room's shape key, which already changes with its cells and the corridors along it. The cache is freed like shapes.
- **Floors:** furniture on a floor above the chosen one is hidden with it.
- **Glow:** glowing parts follow the windows at night (`setNightGlow` calls `setFurnitureGlow`).
- **Not solid:** furniture isn't pickable, so clicks land on the room's floor, and first-person walking goes through it for now.
- **Rugs:** items no taller than 10 cm lie on the floor. Others stand on them, and they don't count toward the crowding cap (tested).
- **A first template,** `bunk_dorm:2x1`: bunks along the back wall with footlockers in front, three lockers on each side, and a table with stools on a rug in the middle.
- **Browser check:** the dev save's dorm on floor 1 in Iso, furnished.

**Step 5, the dev tool:** `?furnish` in the dev build (`src/devtools/`), with a Templates tab and a Catalogue tab.
- **Picking what to edit:** a room type, one of its shapes, and the ring to preview (1–6), with an optional corridor along the left or right side to see how the fit changes.
- **Plan view:** the room from above: its floor, the ring-1 doorway (dashed), which side is the front (shaft side), back, left and right, and the fitted items with a tick marking each one's front. Drag an item to move its placement; a repeated item moves as a row. The drag goes through `unplace` (the inverse of `place`), snapped to 10 cm.
- **Sidebar:**
  - The room's items, to add.
  - The template's placements in priority order, each with how many copies fitted, or "doesn't fit".
  - The selected placement's wall, along (x), out (y), turn, snug, and repeat (every, at most), with Earlier, Later, Duplicate and Delete.
- **3D preview:** the room's shell as the game draws it, with its fitted furniture, looked at from the shaft side. Orbit it.
- **Save** posts every template to a dev-server endpoint (the `saveLayouts` plugin in `vite.config.ts`, serve only). It checks items and walls, and writes `data/layouts.json` with one placement per line. The game picks it up on reload.
- **Snug placements** (added here): chairs at a desk and stools at a table go with their neighbours. They only keep 5 cm from them, not the 0.5 m aisle.
- **Browser check:** the dorm template in ring 1, with a table dragged across the plan and saved to the file (then put back).

**Step 6, templates for every room:** `data/layouts.json`.
- **39 templates,** one per furnished room type and shape (the eight L rooms have one for 4×1 and one for 2×2). One-off items come first, so repeated rows (bunks, planters, shelves, racks, desks, stalls) fill in around them.
- **Fit across rings 1–6:** every template places 3 or more items in every ring its room can go in, and covers about 5–25% of the floor, so rooms read as furnished but uncrowded.
  - A few one-offs on the front wall step aside for ring 1's doorway, and appear in the other rings.
  - Plazas stay open (a tree, benches, lamps). Farms and depots are the fullest.
- **Placing fixes:**
  - Side-wall items stand exactly against the straight wall.
  - Back-wall items are set in until a straight item's corners touch the curved wall. Before this, flat items against a wall (tool walls, the board, the crypt's niches) never fit.
  - A turned item stands out from its wall by what it reaches once turned: a clinic bed turned head-to-wall.
- **Room lists:** elder care and the tiny plaza gained the items their templates use (a rug, potted plants).
- **Tests:**
  - Every furnished room type and shape has a template, using only its room's items.
  - Every template furnishes its room in every ring it can go in, and every placement fits in at least one ring.
  - The turned bed.
- **Browser check:** the dev save's floor 1 in Iso with walls down: the storage tank, admin desks with chairs and screens, dorm bunks, and restroom stalls, with farm planters on the floor below.
- **README:** furnishing, and the tool.
