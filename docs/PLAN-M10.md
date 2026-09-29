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

**Follow-up, stairs and elevators (Bryon, Sep 28):** "template the rest of the rooms". The rooms left bare were stairwells and elevators. Empty rooms become plain empty space once dug, so there's nothing to template; surface buildings keep their hand-built props.
- **Floor by floor:** they're furnished on every built floor they span (`furnishedFloors`).
  - A floor looks for its role's own template first: `type:WxD:top` for the shallowest floor, `:bottom` for the deepest, `:middle` for any between. Otherwise it uses the plain one (`templateFor`).
  - `frameOf` takes the floor to fit on.
  - In 3D, a picked floor hides the stack's furniture on the floors above it, item by item.
- **New models:**
  - A 16-step stair flight climbing 4 m along its wall, with treads in the access colour and a handrail.
  - The top floor's landing: the opening the flight below comes up through, with a guard rail and a hazard edge.
  - An elevator shaft frame with guide rails, and the same with the car waiting, doors shut and lit.
  - A call panel.
- **Templates (4):** the stairwell's flight on every floor but the top, whose landing sits in the same spot. The elevator's shaft and call panel on every floor, with the car on the bottom floor. Each has a bench and a potted plant.
- **Dev tool:** for stairwells and elevators, Floor buttons (any, top, bottom) pick which template to edit and preview that floor. "Copy from any floor" starts a role's own template. The sample hole is now three floors deep, and its corridors run along every floor the room spans. The save endpoint accepts role keys.
- **Tests:** templates are checked on the floors that use them; the coverage test now fails properly on a missing template.
- **Browser check:** the stairwell's flight and the elevator's bottom floor in the tool.

**Second pass, furniture (Bryon, Sep 28):** "a second refinement pass at all the furniture": the pieces, their models, and the layouts.
- **Models from a script:** `scripts/furniture.mjs` builds every model from small helpers (legs, tables, chairs, monitors, foliage) and writes `data/furniture.json` (`node scripts/furniture.mjs`). Footprints are measured from the turned parts, rounded up to 5 cm. Edit the script, not the JSON.
- **Items:** 108, up from 81.
  - Most existing models were redone with more detail: legs and frames, screens, trim, lit panels.
  - New pieces: privacy partitions, floor lamps, TV units, coat racks, laundry machines, a serving counter, water dispensers and coolers, hydroponic racks, seedling benches, duct risers, a welding station, a 3D printer, a crystal puller, component cabinets, a conveyor, pallet jacks, barrels, scaffolding, a decontamination arch, a reception desk, cubbies, a body scanner, vending machines, bins, kiosks and candle stands.
  - The stair flight is now open, with stringers.
  - Two new colours: rubber and cream.
- **Room lists:** every room now has 3–12 items that belong there.
- **Layouts:** all 43 templates were rewritten in zones rather than as rows against walls.
  - Dorm bunks sit head to the wall between partitions, with footlockers, and have a lounge corner.
  - The admin office has reception by the door and desks with chairs facing the room.
  - The clinic has screened beds with monitors, a staff desk and a visitor chair.
  - The galley has a cooking line, a serving counter and dining tables.
  - The farm has planter rows between hydroponic racks and a seedling bench.
  - The school's desks face the board.
  - Elder care has beds along the back, a lounge, and a dining table on the other side of the door.
  - Plazas have benches around their centrepiece.
  - Coverage is about 5–28%.
  - A few front-corner extras step aside for ring 1's narrow front and doorway.
- **Rows can stand closer:** copies in one repeated row (planters, racks, tables) keep `FIT.row` (0.3 m) from each other rather than the 0.5 m aisle. On a curved wall, neighbouring copies lean together at their inner corners, and the aisle was dropping every other one.
- **Fixes:**
  - Furniture stood 6 cm below the room's floor (hiding rugs). It now sits on it (`frameOf`'s `y`).
  - Walls down now turns wall normals by the model matrix, so a turned room (the Overview's) lowers the right walls.
- **Dev tool, Overview:** a tab with every template fitted in the chosen ring, side by side, with walls down. Pick one to zoom in on it.
- **Tests:** the aisle test allows `FIT.row` within a row. The turn test allows footprints that aren't symmetric.
- **Browser check:** the Overview in rings 1–3: dorm, admin, clinic, galley, school, farm, life support, smelter, plaza, entrance and elder care.

**Follow-up, walking among the furniture (Bryon, Sep 28):** "make first person walking collide with furniture", walk through doors, and see through windows.
- **Doors** (`src/view/doors.ts`): a private room has a doorway on each floor that faces the shaft, in the middle of that floor's ring-1 cells. The 3D view, furnishing (keeping the doorway clear) and walking all use it. Before this, a two-floor room drew one door, while furnishing kept a doorway clear on each floor.
- **Openings:** a private ring-1 room's shaft face now has its window band and doorway cut through the wall (`roomGeometry`'s `doors`, `curvedFaceWithOpenings`). The doorway runs from the floor up past the gallery's ledge to 2.7 m, with a dark frame. The glass is see-through (22% opaque), and stops at the door's frame. The wall's tags keep its full height, so walls down lowers it as one.
- **Walking in regions** (`regionAt`):
  - Open ground: the gallery, corridors, public rooms and empty space.
  - Each private room's floor is its own region.
  - A doorway belongs to both the room and the open ground: it's the door's width less a walker's radius, and 0.6 m either side of the wall.
  - A walker's centre and edges must all be in one region, or joined through a doorway. A step never goes straight from one region into another. So the only way into a room is through its door, and rooms sharing a wall stay apart. Rooms under construction stay shut.
- **Furniture is solid:** every standing item's footprint on the floor blocks, with 0.2 m of clearance (less than the walls' 0.3 m, so the 0.5 m aisles a room is furnished with can be walked). Rugs are walked over. Footprints are worked out once per layout snapshot and floor.
- **Tests:**
  - Through the door into a galley, while beside the door the wall stops you; under construction, it's shut.
  - Standing furniture blocks.
  - The doorway and window band are cut through the wall, with the wall kept below the window and above the door.
- **Browser check:** a new game's bunk dorm in first person.
  - From the gallery, the dorm shows through its glass, with the doorway framed.
  - You walk through the door and on between the bunk partitions until a bunk stops you.
  - Turning round, you look out across the shaft.
- **Dev:** `window.__stage3d.walker` (dev builds only) holds the first-person position and heading, for putting a walker somewhere.

**Follow-up, a cozy look (Bryon, Sep 28):** "let's go cozy", with a settings screen to scale the effects for laptops, defaulting to higher-end.
- **Post-processing** (`src/render3d/look.ts`) uses Three's bundled passes, with nothing new installed. The scene renders once into an antialiased target (4× MSAA) whose depth is kept; then:
  - **Soft shadows (ambient occlusion)** are worked out from that depth, so walls lowered by walls down cast none. GTAOPass given outside depth still makes and reads its own normals target, so a small subclass keeps that at one pixel.
  - **Haze** is warm dust that thickens below the floor in view. In Iso it swallows the floors under the one you're looking at. From inside the hole (first person, the shaft, free look), far-off things fade too, past 15 m. The sky stays clear.
  - **Glow** (bloom) is limited to things brighter than full white: windows at night, lamps, screens and furnaces.
  - **Miniature blur** is a tilt-shift in Iso only.
  - Then tone mapping, and a **warm grade**: plum shadows, apricot highlights, a little more colour, a soft S-curve and a vignette.
  - With every effect off, the scene renders straight to the screen as before.
- **Reflections:** a soft studio environment, made once, for metal, glass and screens.
- **Graphics settings** (`src/view/graphics.ts`) have a sharpness (pixel ratio 1, 1.5 or 2), colonists and dust, reflections, and an amount from off to full for each effect.
  - Presets: Low (no effects, 1×), Medium (glow, haze and colour at 1.5×) and High (everything at 2×, the default).
  - Changing one effect makes it Custom.
  - They replace the old "3D detail" choice, and a saved Low carries over as the Low preset.
  - Stored settings are cleaned on load (clamped, with anything missing filled in).
- **Settings screen:** a 3D graphics section with the preset, sharpness, a slider per effect, and checkboxes.
- **Labels** no longer write depth, so they don't shade what's around them.
- **Dev:** `window.__stage3d.setGraphics({...})` tries settings without saving them, and `.look` exposes the passes.
- **Tests:** presets and Custom, which settings need post-processing, cleaning stored settings, and carrying over the old setting.
- **Browser check:** Iso and first person with each effect on and off, the raw occlusion buffer, and the settings screen switching presets (the view follows, and a slider makes it Custom).
- **Build:** Three's chunk is now just over Vite's 600 kB warning (614 kB).

**Follow-up, procedural rock (Bryon, Sep 28):** "a procedural rock shader, since rock is the biggest surface on screen".
- **`src/render3d/surfaces.ts`:** patterns worked out in the shader from world position (value noise, 3 octaves). There are no image files or UVs, and they read the same on walls, ceilings and floors. Each adds to a material's existing shader hook, and walls down now does the same, so the two combine.
- **Rock:** sediment bands about 1.4 m thick, gently warped so they wander round the hole, each with its own shade and a thin darker seam. Over that go mottling across metres, fine grain, and darker flecks. The contrast is soft for the cozy look. It's on the shaft wall, rock faces, the rock seen from above, rock-finish corridors, the shaft bottom and the cutaway's outer wall.
- **Regolith** for the ground around the hole: mottling, grain and pebbles, without layers. Rock's bands looked like camouflage on a flat plane.

**Follow-up, sparks and steam (Bryon, Sep 28):** "small effects like smelter sparks and life-support steam".
- **`src/render3d/effects3d.ts`:** effects come from the furniture itself: sparks from each furnace's glowing mouth, and steam from each scrubber's vent pipe.
  - Only rooms that are running (their rate in the snapshot) emit, and a slowed room emits fewer.
  - Emitters on floors above the chosen one stay quiet.
  - Sparks fly out of the furnace front and fall under gravity, burning out. Steam rises, swells and thins away.
  - Each kind is one set of points from a fixed pool (500 sparks, 300 puffs), animated on the CPU, with soft round sprites whose size is in metres. Sparks blend additively, so the glow picks them up.
- They animate only while the game runs, like the walkers, and follow the "Colonists and dust" graphics setting.
- **Dust** is now soft and round, not square.
- **Furniture glow at night** is toned down (the night boost went from 1.6 to 0.9) so glowing parts don't blow out under bloom.
- **Fix:** the room inspector crashed the whole app on a room slowed by low morale. It read the reason as a resource. Morale now has its own text, and any unknown reason shows as given.
- **Console:** `dm.unlock("ore")` puts a deposit under the hole, and `dm.command({...})` sends any command, to set up rooms like a smelter for testing. Dev builds also have `__stage3d.walkTo(x, z, yaw)` and `.roomFx`.

**Follow-up, apartments (Bryon, Sep 28):** "a few apartments of different sizes... more costly to build and store fewer people per segment, but have improvements to comfort".
- **Six homes** (`data/rooms.json`): the S and M sizes of the three apartment tiers in ROOMS.md (Housing). Residents, cost per slot, power per two slots, and base comfort follow its tables, with +1 for residents of a cozy S room. The standard M is named **Family apartment** here, since ROOMS.md calls both M apartments "Apartment" (ROOMS.md is read-only, so its table still says "Apartment").

  | Room | Tier | Size | Residents | Power | Cost | Residents' comfort | Neighbours |
  | --- | --- | --- | --- | --- | --- | --- | --- |
  | Studio | basic | S | 5 | 0.5 | rock 8, brick 5 | +1 | — |
  | Apartment | basic | M | 10 | 1 | rock 16, brick 10 | 0 | — |
  | Flat | standard | S | 4 | 1 | brick 8, metal 3 | +2 | comfort +1 r1 |
  | Family apartment | standard | M | 8 | 2 | brick 16, metal 6 | +1 | comfort +1 r1 |
  | Suite | luxury | S | 2 | 1.5 | metal 5, electronics 3 | +3 | comfort +1 r1 |
  | Residence | luxury | M | 4 | 3 | metal 10, electronics 6; staff 1 | +2 | comfort +1 r1 |

  For comparison, a bunk dorm is M, houses 16, costs rock 20 and gives its residents −1. The luxury tier's catalog staffing ("1 per 4 slots") comes to one attendant for the M residence and none for the S suite.
- **Unlocks by population** (`config.unlocks.homes`), per ROOMS.md: basic at 50 colonists, standard at 200, luxury at 1,000. Each posts a message when reached. `dm.unlock()` opens them for testing.
- **2D glyphs:** a house, with a door for basic homes, windows for standard, and a star for luxury.
- **Furniture:** nine new models: double bed, wardrobe, dresser (with a mirror), coffee table, kitchenette (sink, hob, wall cupboards, a light under them), a bathroom (a small panelled room with a door and a light), bathtub, fireplace and piano. There's also a new colour, wood.
- **Templates:**
  - Every home puts its beds head to the back wall with side tables, screens between them, a kitchenette and a bathroom on the side walls, and a table or lounge in the middle.
  - Studios and apartments are rows of single beds with a shared table (and a sofa and screen in the M).
  - Flats and family apartments have double bedrooms, a table for two or a dining table, and a sofa, coffee table and screen (the family's also has children's beds and a desk).
  - Suites and residences add a dresser, a bathtub by the bathroom, and a lounge round a fireplace with armchairs; the residence also has a piano, a second bathroom and a desk.
  - Every home fits its essentials in every ring. A few extras (a side table, a second bathroom) step aside in ring 1, where the front is narrow and the M rooms' door sits off-centre.
- **Beds now face the right way:** every bed model has its head at −x, and templates had them turned 90°, which put the head away from the wall. All beds (bunks, elder care, clinic, homes) are now turned −90°, head to the wall.
- **Tests:** each tier houses fewer per slot, and gives its residents more comfort, than the one below; an S home is cozier than its tier's M; studios wait for 50 colonists and then build, while suites still wait.

**Follow-up, wall hangings (Bryon, Sep 28):** "'wall hangings' furniture for all rooms... items attached to a wall should be completely hidden when on a wall that has been removed via 'walls down'".
- **Sixteen hangings,** each modelled from its bottom edge with a `mount` height: painting, wide painting, poster, wall lamp (lit), wall shelf with ornaments, mirror, clock, chart board, readout panel (lit screens), gauges, a map of Mars (the colony's holes lit), notice board, safety sign, hanging planter, banner and plaque. The model script checks each fits under the ceiling.
- **Every room hangs something:**
  - Pictures, lamps, mirrors, shelves and clocks at home.
  - Charts, readouts, gauges and safety signs at work.
  - Maps and notice boards in offices and the entrance.
  - Plaques in the crypt, banners and planters in plazas.
  - Posters and lamps on the stairs.
- **Fitting** (`hang` in `fit`):
  - A hanging goes only on a solid wall (`frame.solid`): never ring 1's glass front, nor a public room's open sides (onto the gallery or a corridor).
  - It keeps out of the doorway, keeps 0.25 m from other hangings, and is blocked by anything standing taller than it hangs. So a painting goes over a bed or a sofa, and a lamp over a side table, but nothing hangs behind a wardrobe.
  - It's checked where standing things go, then hung flat on the wall itself (the fitting gap further out, and 1 cm off it).
  - Hangings take no floor, so they don't count toward crowding. Standing items ignore them, and templates list them last so they fit around what stands.
- **Every fitted item knows its wall and floor** (`Fitted.wall`, `.floor`, and `Frame.floor`). Filtering by floor used to work from an item's height, which a hanging would have got wrong.
- **Walls down:** `furnitureGroup` builds a room's standing furniture as before, and its hangings as separate meshes.
  - Each hanging is tagged like its wall (`aWall`): the wall's inward normal, at twice its length when there's something to see across it (the gallery, another room, empty space, or a corridor alongside, found by probing just past the wall). It also carries the point on the wall behind it (`aHang`).
  - `withHangingDown` makes the same in-the-way test as the walls, at that point. When the wall is lowered, the whole item collapses to the point, so nothing of it shows (a wall's stub would otherwise leave a sliver).
  - The furnishing tool's preview and Overview use the same builder.
- **Walking:** hangings are over your head, so they aren't obstacles.
- **Templates:** 1 to 20 hangings per room depending on the ring. Every hanging fits in at least one ring its room can go in; a search tried each one that didn't along all four walls, and moved it to where it fits in the most rings.
- **Tests:**
  - Every room has something to hang, and all of it fits under the ceiling.
  - A painting hangs over a bed but not behind a wardrobe, at its height, flat on the wall.
  - Nothing hangs on ring 1's glass front or on a plaza's open front.
  - A hanging's tag points into the room.
  - Walking obstacles leave hangings out.
- **Browser check:**
  - The Overview's residence: wide paintings over the double beds, lamps over the side tables, a mirror over the dresser. The side and front walls' hangings are gone with those walls.
  - In the game, a residence and a suite in ring 1: paintings show through the windows, and with walls down every wall of both lowers (open space behind), taking its hangings with it.

**Follow-up, the dock (Bryon, Sep 29):** "a system like sim city, where there are a handful of 'mode' buttons in the bottom right, and selecting one of these modes displays a relevant menu of options in a strip of buttons along the bottom".
- **`src/ui/Dock.tsx`:** four mode buttons at the bottom right (Build, View, Map, Charts), and the open mode's strip along the bottom of the view. Choosing the open mode again closes it, so no mode is open at all. The floor picker stays on the right, and hides under the map.
- **Build** (`BuildStrip`, which replaces the left sidebar):
  - A button per category, and one popup at a time above its category with that category's rooms (Access adds Corridors).
  - Above the rooms, the details of the room under the pointer or in hand (with Rotate), or the corridor finishes while drawing corridors.
  - Categories in the right half of the screen open leftward, so they stay on screen.
  - Demolish, Undo and a key hint sit at the end.
  - Only Build places anything: leaving it puts the tool down. A room's key, C or X opens Build and its category from any mode.
  - Build is off while walking in first person.
- **View** (`ViewStrip`), in sections:
  - The six 3D cameras (choosing one also switches to 3D).
  - Plan and Unrolled.
  - X-ray and Walls down (greyed out outside 3D).
  - The overlays, with their legend. The overlays weren't in the brief; they moved here from their own floating bar, since they're a way of looking.
- **Map** opens the planet at once; closing it closes the mode, and so does M.
- **Charts** (`ChartsStrip`):
  - People, Flows, Network and Construction, each toggling its panel on the right. Network is greyed out with one hole.
  - Leaving Charts closes its panel. The Office stays in the top bar: it's news that comes to you, not a chart.
  - The mode button carries a badge with the construction jobs waiting.
- **Top bar:** now just the menu, the hole, time, speed, the drill, the next drop and the Office. The view switch, Map, Construction, People, Flows and Network moved to the dock.
- **The 3D camera moved out of the stage:** the camera, X-ray and walls down are now player settings (`settings.view3d`, carrying over what the stage used to keep), applied through `Stage.setView3d`. The stage's own button bar is gone, leaving a quiet readout of where you are (and, walking, the keys). The camera list is in `src/view/cameras.ts`.
- **Esc** steps back one thing at a time: the tool in hand, then a panel or selection, then the open mode, then the menu.
- **Tutorial:** its highlights pulse the mode that holds them (then the category, then the button). The hints now point to the modes.
- **Browser check:**
  - Build: Storage's popup, with the warehouse's card on hover. Air, in the right half, opens leftward. G from View mode opens Build at Food.
  - View: walls down and the noise overlay from the strip. First person turns Build off. Plan greys out X-ray and walls down.
  - Charts: Flows opens its panel. Map covers the view with the dock on top, and closes Flows.
  - Esc steps back through tool, mode and menu.

**Follow-up, a batch of polish (Bryon, Sep 29):**
- **Plan view zoom:**
  - Scrolling and pinching zoom around the pointer (dragging still pans).
  - The plan opens fitted to the unlocked rings, with a little margin: three rings fill the screen, six sit further out.
  - The 3D Top camera fits the same way (`fitTop`), until the player zooms, and again for a new hole or more rings.
- **Bare rock under the pointer** lights up only in Build mode (`highlightsSlot`, via `Stage.setBuildMode`). Rooms and dug-out space always do.
- **Room colours** (View; 3D only, on by default): off, built rooms show what they're built from instead of their category's colour (`roomFinish`: the building material their cost uses most; nothing means carved rock).
  - Rock uses the rock shader.
  - Brick is running bond on walls and tiles on floors.
  - Metal is riveted panels on walls and diamond plate on floors.
  - Marscrete is speckled, with form lines on walls and joints across floors.
  - The patterns now get the surface's normal (`surfaceUv` lays them along curved or radial walls and flat on floors). Plans and rooms under construction keep their colours.
- **A 3 m crust** (`geometry.surfaceDepthM`): floors start that far below the surface.
  - A rock collar rings the shaft up to the ground, and floor 1's rooms and dug-out space get a rock ceiling. Their walls and pillars no longer stop short of the ground.
  - Picking treats the crust as rock, and `floorAtY` gives a height's floor.
  - The 2D unrolled view is unchanged.
- **The land** (`src/render3d/terrain3d.ts`): the ground is a polar grid out to 1.7 km.
  - It's flat for 45 m round the rim (where surface buildings stand), then eases into rolling ground and sharpened ridges, rising a little toward the horizon.
  - About 14 craters with bowls and rims, and 320 boulders.
  - On a faceted ridge ring 1.5 km out, the horizon is jagged **mountains**, one to three flat-topped **mesas**, or low **hills**, chosen by the site (its rounded map position, or its name before it has one). The same site always gets the same land.
  - The camera's far plane moved out to 3.5 km. Iso still cuts at a floor, so it doesn't show the surface; the other cameras do.
  - **Cutaway** now fills its cut face with rock following the ground's profile, leaving the hole's own section open. Below the sliced-away land there used to be sky.
- **The map is a globe** (`src/ui/Globe.tsx`):
  - The flat map (relief, deposits, names, routes, convoys, holes and the picked site) is drawn into a 2048×1024 canvas that wraps a lit sphere with a thin glowing rim.
  - It opens facing your hole (or the picked site).
  - Dragging spins it, north stays up, and the tilt stops short of the poles.
  - Let go and it coasts, slowing to a stop. The fling's speed is measured over the drag's last 100 ms and capped, so one jerk can't send it whirling.
  - Scrolling zooms. Pointing and clicking read the latitude and longitude under the pointer from the sphere, so hover info and site picking work as before.
- **Tests:** terrain (a flat pad, rolling ground beyond, the same land for the same site, and all three horizons among sites); the crust (floors, picking the crust as rock); rock only highlighting in Build; room finishes.
- **Browser check:**
  - The plan fitted to three rings, and zooming with the wheel. Top fitted.
  - Room colours off: brick tiles in a flat, metal panels on the battery bank.
  - The shaft's rock collar from above.
  - Cutaway showing boulders and mesas, with the cut filled with rock.
  - The globe: facing Bradbury, a fling coasting to a stop, and a click at Tempe Terra marking the site.

**Follow-up, fixes and controls (Bryon, Sep 29):**
- **Iso shows the surface:**
  - Iso used to treat "All" as floor 1, so the surface, its buildings and the new land never showed there. Now "All" in Iso looks at the surface, like the other cameras, and picking a floor looks into it.
  - Picking up a room below ground, or the corridor tool, in Iso with All drops the view to floor 1, so building works as before (and the tutorial's "place it in ring 1").
- **The crust's ceiling got in the way:** floor 1's rock ceiling was drawn even with a floor picked, and covered it like a lid (in Iso, and with X-ray and walls down). It's now only drawn with every floor showing.
- **The globe spins** with sideways scrolling too.
- **The plan stays centred:** dragging no longer pans. Sideways scrolling turns the layout round the shaft, as in the 3D views, and zoom is about the shaft. Names stay upright, and picking undoes the turn.
- **Floor preview:** pointing at a floor in the picker shows it (dashed); moving off the picker goes back to the floor that was kept; clicking keeps it.
- **Browser check:**
  - Iso with All shows the solar array, airlock, pod, landing pad and boulders.
  - Pointing at F2 previews it, and moving off returns to the surface.
  - F1 with walls down, with no lid.
  - The plan turned by sideways scrolling, with names upright and a drag that doesn't move it.

**Follow-up, more polish (Bryon, Sep 29):**
- **Plan icons stay upright:** each room's icon and name are one marker at its centre, counter-turned as the plan turns (and the construction percentages too).
- **Cutaway frames the unlocked rings** across the section, with a margin (`fitCutaway`). Like Top, it stops once the player zooms, and refits for a new hole, more rings, or a resized window.
- **The sky** (`src/render3d/sky3d.ts`) is a dome that follows the camera.
  - By day it's butterscotch at the horizon deepening to tan overhead, with a bluish halo and disc where the sun is.
  - By night it's near black, with stars fading in as the light goes: a scattering of sky cells about a degree across each hold one, so a star is a couple of pixels.
  - The scene's background colour stays behind it.
- **First person follows the floor picker:** picking a floor while walking moves you there, straight down (or up) if there's room, else to the nearest spot within 40 m, else the gallery. The floor being dug has nowhere to stand, so picking it leaves you where you are. Walking, a picked floor no longer lifts away the floors above.
- **Sliding** (`step` in `walk.ts`): a blocked step is tried turned a notch (10°) at a time, up to 85°, each way, shortened to what it moves along the obstacle, and the least turn that's clear is taken; failing that, half or a quarter of the step. So you slide along straight, curved or angled walls and furniture instead of stopping.
- **Free is gone:** the camera, its drag and zoom, and its state. A saved Free camera opens as Iso.
- **The Life support card flickered:** the room card sat inside its category's popup, so showing it widened the popup. Air's popup opens leftward, anchored at its right edge, so a wider popup moved the button out from under the pointer, which hid the card and moved the button back, over and over. The card now floats above the popup, out of its layout.
- **Tests:** sliding (into rock it slides round the gallery; diagonally into the wall it keeps moving along it and never goes through).
- **Browser check:**
  - The Life support card stays up.
  - Plan icons stay upright as it turns.
  - Cutaway framed at noon, with the sky's gradient and a horizon of mountains.
  - Stars at night.

**Follow-up, first person and keys (Bryon, Sep 29):**
- **First person:**
  - What's under the pointer isn't outlined; clicking a room still shows its details.
  - The floor picker doesn't preview, and has no "All". Picking a floor only moves you there. Nothing is hidden or shown, since walking never lifts floors away.
  - Holding Shift runs, now at 9 m/s against 3 walking; turning with Q and E is unchanged. Shift is read off every key, so a Shift let go outside the window can't stick.
- **The modes' keys work anywhere** (`MODE_KEYS`): B opens Build; V, C and M open (or close) View, Charts and Map. The mode buttons show their keys.
- **The rooms' keys work only in Build**, which frees them elsewhere. That includes R (rotate), X (demolish) and the corridor tool, which moved from C (now Charts) to **Z**, the only letter left. Inside Build, B is the battery bank's key again.
- First person and Build never overlap, so WASD and Q/E are free for rooms in Build, as they already were.
- **The help screen, README key table and tutorial hints** now say to open Build first ("In Build (B), press L").
- **Browser check:**
  - G does nothing outside Build. B opens Build; then G picks the galley, B the battery bank, and Z corridors. C switches to Charts, V to View, M to Map.
  - While walking, B does nothing (Build is off), and the floor picker shows no All and doesn't preview.

**Follow-up, stairs, crops, ceilings and the ground (Bryon, Sep 29):**
- **Wide stairs:**
  - A stairwell is a switchback. Each floor has a 2.8 m wide flight of 16 steps (`stair_flight`: treads, risers, stringers and handrails; `climb`) rising 4 m to the floor above.
  - Beside it is a railed well (`stair_landing`, "Stair well"; `opening`) where the flight from below comes up.
  - The flight and well swap sides from floor to floor (a placement's new `mirror: "odd" | "even"`). Together they fill most of the room.
  - The top floor has only the well, the bottom floor only the flight (`stairwell:1x1:top` / `:bottom`).
  - The well is `snug`: the flight and well each face along their own radius, so they close in toward the shaft.
  - Openings don't count toward crowding.
- **Wells are cut from the floor** (`stairWells` in rooms3d): the floor slab is split round each well's ring and angle box, so you look down the flight.
- **Walking the stairs** (`flights`, `onStairs`, `stairLift` in walk.ts):
  - Step onto a flight only at its foot; the rails keep you on it.
  - The camera rises smoothly with the distance along it. Off the head you're on the floor above.
  - From above, walk into the well at its open end and you're on the flight going down. Its rails stop you anywhere else.
  - `step` now returns the floor as well as the position.
- **Farms show their crop:**
  - Planter beds and hydroponic racks come in a version for each of the seven crops: potato mounds, soy bushes, wheat and barley stalks, leafy greens, mushroom logs and algae tubes.
  - `cropVariant` picks the version for the room's crop, and the furniture cache is keyed on it.
- **Furniture no longer pokes through the ceiling below.** Everything stands `FIT.lift` (3.5 cm) above its floor, since some models dip just below their base.
- **The ground below the surface** (the cap round a picked floor) now reaches 3 km in 24 pieces, past where the camera can see, so the sky never shows round its edge.
- **Browser check:** the stairwell template in the furnishing tool: the flight and well side by side, filling the room. The crop variants are in the Catalogue. The climbing itself is covered by tests; building a real three-floor stairwell in game takes days of drilling.

**Follow-up, fuller walls (Bryon, Sep 29):**
- **16 new wall models:**
  - At home: family photos, a woven hanging, a picture of Earth, coat hooks and an intercom.
  - At work: a whiteboard, a pipe manifold with valve wheels, a cable tray, a tool pegboard, a fire extinguisher, a first-aid box, an air vent and a caged work light.
  - In the galley: a menu board and a rack of pans.
  - In farms: a grow-light bar.
  - The palette gains `red`.
- **A second pass fills the walls** (`WALL_FILL` in furniture.mjs, `FILL` in the layouts generator):
  - After each template's own hangings, every room gets fill-ins for its kind: home, plant, workshop, office, store, farm, galley, wash, quiet, public or entry.
  - A high row runs round the room over everything else: vents at 2.7 m, cable trays at 2.95 m, work lights at 2.45 m, grow lights at 2.5 m.
  - Eye-level pieces fill the gaps the first pass left, and extinguishers and hooks go low.
  - Single pieces search along their wall for a free spot (`spot`: every 0.5 m, one copy).
  - A few that never find room in their kind of room are left out (`NO_ROOM`).
- **Hangings stack:** two hangings clash only if they overlap in height as well (within `FIT.hangingAbove`, 0.1 m), so a vent or cable tray can run above a picture.
- **Count:** in ring 2, the templates hang about 3× as much as before (422 → 1,284 across all templates).
  - At home it's about double, e.g. a studio went from 13 to 26.
  - Industrial rooms gain the most, from their cable trays, e.g. a smelter went from 12 to 42 and a storeroom from 2 to 21.
- **Browser check:** in the entrance in first person, the air vent, clock, first-aid box, picture of Earth and notice board hang on the walls; the battery bank has its cable trays and work lights.

**Follow-up, sparks and steam follow their furniture (Bryon, Sep 29):**
- Each particle remembers the emitter it came from.
- **Particles only come from furniture that's shown.** When the view hides that furniture, its particles vanish at once, even while paused (`RoomEffects.setView`).
  - The view hides furniture on floors above a picked floor, and in X-ray's faded ring-1 rooms.
  - The stage calls `setView` on every layout rebuild (a floor pick or an X-ray toggle) and from `applyFloorCut`.
  - Hidden emitters make nothing new.
- **Built rooms keep their emitters when they stop** (their rate goes to 0), so a stopped furnace's last sparks fade out naturally.
  - Emitters are matched by spot when a room's output changes, so a slowdown doesn't wipe what's in the air.
  - A demolished room's furniture is gone, so its sparks and steam go at once.
- Tests: `tests/effects3d.test.ts`.

**Graphics batch (Bryon, Sep 29): all eleven enhancements, one step at a time.**

**Step 1, cheaper furniture:**
- Measured with a 200-room hole: 10,332 items in 1.58 M triangles and 7,428 meshes (one per colour per room), each its own draw call.
- **Coloured per vertex:** a room's furniture is now one mesh for plain parts and one for glowing ones, each also split by whether it hangs. The glow material tints its light by the vertex colour. Draw calls drop to 800 for those 200 rooms.
- **A far copy:**
  - Beyond `FURNITURE_LOD.far` (55 m) from the camera, a room draws a coarser copy: 6-sided cylinders, 6×4 spheres, and no parts under 0.45 m. That's 35% of the triangles.
  - It's built the first time it's needed (`showDetail`), so loading costs no more.
  - The stage picks near or far per room on each redraw, from the distance to the furniture's centre.
- Fixed along the way: the room cache replaced a furniture group's `userData`, losing its tags. It now merges.
- Dev hook: `__stage3d.detail()` counts rooms showing each copy.

**Step 2, lamp light:**
- **Lights in the data:** 35 items give light (`light` in furniture.json: colour, where from, reach, strength), set in `LIGHTS` in furniture.mjs.
  - Lamps (warm): wall, floor and bedside lamps, work lights, lamp posts, kitchen and bench lights.
  - Fires (orange): furnaces, fireplaces, welders, reactors, candles.
  - Grow lights (pink): grow-light bars, planter beds and racks.
  - A few cool ones: the serving counter, decon arch, elevator car and electronics bench.
- **Pools** (`lightPools`): each light casts a soft additive disc on the floor below it, merged per room into the furniture group.
  - A wall light's pool lies out from its wall.
  - A light high up spreads thinner.
- **Point lights** (`LampLights`): a pool of up to `LAMP_LIGHTS.most` (12) that go to the lamps nearest the camera on each redraw.
  - Only lamps on the floor you're walking or the one picked, since lights don't cast shadows and would shine through the floor between.
  - Lights fade at the edge of their range. Intensity 3.5, decay 1.8, reach × 1.6.
- **A new setting**, "Lamp light" (`graphics.lamps`): High 1 (12 lights), Medium 0.5 (6), Low 0 (none, no pools). Changing the count recompiles shaders, so only settings change it.
- **Console:** `dm.finish()` finishes the whole construction queue (`consoleFinish`), for testing.
- **Browser check:** a new test game with rooms built by `dm.finish()` (Bryon's autosave backed up in the browser first). In the apartment in first person, lamp light off is flat and cool. On, the wall lamps throw warm light round themselves and the bedside lamps glow on the floor. The first attempt blew the paintings out, so the intensity came down from 7 to 3.5 and the wall lamp's light moved out from the wall.

**Step 3, mood by depth and hour:**
- The haze pass already rebuilds each pixel's world position, so it now tints by depth and time of day too (`LOOK.mood`).
  - Near the surface, colours follow the hour: at night they cool to a moonlit blue.
  - Deeper, lamps take over whatever the hour. From 2 m below the surface to 22 m, everything settles into their amber.
  - The sky is left alone.
- `look.setDaylight` is fed from `updateSky`. The mood scales with the haze setting, so Low turns it off with the haze.
- Dev hook: `__stage3d.draw()` draws a frame at once, since a hidden browser pane barely animates.

**Step 4, colonists as figures** (`people3d.ts`, which replaces the capsule `Walkers`):
- **The figure:** a low-poly person (legs, body, arms, neck) coloured per vertex. Trousers stay dark and the rest takes the instance's clothing colour; the head is a separate instanced sphere in a skin tone.
  - Two poses, standing and sitting. Lying is the standing figure turned.
  - Every pose is one instanced mesh, so a crowd costs three draw calls.
- **On the galleries:** walkers face the way they're going, bobbing with each step and swaying a little. There's one per 3 colonists, up to 60, as before.
- **In rooms:** `spots` in the furniture data (26 items).
  - Seats: chairs, office chairs, stools, armchairs, sofas and benches (2 each), school desks.
  - Beds: bed, bunk (lower and upper), double (2), medical.
  - Work posts, in front of: consoles, workbenches, stoves, counters, lathes, fab benches, drill presses, welders, blueprint tables, clean hoods, seed tables, printers, furnaces, scanners.
- **Who's in, by the hour** (`occupied`, deterministic per room):
  - Posts fill with the room's actual staff, who wear its category colour.
  - Beds fill at night, up to the population. By day 8% are taken (the night shift).
  - Seats in homes, plazas, offices, halls, galleries and elder care: 30% taken by day, 55% in the evening, 3% at night.
  - It's redone when the hour, staffing, population or layout changes. At most 600 figures in rooms.
- Everyone above a chosen floor is hidden (not in first person). Rooms hidden by X-ray have no furniture group, so no people either.
- **Browser check:** in Iso on floor 1 with walls down, figures walk the gallery in their colours and galley staff stand at the counters in the food green. Poses are covered by tests (a sleeper lies flat).
- Lamp light turned down again (intensity 2.2, decay 2), since white things right by a lamp were tripping the glow. The serving counter's light moved out from inside its sign.

**Step 5, dust storms:**
- **In the sim** (`weather.ts`; DESIGN.md "Dust storms: forecast days ahead; cut solar output").
  - From day 6, each day has a 5% chance of a storm forecast 2 to 4 days ahead. It lasts 1 to 2 days and builds and clears over 6 hours.
  - While it blows, solar arrays make half (`limit: "storm"`, "dimmed by the dust storm" in the room card).
  - Whether a storm comes is a hash of the hole and the day, not the hole's random stream, so it never shifts anything else's luck.
  - Messages at the forecast, the start and the end. The snapshot carries `weather: { storm, dueInDays }`, and a chip in the top bar counts down, then shows "🌪 Storm".
  - All numbers are in `config.json` → `weather.dustStorm`.
- **Balance note:**
  - The first try (solar at 30% for 1 to 3 days) cost the 90-day network bot about 15% growth.
  - Teaching the bot to build batteries and solar on a forecast made it worse: extra arrays each take a worker.
  - At 50% for 1 to 2 days, with the bot unchanged, the playthroughs pass: 15 born and 170 colonists at day 80, against 18 and 166 without storms.
  - How often and how hard storms hit is open for mid-game balance.
- **In 3D:**
  - The haze turns dusty and thick and reaches far things from any view.
  - The sky dome fills with murk (lighter toward the horizon), hiding the sun and stars. The sun dims 70% and the sky's light 30%.
  - The solar panels dull to dusty tan.
  - Grit streams past the camera: 1,400 motes in a box that follows it, above ground, with a floor picked hidden.
  - The view eases toward the sim's storm level, so it builds smoothly. A storm already blowing on load shows at once.
- **Console:** `dm.storm(days, inDays)` (`consoleStorm`).
- **Browser check:** `dm.storm(1)` in a test game, run to full strength. In Cutaway the sky is an orange murk, the horizon has gone and the hole is dim. From the shaft, grit drifts above the gallery.

**Step 6, light shafts** (`shafts3d.ts`):
- Sunlight falling down the open shaft around midday: an open-ended additive column, 62% of the shaft's open radius, from the surface down the hole.
  - It's brightest where you look through the most of it, fades with depth, and is gone before its end, so it has no hard rim.
  - Faint streaks drift down it.
- It leans a little away from the sun (at most 0.22 rad). It shows from the sun at 0.35 high and is full from 0.85. A dust storm smothers it.
- It shows only with no floor picked and haze on.
- Found along the way: additive blending already scales by alpha, so the shader puts the colour in whole and only the strength in alpha. Scaling both had squared it away to nothing.
- **Browser check:** at 11:42 in a test game. From the shaft, the upper shaft glows warm; in Cutaway there's a column of light with streaks down the middle of the hole.

**Step 7, cozy details** (`details3d.ts`): small shader touches chained onto materials, on one clock that runs while the game does (with Life on).
- **Glowing parts** (`aGlow` per vertex):
  - Fires flicker and dance.
  - Lamps and grow lights hold steady.
  - Glowing parts under 12 cm are indicator lights and blink, each at its own rate.
  - Screens flicker a little.
- **Plants sway:** leaf, plant and crop colours. They lean more the higher they are above their floor, in slow gusts.
- **Water shimmers:** light ripples across it, and its top surface rises and falls a hair.
- **Windows fog at the bottom:** thick at the sill, thinning upward, a little uneven, with droplets beading, more of them low down.
- Furniture now has four material kinds: plain, glow, plant and water. The kind comes from each part's colour.
- **Browser check:** no shader errors after load. In the entrance, a colonist sits on the bench and another stands by the decon arch. The motion shows only while the game runs.

**Step 8, textures** (procedural, in `surfaces.ts`):
- **Floors by kind of room**, with room colours on (`withFloor`). Each uses its own colour, tinted 20–25% by the category colour.
  - Planks (homes, offices): 20 cm, staggered, each its own shade, with grain.
  - Tiles (clinics, kitchens, halls): 40 cm, grouted.
  - Diamond plate (plants, workshops, farms).
  - Paving (plazas): offset stones.
  - Concrete (storage, logistics, construction): speckled, jointed.
- **Furniture parts by what they're made of** (`aMat` per vertex, from the part's colour, `withPartPatterns`):
  - Wood grain (wood, composite).
  - A soft weave (cushion, cream).
  - Brushed and scuffed metal (metal, steel).
  - Worn paint with scratches (panel, hazard).
  - Clumpy soil (soil, substrate).
- **Glass catches the light at a glancing angle** (`withFresnel`), as a reflection would.
- Found along the way: floor faces can wind downward (rooms draw double-sided), so floors are found by |n.y|, as the finishes do.
- **Browser check:** in Iso on floor 1 with room colours on, there are planks in the dorm, tiles in the galley, plate in the battery room and paving in the plaza.

**Step 9, labels and trouble:**
- Labels start with an icon for the room's kind: 🛏 homes, 🍽 food, 💧 water, 🌬 air, ⚡ power, ✚ health, 🗂 admin, ⚙ industry, 🌳 public, ↕ halls and stairs, 🏗 construction, 📦 storage, 🚀 logistics, ⛏ digging.
- **Rooms in trouble** (`troubleOf` in view/roomTrouble.ts, from the room's status):
  - Slowed (short of staff, morale, the weather, an ordinance) is a warning: an amber outline.
  - Short of what it runs on is bad: a red outline.
  - Paused is idle: a grey outline.
  - Standing by with its output full or stocked is fine.
- A badge floats over the label with the reason's icon: 👷, 😞, 🌪, 📜, ⚡, 💧, 🫁, 🌾 and so on, or ⚠.
- Outlines keep their normal material otherwise. It's redone only when some room's trouble changes, and outline materials are swapped, not rebuilt.
- **Browser check:** pausing the battery bank puts a ⏸ badge over its label.

**Step 10, wear and grime** (`view/grime.ts`, `withGrime` in surfaces.ts):
- A room's wear comes from:
  - its age (up to 0.55 at 60 days; the landing kit counts from the start);
  - the worst noise (0.2) and smell (0.3) on its own cells;
  - heavy work (plants, power, air, water; 0.25 over its first 10 days).
- It's cut into four whole levels, so rooms share materials and the layout only rebuilds when a room crosses a level. The stage adds the levels to its layout key.
- **Walls:** grime rises from the floor (unevenly), with streaks running down and broad stains.
- **Floors:** scuffs and stains.
- It works on room colours and on finishes alike.
- **Browser check:** the Day 8 save, opened paused. The battery bank (power, 8 days old) darkens toward its base, and there are no shader errors.
