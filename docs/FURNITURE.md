# Furniture

What's in each room type in the 3D view (docs/PLAN-M10.md). The models are built in `scripts/furniture.mjs`, which writes `data/furniture.json` (run `node scripts/furniture.mjs` after editing it): each item is a few boxes, cylinders and spheres, with named colours and "accent" for the room's category colour. Sizes are width × depth × height in metres. The back of an item goes against its wall. Wall hangings (pictures, lamps, charts, readouts, signs) hang at a height and go flat on a solid wall; with walls down they vanish with their wall. Where things go in each room is in `data/layouts.json`, edited with the dev tool (`?furnish` in the dev build). Stairwells and elevators are furnished on every floor they span, with their own templates for the top or bottom floor where those differ.

## Models made in Blender (first person, #357, #360)

Some items have a detailed model made in Blender, drawn **in every view by default** and in first person only or never if the player chooses (Settings → Display → Furniture, #391; the rest of this page says "first person" for where they were first drawn), close up: **every item in the home rooms** (the dorm, studio, flat, apartment, family apartment, suite and residence: 45 items; beds and seats in #363, the rest in #364) and **every item in the work rooms** (#365: the farm with each crop's bed and rack, water, air and power, the smelter, shops and fab, refinery, composter, concrete plant, brickworks, glassworks, recycling, excavator bay, maintenance and waste storage: 82 items, plus the lathe) and **every item in the public rooms** (#366: the galley, kitchen and canteen, the park, the plazas and lounge, the clinic, hospital and elder care, the gym and the school: 39 items) and **the rest of the catalog** (#367: restrooms and laundry, storage and the yard, offices and the suit room, the crypt, stairs and lifts: 32 items): all 199. Every other view (Free view, the cutaway, the overhead and plan views) draws every item from its code-built parts, as does first person past 55 m and for an item with no model. Like a film set: the overhead camera sees the set from across the lot, first person walks onto it and gets the props. An item's size, spots, light and layouts still come from `data/furniture.json`.

**How a model is made.** Each model is a Python script, `models/<item>.py`, run by Blender without its window. It uses the kit in `models/kit.py` (below). Faces nobody sees can be left off (`omit`). Positions are in the item's frame, as the parts are (metres; x across, y up, z to its front), and the kit turns them into Blender's frame. Each script describes the item's first-person copy, `fp(m)`, and the kit exports it as `models/<item>.glb`, one object named `<item>`. Every material is named for a colour in `data/furniture.json` (or `accent` for the room's colour), then `+glow` for a glowing one and `@<texture>` for a textured one (`cushion@fabric`). Corners are shaded by ambient occlusion baked into the vertex colours (48 rays per corner, reaching 35 cm, and the floor counts), so the shading costs no triangles. Edges sharper than 35° stay hard; softer ones are smoothed, and round things (cylinders, lathes, sweeps, soft goods) stay smooth round their sides up to 70°, so an eight-sided bar still looks round.

**The kit** (#361), the tools a model is built from rather than a pile of boxes:

| Tool | Makes | Example |
| --- | --- | --- |
| `box(p, size, c, bevel, seg, edges, taper)` | A box, its edges rounded (`bevel` on all, the top, the upper or the upright edges), its top scaled by `taper` [x, z] | The lathe's tapered tailstock, the sofa's feet |
| `cyl(p, d, h, c, seg, d2)` | A cylinder, or a cone with `d2` | The bunk bed's posts and rungs |
| `lathe(p, profile, c, seg)` | A profile of (radius, y) points turned round the y axis, ends capped or closed to a point | The lathe's chuck and tailstock centre |
| `sweep(path, d, c, seg, smooth)` | A tube along a path of points, through a smooth curve (`smooth` steps a span; 1 keeps corners) | The lathe's coolant hose, handwheel and door handles; the sofa's piping |
| `soft(p, size, c, round, puff, cuts)` | Something soft: a subdivided box with rounded edges, puffed up in the middle of its top and bottom | The sofa's cushions, arms, back and throw pillow |
| `strip(points, y0, y1, depth, c)` | An upright sheet in folds | The bunk bed's curtain |
| `blade(p, yaw, pitch, length, width, c, droop, roll, seg)` | A thin leaf coming to a point, sagging at its tip; about 18 triangles at `seg=2` (#364) | The plant pot's leaves, the wall planter's herbs, the tree's crown |
| `side(faces, s)`, `split(face, n, along)`, `inset(faces, by, depth, c)` | Pick a shape's face, cut it into strips, inset each and push it in (or out) | The lathe's cabinet doors, its vent grille, the headstock's control panel |

**Gotchas (#364).** `split` and `inset` want a plain four-sided face: on a box whose edges are bevelled, `split` does nothing and `inset` pushes the bevelled corners outward, past the item's footprint (the test catches it). Inset first and bevel something else, or leave that box square. A thin raised panel (`inset` with a small negative depth) barely shows under the game's front light; recess it instead, so the baked shading draws its edges. From #365: splitting a face that a neighbouring split already cut (the shared edge has picked up points) does nothing, so cut a grid of drawers from one carcass per column rather than columns then rows. `blade` heads round in the floor's plane (`yaw` from +x toward +z), so blades fanning in an upright plane (a fan's) take `yaw=0` and their angle as `pitch`. From #366: faces are drawn **one side only** (web and Godot), so an open `lathe` you can look into (a pan, a bowl, a cup, a pocket) shows only its far rim. Turn its profile back down the inside and close it at the middle, as the plates do: `(0, 0) … (r, h), (r − t, h), (0, h′)`. And nothing is see-through: `mirror` is a solid colour, so a pane of "glass" hides whatever is behind it. Show the goods in a deep recess with no pane (the vending machine, the dishwasher), and don't sink anything below a surface you `inset` into a thin box (the serving counter's food first went under its own top). Mind each item's height: the canteen table is 0.8 m tall, so nothing on its 0.75 m top stands more than 5 cm, and the lawn and gym mat are 5 cm in all.

**Crops (#365).** The farm's sixteen beds and racks (a planter bed and a hydroponic rack for each of eight crops) share one builder, `models/_crops.py`: `planter_bed(crop)` and `hydroponic_rack(crop)` return the `fp` function, and each item's script is three lines calling it. A file whose name starts with `_` is a helper, not a model: `scripts/models.mjs --export` skips it. Each plant is a handful of cheap shapes, a faceted `lathe` mound for a bush or a head of greens, `blade`s at `seg=1` (10 triangles) for leaves, three- and four-sided stalks with a tapered ear for grain, so a bed of eight to twelve plants or a rack of eighteen stays under the budget; positions jitter by a fixed hash, so every export is the same. The code-built crops are the heaviest items in the game (a rack of potatoes is 20,748 triangles, a bed of greens 3,004); their models are 416–778, so a farm gets lighter in first person.

Every tool takes `tex` for a texture and `r` (where it makes sense) to turn it.

**Textures** (#361) are small and shared: six 128 × 128 grey tiles made by code in `scripts/textures.mjs` (`fabric`, `quilt`, `brushed`, `perforated`, `tread`, `grain`), packed into `fp.bin` with the models. They're detail only: grey around 0.5, doubled and multiplied into the part's colour, so the named colours and the room's accent still set the palette. The kit gives faces texture coordinates by box projection, `TEX_SCALE` metres to a tile per texture. A textured surface takes its texture in place of its colour's procedural pattern. `node scripts/textures.mjs` writes `models/textures.png`, a contact sheet to look at; to add a texture, add a function at the end of `TEXTURES` (it must tile) and name it in a model.

```sh
node scripts/models.mjs --export   # run every models/*.py in Blender, then convert
node scripts/models.mjs            # just convert the committed .glb files (no Blender needed)
```

`scripts/models.mjs` reads each `.glb` (any `.glb` that follows the rules works, whether scripted, made by hand or from a CC0 pack) and packs them all into **`public/models/fp.bin`**: a small JSON header (each model's box and colours) followed by the arrays in binary, packed tight since #371: 16-bit positions across the item's box, octahedral normals in two bytes, a byte of shade, 16-bit texture coordinates, and triangles as one-byte steps back from the next new vertex; the script's header comment has the layout. The build and CI never run Blender: the `.glb` files and `fp.bin` are committed, with the scripts that make them next to them. `BLENDER=/path/to/blender` picks a Blender other than the one on the PATH (Homebrew: `brew install --cask blender`; built with 5.2).

**Where they're drawn: a setting (#391, Nov 12, 2026).** Settings → Display → **Furniture** chooses *Simple shapes* (the code-built parts in every view, and `fp.bin` is never fetched), *Detailed on foot* (what #360 did: models in first person only) or *Detailed everywhere* (models in every view, **the default**). `graphics.furniture` in the saved settings (`FurnitureDetail` in `src/view/graphics.ts`; not part of the Low/Medium/High presets, so a preset never changes it), read each frame by `showFurnitureDetail` in `stage3d.ts` through `drawsDetailedFurniture`. Far rooms (past 55 m) still draw their far copy in every view, so Free view shows models only for the rooms near the camera. Under that row, the same screen charts the **frame rate** (below) and, when it has been low, offers to scale the furniture back a step or lower the graphics preset. Godot has the same row, panel and card (`ViewSettings.Furniture`, `FpsPanel.cs`, `SlowCard.cs`, `Fps.cs`; PLAN-GODOT.md), with the options and the fps numbers in `data/settings.json`.

**The frame rate (#391).** `src/view/fps.ts` turns the 3D view's frames (one `recordFrame` per animation frame while the tab is visible) into one reading a second and keeps the last 120; a gap of more than a second (a hidden tab, a stall) drops that second rather than reading as 1 fps. "Consistently low" is the middle reading of the last 20 seconds being under 30 (`LOW_FPS`; the middle, so one hitch or a loading stall doesn't count). `ui/FpsPanel.tsx` draws the chart and the advice, with a button for each step down (`lighterFurniture`, `lowerPreset`). **In the game itself:** under **10 fps** (`VERY_LOW_FPS`, over the same 20 seconds) a card appears at the bottom of the game (`ui/SlowCard.tsx`, mounted in `App.tsx`; only in a running 3D game, not on the title or behind a menu) with one button, **Lighten graphics**: the Low preset and simple furniture shapes, after which the readings start over. It can be dismissed for the session and doesn't show when those settings are already in force. In dev, `await import("/src/view/fps.ts")` in the console and `recordFrame` fake frames to see the advice.

**Loaded on demand.** The web game fetches `fp.bin` the first time a view wants the models (first person, or any view under *Detailed everywhere*; never under *Simple shapes*; `loadFpModels` in `src/view/models.ts`), so the overhead game's download doesn't grow for anyone who opts out; until it's in (or if it fails), first person draws the parts. Each room's furniture then gets a third copy beside near and far, `fp` (`showDetail` in `render3d/furniture3d.ts`), built the first time a room near you in first person has an item with a model; rooms without one keep their near copy. Godot (`Furniture.cs`) reads the same file the first time the furniture setting wants the models (`Furniture.Detailed`, set by `Live.cs`) and adds a MultiMesh beside each batch whose item has a model, swapping it with the near parts as the setting and the camera say. Textured surfaces draw with one array texture (web: `withFpTextures` in `furniture3d.ts`, Godot: a `sampler2DArray` in the furniture shader, the texture's layer in `UV.x` and its coordinates in `UV2`).

**Limits (#362).** About **800 triangles** per item (#359), and the shared textures at most **16 tiles of 128 × 128** (256 KB). Both live in `LIMITS` in `scripts/models.mjs` and travel in `fp.bin`'s header, with a third (#371): `fp.bin` **under 3 MB gzipped** when every item has a model (raised from 1 MB in #391: the models are now the default everywhere, and a setting lets a slow machine skip the download; today's file is 0.97 MB, so there's room for richer models), projected from today's average (`scripts/fpsize.mjs`; the converter prints it); the converter refuses a model or a texture set over them, and `tests/models.test.ts` checks the limits, the colours, the textures (each tile averages close to 0.5), that each model fits its item's footprint, and that only first person draws it. The look they serve is in `docs/ART.md` ("Two looks for furniture").

**The benchmark (Nov 4, 2026, M4): the budget holds.** Every item drawn as the lathe (781 triangles, 98% of the limit, textured) in first person, with `__stage3d.models(true, "lathe")` on the web and `DM_FP_STRESS=lathe` in Godot, against the models as made and the code-built parts. Late dev game (day 120, 44 furnished rooms):

| Where | Code-built parts | Models as made | Lathe for every item |
| --- | --- | --- | --- |
| Web, the dormitory (60 items), four headings, `cost(20)` best of 3 | 0.61–1.49 ms | 0.61–1.46 ms | 0.60–1.48 ms; furniture triangles −16% to +30% |
| Web, a machine room (filters, tanks, pumps; 60 items, floor 2) | 0.57–1.29 ms | 0.63–1.25 ms | 0.57–1.20 ms; furniture triangles −19% to −5% |
| Godot, the dormitory, `--walk --at=-14.5,-5.2,-5.7,0 --bench=8`, Medium | 60.2 fps, 1,766 draw calls, 3.0 M triangles | 60.0 fps, 1,406 calls | 64.1 fps, 2,161 calls, 2.2 M triangles |

Frame times don't move: first person draws a room or two, and an 800-triangle model is no heavier than what's there already. The code-built items have a median of 156 triangles but a mean of 706, and 22 are already over 800 (crop racks and planter beds, up to 20,748 for a rack of potatoes), so models everywhere can even lower the count. What the budget does cost is **download size**: `fp.bin` takes about 36 KB a model (12 KB gzipped), so all 199 items would be about 7 MB (2.4 MB gzipped), fetched on the way into first person. Before the catalog is half done, split it (per room type, fetched as rooms come near) or pack the arrays smaller (16-bit positions, 8-bit normals); the frame budget doesn't need lowering. **Done in #371 by packing** (see Size, below).

**Comparing.** In the dev build, `__stage3d.models(false)` draws the code-built items in first person too, and `__stage3d.models(true)` the models again; `__stage3d.models(true, "bunk_bed")` draws the bunk bed for every item, to measure models everywhere. `__stage3d.fpLoaded()` says whether `fp.bin` has been fetched. In Godot, `DM_FX=nomodels` leaves the models out.

| Item | Code-built (web) | First-person model | What the model adds |
| --- | --- | --- | --- |
| Bunk bed | 228 | 724 | Round tube posts with caps, side rails and slats, soft mattresses, blankets turned down with a folded hem, plump pillows, a guard rail, a ladder of round rungs hooked over the rail, a curtain in folds on rings along a rod, a clip-on reading lamp, a drawer underneath; quilted mattresses, fabric bedding |
| Sofa | 84 | 754 | Soft, rounded seat and back cushions and arms (soft), piping down the arm fronts (sweep), a tipped throw pillow, tapered feet; fabric throughout |
| Bed | 120 | 604 | Tapered legs, a rail frame, a quilted mattress, a soft duvet with its top turned back and its side hanging down, a folded throw at the foot, a plump pillow, a padded headboard in a composite surround |
| Double bed | 156 | 794 | The same in fibre composite (grained), two pillows and a propped cushion, a cream runner across the foot, a tall headboard with a quilted, buttoned panel |
| Armchair | 72 | 726 | The sofa's single sister: rolled arms with piping, a padded back, plump seat and back cushions, a tipped cream pillow, tapered feet; fabric throughout |
| Chair | 72 | 554 | A bent steel-tube frame (each back leg runs up into the back's upright, swept), braces, rubber feet, a padded seat on a pan, a curved padded back (strip) |
| Office chair | 168 | 748 | A five-star base of tapered spokes on castors, a turned hub and gas-lift column with a brushed sleeve, the seat mechanism and its lever, a padded seat, armrests on bent tubes with pads, a curved shell round a perforated mesh back, a lumbar pad |
| Stool | 192 | 734 | A turned domed base on a rubber ring, a brushed column with a gas-lift sleeve and lever, a footrest ring on three spokes (sweep), a padded seat rolled over a dark rim (lathe) |
| Lathe | 120 | 781 | A turned chuck and tailstock centre (lathe), a coolant hose and a handwheel (sweep), cabinet doors with handles and a vent grille (split, inset), an inset control panel, a tapered tailstock; brushed steel, tread plate, grained panels |

The sofa and lathe were remodelled with the richer kit (#361), one tool or more each.

**The rest of the homes (#364)**, with each model's triangles:

| Group | Items (triangles) |
| --- | --- |
| Storage | Wardrobe (188: recessed door panels, bar handles, vent slots), dresser (604: three drawers with cup handles, a framed mirror, a potted plant), bookshelf (760: rows of spines, a leaning book, a stack lying flat), shelf unit (384: perforated shelves, crates with handle cut-outs, a tool box, a tub), locker (254: louvres, a name card, a lever handle and padlock), footlocker (346: a domed lid, straps, a hasp, rope handles) |
| Tables | Table (494: an apron, rubber feet, paper, a pen, a mug), dining table (694: padded benches on trestles, six plates and cups, a bowl), coffee table (310: a lower shelf, books, a cup, a magazine), desk (528: a drawer pedestal, a monitor with a glowing screen, a keyboard, a pen pot), side table (408: a turned pedestal and a little lamp), TV unit (312: a glowing screen on a bracket, speakers with perforated grilles) |
| Fixtures | Kitchenette (684: doors, a sunk sink and gooseneck tap, a hob, a kettle, a glowing strip under the wall cabinets), bathroom pod (394: a door with a frosted window and lever, a grille, a lamp, a towel hook), bathtub (456: a rolled rim, a deep basin of water, a mixer tap, a towel), fireplace (742: coursed stone, a grate, logs and dancing flames, candlesticks), piano (759: keys black and white, a music rest, turned legs, pedals, a quilted bench) |
| Soft and standing | Partition (296: a quilted screen in a bent-tube frame), rug (310: bands, a diamond, fringes), floor lamp (516: a turned base, a flared fabric shade, a cord and switch), coat rack (622: curled hooks, a coat and a scarf) |
| Plants | Plant pot (794: four tiers of leaves round a cane), wall planter (788: herbs and a trailing plant), planter tree (790: a forked trunk and a crown of soft foliage clumps) |
| On the walls | Painting (168) and wide painting (198) in relief, wall lamp (322), mirror (100), clock (404: hour marks and hands), wall shelf (526: books, a copper jar, a mirrored globe), family photos (300), textile (632: bands in folds, tassels), Earth photo (284), coat hooks (730: a coat, a bag, a hi-vis vest), intercom (194: a glowing screen, a blinking light), air vent (170), poster (202: pins, a curling corner) |

**The work rooms (#365)**, with each model's triangles:

| Group | Items (triangles) |
| --- | --- |
| Farm | Planter beds (416–763: a grained bed with inset panels, a rim in the room's colour, a drip line and valve, a label stake, a hood with a recessed grow light; greens, potatoes, soybeans, wheat, barley, hemp, mushrooms on substrate blocks under a misting bar, algae in a glass trough with a paddle wheel), hydroponic racks (546–778: three shelves of channels under recessed lights, a supply pipe and a reservoir; algae in glass tubes), seedling bench (720: trays of sprouts, soil sacks, a watering can), grow light (496: heat-sink fins, a cable) |
| Water, air and power | Storage tank (792: a domed top, a ladder, a manway, a sight tube, an outlet valve), pump (762: a finned motor, a coupling guard, a volute), valve panel (664: handwheels, gauges, pipes turning into the floor), filter column (670: tie rods, pipes down the corners), CO2 scrubber (764: bolted hatches, an intake grille, a stack), air handler (672: a pitched three-bladed fan behind a guard), gas bottles (794: valves, neck bands, a chain), air duct (288: flanges, a louvred hatch, a damper), electrolysis stack (698: cells, tie rods, bus bars, separators), gas tank (800: a sphere on braced legs, a curving ladder), battery rack (738: modules with charge bars and lights, copper links), inverter (266: louvres, a display, conduit), wellhead (728: flanges, a discharge and valve, a guard rail) |
| Industry | Furnace (474: a glowing mouth under a raised door on chains, a tapping trough), ore bin (454: a heap of rock), ingot rack (304: ingots stacked crosswise), conveyor (404: rollers, crates riding the belt, an emergency stop), reactor vessel (598: a bolted flange, a sight glass, a ladder), crystal puller (648: a glowing boule in a cage), kiln (490: brick courses, an arched crown, steel straps), brick press (436: a ram, a fresh brick, hoses), mixer (538: a tilted ribbed drum, a chute), hopper (352: a funnel, braces, a ladder), excavator (780: rounded tracks, a cab with glass, a boom and bucket) |
| Workshops and fab | Workbench (446: a vice, drawers, a back board), drill press (602: a belt guard, feed handles, a lamp), welding bay (546: a slotted table, a glowing bead, a screen, the welder and its bottle), 3D printer (561: a gantry, a part half printed, a spool), tool wall (522), tool pegboard (790), tool cart (498), clean hood (351: a tilted sash, a glowing back panel, wafers), fab bench (630: an oscilloscope, a soldering station, a magnifier lamp), parts cabinet (578: sixteen drawers), repair stand (486), parts rack (686) |
| Stores and yard | Barrels (726: rolling hoops, bungs, a pump hose), soil sacks (372), cement bags (428), mould forms (260: concrete and rebar), bricks on a pallet (460), pallet jack (484), sorting bins (552), baler (456: a bale tied with wire), scrap pile (498: a gear, a spring, a wheel rim), glass sheets on a rack (236), compost bin (250), compost drum (552), waste container (336), bin (310) |
| On the walls | Pipe run (784) and pipe manifold (792: valves and handwheels), gauges (626), readout panel (386: a trace and level bars), chart board (268), whiteboard (286), notice board (262), map of Mars (438: raised highlands, a canyon, glowing pins), safety sign (196), fire extinguisher (432), first-aid box (380), cable tray (490), work light (524: a caged bulb), console (477: a sloped desk, keys, a joystick, a monitor) |

**The public rooms (#366)**, with each model's triangles:

| Group | Items (triangles) |
| --- | --- |
| Galley, kitchen and canteen | Stove counter (770: four burners with a stockpot and a pan, knobs, an oven glowing through its door, a tapered hood and its light), prep counter (768: drawers, a sunk sink and gooseneck tap, a chopping board with a tomato, greens, a knife and a bowl, a shelf of jars), serving counter (742: four pans of stew, greens, mash and rolls, a ladle, a tray slide, a slanted sneeze guard, a glowing menu screen), fridge (246: a door and a drawer, bar handles, a display, a note and magnets), dishwasher (676: a hood with a deep opening onto a rack of plates, a basket of cups), stock kettle (766: a tilting kettle on trunnions, a handwheel and gearbox, a draw-off tap over a grate), water dispenser (480: a ribbed bottle, hot and cold taps), tray rack (640: a trolley on castors, trays on rails), canteen table (754: padded benches, trays with plates of food, bowls and spoons, salt and pepper), utensil rack (776: copper pans, a ladle, a whisk, a strainer on S-hooks), menu board (330: dishes and prices, a chalk cup and leaf, a lamp on two arms) |
| Park, plazas and lounge | Fountain (774: a basin with a rolled lip, lily pads, a turned pedestal and bowl, six streams arcing down, a jet), lawn (782: turf in an edging, low tufts of grass, little flowers), flower bed (704: seven clumps, each a flower on a stem), shrub (574: soft clumps of foliage in a stone pot), bench (650: grained slats with capped ends on bent-tube frames), lamp post (692: a turned plinth, collars, a scrolled arm, a lantern with a glowing globe), banner (466: cloth in folds on a rod with finials, an emblem, tassels), vending machine (712: four shelves of cans and packets, a keypad, a pickup flap), info kiosk (422: a glowing map of the hole on a tilted head, a card reader), games table (790: a pool table with leather pockets, racked balls, a cue and chalk), arcade cabinet (608: a recessed screen, a joystick and six buttons, a coin door, a marquee) |
| Clinic, hospital and elder care | Body scanner (700: a ring gantry round a dark bore, a padded couch on its base), medical bed (760: a raised back, a turned-down blanket, side rails, a clipboard), operating table (770: a ribbed column boot, a padded top, a surgical lamp on a boom), reception desk (496: a counter with papers and a bell, a work surface with a monitor, keyboard and phone), medicine cabinet (281: frosted windows, a cross, drawers, gloves and bottles), monitor (486: a five-star base, a pump, a heartbeat trace), water cooler (498: a tube of paper cups), wheelchair (794: tyres, push rims and spokes, castors, a sling seat and back) |
| Gym | Treadmill (586: a tread belt, a motor hood, handrails with grips, a console and safety key), exercise bike (732: a flywheel behind a guard, a crank and pedals, a saddle, a console), weight bench (770: a barbell on J-hooks with turned plates and collars), dumbbell rack (608: eight hex dumbbells on two sloped tiers), exercise mat (440: a ribbed mat starting to roll up, a towel, a skipping rope), punching bag (516: a weighted stand, a swivel and chains, a stitched leather bag) |
| School | Board (411: sums and writing in chalk, a ringed planet, a tray of chalk and an eraser, a pinned sheet), cubbies (782: six cubbies of backpacks and a lunch box, name cards), school desk (596: an open exercise book and a pencil, a book box, a moulded chair facing it) |

**The rest of the catalog (#367)**, with each model's triangles:

| Group | Items (triangles) |
| --- | --- |
| Restrooms and laundry | Toilet stall (720: walls on steel feet under a headrail, a door swung half open with a lever, an occupancy light and a coat hook, a turned pan, an open seat, a raised lid, a cistern, a roll on its holder), washbasins (763: a vanity of four doors, two round bowls with gooseneck taps, a soap pump, framed mirrors, a light bar, a towel on a ring), shower (758: a tray and drain, a frosted screen, a curtain in folds drawn back on rings, a rain head, a hand shower on a riser, a mixer, a shelf of bottles), washer (766: a porthole door with a domed window, a dial, buttons and a display, a detergent drawer, a towel and a tub on top), drying rack (722: bent-tube frames, towels over the rails, a shirt on a hanger, socks pegged up), mop rack (712: two mops, a broom and a squeegee on clips over a drip tray), cleaning cart (790: castors, doors, a push handle, a mop in its bucket and wringer, spray bottles, paper towel, a bin bag) |
| Storage and yard | Cargo crate (348: recessed panels, corner posts, a band, lugs and straps), crate stack (596: four crates and a ratchet strap), pallet rack (754: perforated uprights braced in zigzags, mesh decks, pallets of crates and wrapped loads, ribbed drums), cargo cart (746: tread plate, swivel castors, a push handle, a strapped crate, a coil of cable), kit container (795: corrugated sides, ribbed doors, locking bars and cam keepers, corner castings, a placard), girder stack (480: nine I-beams on timber bearers, bands, a tag), scaffolding (760: tube standards on screw jacks, ledgers and transoms, braces, boards and toe boards, a guard rail, a tool box) |
| Offices and the suit room | Plan table (564: a tilted top, a glowing plan with room outlines, a parallel rule, rolls of plans), meeting table (800: rounded grained top on pedestals, a conference puck with a glowing ring, a tablet, papers, cups, six sled-frame chairs), wall screen (490: a dashboard of bars, a line chart and figures, a camera, a speaker console), filing cabinet (410: four recessed drawers with cup handles and label cards, a lock, a paper tray and a mug of pens), suit locker (776: a pressure suit with a life-support pack, a chest unit, padded limbs, gloves, boots and a mirrored visor, an oxygen bottle on the shelf), decontamination arch (744: perforated panels and spray nozzles, a glow strip, amber lamps, a control box, a slotted grate) |
| The crypt | Memorial niches (796: fifteen deep niches with copper plates, a few holding flowers or a candle, a plinth, an inscription band, a cornice), memorial stone (744: an arched headstone with a copper plate, candles burning in dishes, a posy of leaves and flowers), candle stand (702: a turned candelabrum, three candles with drips and flames), plaque (352: raised lettering on a recessed stone panel, domed screws) |
| Stairs and lifts | Stair flight (648: tread-plate steps with hazard nosings and risers, stringers, handrails on posts with turned-down ends), stair well (540: a guard rail with rounded corners on posts, kick plates, an arrival nosing), spiral stair (592: wedge treads round a column, balusters, a winding handrail), spiral stair well (552: a hazard nosing ring with chevrons and bolts), spiral stair rail (640: turned round rails on posts, a kick band), elevator shaft (508: guide rails, frosted panes in frames, sills, the cables and a counterweight), elevator (694: the same shaft with the car waiting, its doors, a floor indicator, the crosshead and pulley), call panel (602: a floor display, lit up and down buttons with arrows, a grille, braille) |

Shared builders, like the farm's `_crops.py`: `_crates.py` (a crate with recessed panels, posts and a label, used by the cargo crate and the crate stack) and `_shaft.py` (the elevator shaft, used by both elevator items). The spiral stair's wedge treads are made in its own script straight from `bmesh`, the kit having no wedge; a script can add any geometry that way and hand it to `m._take` for its colour.

Colours keep their effects: `fire` dances, `glow` screens flicker, small glowing parts blink, `plant` and `leaf` sway, `water` shimmers, as on the code-built items.

**What it costs (Nov 3, 2026, M4).** Standing in the early dev game's dormitory in first person (eight bunk beds), facing two of them:

- **Web** (`__stage3d.cost(30)`): furniture 56,900 triangles in 26 draw calls with the models, 52,900 in 25 without; 0.44 ms a frame on the GPU against 0.46–0.75 ms, within the noise.
- **Godot** (`--walk --at=… --bench=8`, Medium): 66.0 fps with the models, 63.1 without (1,476 and 1,470 draw calls; 1.765 M and 1.768 M triangles, since Godot's code-built boxes are chamfered and heavier).
- **Size:** `fp.bin` is 62 KB for three models (15 KB gzipped), fetched once, on the way into first person. With #361's six textures (96 KB raw) and the bigger sofa and lathe, it's 206 KB (76 KB gzipped). With #363's six home models (nine in all), 376 KB. With #364's 37 more (46 in all), 1.17 MB (377 KB gzipped), about 25 KB a model. With #365's 82 work-room models (128 in all), 3.38 MB (1.0 MB gzipped), about 26 KB a model: past the halfway mark the benchmark warned about, so #371 (split `fp.bin` by room, or pack its arrays tighter) is due before #366 and #367 add the rest.
- **Packed (#371, Nov 6, 2026):** version 3 of `fp.bin` takes the same 128 models to 1.44 MB (607 KB gzipped), about 4.4 KB gzipped a model, so all 199 items project to **0.94 MB gzipped**, under the 1 MB limit, and splitting isn't needed. What it costs: positions within 0.03 mm, normals within a degree, texture coordinates within a fiftieth of a pixel; triangles exact. What did and didn't help, measured: triangles as steps back from the next new vertex, with an escape for long reaches (soft goods close a ring back to its first vertex): 193 KB gzipped down to 73; each array gathered across the whole file rather than slot by slot: about 40 KB less. Renumbering vertices in the order they're used made the positions compress worse (205 KB to 263), so Blender's order stays; delta-coding the positions made them worse too. If a later batch pushes the projection over, `models.mjs` fails and the test does too: then split the file by room type (the other half of #371's plan).
- **With #366's 39 public-room models (167 in all, Nov 6, 2026):** 1.94 MB (802 KB gzipped), about 4.8 KB gzipped a model, projecting to **0.97 MB gzipped** for all 199 items. Still under the limit, but closer than before (0.94): these models run nearer the budget than the work rooms'. #367 has 3% to spare, so if its 32 come out heavier on average, expect the converter to call for the split.
- **With #367's last 32 (all 199 items, Nov 8, 2026):** 2.38 MB (968 KB gzipped at the default level; 0.99 MB at level 9, as the limit is measured), now the real size rather than a projection. It fits the 1 MB limit with 1% to spare, so no split; the next model added, or a heavier remodel, will need one (or a raised limit).
- **#361's remodelled lathe**, standing at it in the late dev game (web, `cost(30)`): 14,600 furniture triangles with the models, 13,900 without, the same 37 draw calls, 0.37–0.40 ms either way.

**The trial (#357)** drew the models in every view, near and far, from `data/models.json`, within 300 triangles near and 60 far; on the 13-floor showcase they cost nothing measurable, even with the bunk bed drawn for every item (+62% furniture triangles, 1.33 ms against 1.55–1.64 ms a frame). #359 then made them first person only, so they can be far more detailed while the overhead views keep their chunky look, and moved them to binary, since JSON numbers would have grown to about 4 MB for every item.

Every item in `data/furniture.json` has a model (#367), and `tests/models.test.ts` checks that: a new item needs its `models/<item>.py` too, or the test fails.

## By room

| Room | Size | Items |
| --- | --- | --- |
| Bunk dorm | M | Bunk bed, Locker, Footlocker, Privacy screen, Table, Stool, Rug, Floor lamp, Coat rack, Shelving, Poster, Wall lamp, Wall shelf, Clock, Family photos, Woven hanging, Picture of Earth, Coat hooks, Intercom, Air vent |
| Studio | S | Bed, Side table, Wardrobe, Privacy screen, Kitchenette, Bathroom, Table, Stool, Rug, Floor lamp, Potted plant, Coat rack, Painting, Poster, Wall lamp, Wall shelf, Mirror, Family photos, Woven hanging, Picture of Earth, Coat hooks, Intercom, Air vent |
| Apartment | M | Bed, Side table, Wardrobe, Privacy screen, Kitchenette, Bathroom, Dining table, Sofa, Media wall, Rug, Floor lamp, Potted plant, Coat rack, Painting, Wide painting, Wall lamp, Wall shelf, Mirror, Clock, Family photos, Woven hanging, Picture of Earth, Coat hooks, Intercom, Air vent |
| Flat | S | Double bed, Side table, Wardrobe, Dresser, Privacy screen, Kitchenette, Bathroom, Table, Chair, Sofa, Coffee table, Media wall, Rug, Floor lamp, Potted plant, Bookshelf, Painting, Wide painting, Wall lamp, Wall shelf, Mirror, Clock, Hanging planter, Family photos, Woven hanging, Picture of Earth, Coat hooks, Intercom, Air vent |
| Family apartment | M | Double bed, Bed, Side table, Wardrobe, Dresser, Privacy screen, Kitchenette, Bathroom, Dining table, Sofa, Coffee table, Media wall, Desk, Office chair, Rug, Floor lamp, Potted plant, Bookshelf, Painting, Wide painting, Poster, Wall lamp, Wall shelf, Mirror, Clock, Hanging planter, Family photos, Woven hanging, Picture of Earth, Coat hooks, Intercom, Air vent |
| Suite | S | Double bed, Side table, Wardrobe, Dresser, Bathroom, Bathtub, Kitchenette, Table, Chair, Sofa, Armchair, Coffee table, Fireplace, Bookshelf, Media wall, Rug, Floor lamp, Potted plant, Tree planter, Painting, Wide painting, Wall lamp, Wall shelf, Mirror, Clock, Hanging planter, Family photos, Woven hanging, Picture of Earth, Coat hooks, Intercom, Air vent |
| Residence | M | Double bed, Bed, Side table, Wardrobe, Dresser, Privacy screen, Bathroom, Bathtub, Kitchenette, Dining table, Sofa, Armchair, Coffee table, Fireplace, Piano, Bookshelf, Desk, Office chair, Media wall, Rug, Floor lamp, Potted plant, Tree planter, Painting, Wide painting, Wall lamp, Wall shelf, Mirror, Clock, Hanging planter, Family photos, Woven hanging, Picture of Earth, Coat hooks, Intercom, Air vent |
| Galley | S | Stove counter, Prep counter, Fridge, Serving counter, Dining table, Shelving, Water dispenser, Bin, Notice board, Clock, Wall shelf, Safety sign, Menu board, Utensil rack, Fire extinguisher, First-aid box, Air vent |
| Farm | L | Planter bed, Hydroponic rack, Planter bed (potatoes), Hydroponic rack (potatoes), Planter bed (soybeans), Hydroponic rack (soybeans), Planter bed (wheat), Hydroponic rack (wheat), Planter bed (barley), Hydroponic rack (barley), Planter bed (mushrooms), Hydroponic rack (mushrooms), Planter bed (algae), Hydroponic rack (algae), Seedling bench, Storage tank, Tool cart, Shelving, Pipe run, Gauges, Chart board, Hanging planter, Readout panel, Grow light, Pipe manifold, Tool pegboard, Fire extinguisher, Air vent |
| Water tank | S | Storage tank, Pipe run, Valve panel, Pump, Gauges, Safety sign, Pipe manifold, Cable tray, Work light, Fire extinguisher, First-aid box, Air vent |
| Water recycler | L | Filter column, Storage tank, Pump, Pipe run, Control console, Valve panel, Gauges, Readout panel, Safety sign, Chart board, Pipe manifold, Cable tray, Work light, Fire extinguisher, First-aid box, Air vent |
| Restroom | S | Toilet stall, Washbasins, Shower, Washer, Bench, Bin, Mirror, Poster, Wall lamp, Air vent, First-aid box, Intercom |
| Life support | L | CO2 scrubber, Air handler, Gas bottles, Control console, Pipe run, Air duct, Gauges, Readout panel, Safety sign, Pipe manifold, Cable tray, Work light, Fire extinguisher, First-aid box, Air vent |
| Clinic | S | Medical bed, Medicine cabinet, Monitor, Privacy screen, Body scanner, Desk, Office chair, Chair, Potted plant, Water cooler, Chart board, Poster, Clock, Readout panel, Painting, Whiteboard, Picture of Earth, Family photos, Intercom, Fire extinguisher, Air vent |
| Admin office | M | Reception desk, Desk, Office chair, Filing cabinet, Meeting table, Wall screen, Potted plant, Water cooler, Bookshelf, Sofa, Map of Mars, Painting, Clock, Notice board, Wide painting, Whiteboard, Picture of Earth, Family photos, Intercom, Fire extinguisher, Air vent |
| Battery bank | S | Battery rack, Inverter cabinet, Control console, Air duct, Gauges, Readout panel, Safety sign, Pipe manifold, Cable tray, Work light, Fire extinguisher, First-aid box, Air vent |
| Deep well pump | M | Wellhead, Pump, Pipe run, Valve panel, Control console, Storage tank, Gauges, Readout panel, Safety sign, Pipe manifold, Cable tray, Work light, Fire extinguisher, First-aid box, Air vent |
| Smelter | L | Furnace, Ore bin, Ingot rack, Control console, Tool cart, Conveyor, Barrels, Safety sign, Readout panel, Gauges, Chart board, Pipe manifold, Cable tray, Work light, Fire extinguisher, First-aid box, Air vent |
| Machine shop | M | Lathe, Workbench, Drill press, Welding bay, 3D printer, Tool wall, Shelving, Tool cart, Safety sign, Chart board, Wall shelf, Clock, Tool pegboard, Whiteboard, Cable tray, Work light, Fire extinguisher, First-aid box, Air vent |
| Silicon refinery | L | Reactor vessel, Crystal puller, Clean hood, Control console, Gas bottles, Shelving, Safety sign, Readout panel, Gauges, Chart board, Pipe manifold, Cable tray, Work light, Fire extinguisher, First-aid box, Air vent |
| Electronics fab | M | Fab bench, Clean hood, Parts cabinet, 3D printer, Stool, Shelving, Control console, Readout panel, Chart board, Safety sign, Clock, Tool pegboard, Whiteboard, Cable tray, Work light, Fire extinguisher, First-aid box, Air vent |
| Staging bay | L | Kit container, Crate stack, Cargo crate, Cargo cart, Pallet jack, Barrels, Control console, Safety sign, Notice board, Map of Mars, Readout panel, Cable tray, Work light, Fire extinguisher, First-aid box, Air vent |
| School | M | School desk, Board, Desk, Office chair, Bookshelf, Cubbies, Rug, Potted plant, Notice board, Map of Mars, Poster, Clock, Painting, Whiteboard, Picture of Earth, Family photos, Intercom, Fire extinguisher, Air vent |
| Elder care | M | Bed, Armchair, Side table, Sofa, Potted plant, Medicine cabinet, Rug, Media wall, Floor lamp, Privacy screen, Dining table, Water cooler, Painting, Wide painting, Clock, Hanging planter, Wall lamp, Family photos, Woven hanging, Picture of Earth, Coat hooks, Intercom, Air vent |
| Composter | M | Compost bin, Compost drum, Soil sacks, Tool cart, Barrels, Gauges, Safety sign, Chart board, Pipe manifold, Cable tray, Work light, Fire extinguisher, First-aid box, Air vent |
| Crypt | M | Memorial niches, Memorial stone, Bench, Potted plant, Candle stand, Plaque, Wall lamp, Painting, Woven hanging, Air vent |
| Concrete plant | M | Mixer, Hopper, Cement bags, Mould forms, Conveyor, Pallet jack, Safety sign, Gauges, Chart board, Pipe manifold, Cable tray, Work light, Fire extinguisher, First-aid box, Air vent |
| Tiny plaza | S | Bench, Tree planter, Lamp post, Potted plant, Bin, Hanging planter, Wall lamp, Banner, Picture of Earth, Intercom, Fire extinguisher, First-aid box, Air vent |
| Small plaza | M | Fountain, Bench, Tree planter, Lamp post, Vending machine, Info kiosk, Bin, Potted plant, Banner, Hanging planter, Wall lamp, Map of Mars, Picture of Earth, Intercom, Fire extinguisher, First-aid box, Air vent |
| Entrance | S | Suit locker, Decontamination arch, Bench, Control console, Info kiosk, Cargo crate, Map of Mars, Safety sign, Notice board, Clock, Coat hooks, Picture of Earth, Fire extinguisher, First-aid box, Intercom, Air vent |
| Cargo elevator | S | Cargo crate, Cargo cart, Pallet jack, Control console, Barrels, Safety sign, Notice board, Cable tray, Work light, Fire extinguisher, First-aid box, Air vent |
| Site office | S | Desk, Office chair, Plan table, Locker, Shelving, Water cooler, Chart board, Notice board, Clock, Whiteboard, Picture of Earth, Family photos, Intercom, Fire extinguisher, Air vent |
| Construction office | M | Plan table, Desk, Office chair, Tool wall, Cargo crate, Shelving, Water cooler, Chart board, Notice board, Clock, Map of Mars, Whiteboard, Picture of Earth, Family photos, Intercom, Fire extinguisher, Air vent |
| Construction yard | L | Girder stack, Crate stack, Scaffolding, Cargo cart, Pallet jack, Tool wall, Plan table, Barrels, Safety sign, Chart board, Notice board, Tool pegboard, Whiteboard, Cable tray, Work light, Fire extinguisher, First-aid box, Air vent |
| Storeroom | S | Shelving, Cargo crate, Barrels, Safety sign, Notice board, Cable tray, Work light, Fire extinguisher, First-aid box, Air vent |
| Warehouse | M | Pallet rack, Crate stack, Cargo cart, Pallet jack, Barrels, Safety sign, Notice board, Wall lamp, Cable tray, Work light, Fire extinguisher, First-aid box, Air vent |
| Depot | L | Pallet rack, Crate stack, Cargo cart, Pallet jack, Control console, Barrels, Safety sign, Notice board, Readout panel, Cable tray, Work light, Fire extinguisher, First-aid box, Air vent |
| Stairwell | S | Stair flight, Stair well, Bench, Potted plant, Poster, Wall lamp, Safety sign, Picture of Earth, Intercom, Fire extinguisher, First-aid box, Hanging planter, Air vent |
| Maintenance | M | Workbench, Repair stand, Parts rack, Tool wall, Tool cart, Control console, Shelving, Safety sign, Chart board, Clock, Notice board, Tool pegboard, Whiteboard, Cable tray, Work light, Fire extinguisher, First-aid box, Air vent |
| Cleaning service | M | Washer, Cleaning cart, Mop rack, Drying rack, Washbasins, Shelving, Locker, Notice board, Clock, Mirror, Poster, Wall lamp, Air vent, First-aid box, Intercom |
| Elevator | S | Elevator shaft, Elevator (car waiting), Call panel, Bench, Potted plant, Poster, Wall lamp, Safety sign, Picture of Earth, Intercom, Fire extinguisher, First-aid box, Hanging planter, Air vent |

## Items

| Item | Size (m) | Used in |
| --- | --- | --- |
| Painting (`painting`) | 0.9 × 0.1 × 0.7, hung at 1.5 | Studio, Apartment, Flat, Family apartment, Suite, Residence, Clinic, Admin office, School, Elder care, Crypt |
| Wide painting (`painting_wide`) | 1.8 × 0.1 × 0.9, hung at 1.45 | Apartment, Flat, Family apartment, Suite, Residence, Admin office, Elder care |
| Poster (`poster`) | 0.6 × 0.05 × 0.85, hung at 1.3 | Bunk dorm, Studio, Family apartment, Restroom, Clinic, School, Stairwell, Cleaning service, Elevator |
| Wall lamp (`wall_lamp`) | 0.25 × 0.55 × 0.35, hung at 1.9 | Bunk dorm, Studio, Apartment, Flat, Family apartment, Suite, Residence, Restroom, Elder care, Crypt, Tiny plaza, Small plaza, Warehouse, Stairwell, Cleaning service, Elevator |
| Wall shelf (`wall_shelf`) | 1 × 0.45 × 0.45, hung at 1.45 | Bunk dorm, Studio, Apartment, Flat, Family apartment, Suite, Residence, Galley, Machine shop |
| Mirror (`wall_mirror`) | 0.6 × 0.05 × 1, hung at 1.1 | Studio, Apartment, Flat, Family apartment, Suite, Residence, Restroom, Cleaning service |
| Clock (`wall_clock`) | 0.4 × 0.1 × 0.4, hung at 2.2 | Bunk dorm, Apartment, Flat, Family apartment, Suite, Residence, Galley, Clinic, Admin office, Machine shop, Electronics fab, School, Elder care, Entrance, Site office, Construction office, Maintenance, Cleaning service |
| Chart board (`chart_board`) | 1.4 × 0.15 × 0.9, hung at 1.25 | Farm, Water recycler, Clinic, Smelter, Machine shop, Silicon refinery, Electronics fab, Composter, Concrete plant, Site office, Construction office, Construction yard, Maintenance |
| Readout panel (`readout_panel`) | 1.2 × 0.1 × 0.7, hung at 1.35 | Farm, Water recycler, Life support, Clinic, Battery bank, Deep well pump, Smelter, Silicon refinery, Electronics fab, Staging bay, Depot |
| Gauges (`gauge_panel`) | 0.9 × 0.15 × 0.6, hung at 1.3 | Farm, Water tank, Water recycler, Life support, Battery bank, Deep well pump, Smelter, Silicon refinery, Composter, Concrete plant |
| Map of Mars (`mars_map`) | 2 × 0.1 × 1.1, hung at 1.3 | Admin office, Staging bay, School, Small plaza, Entrance, Construction office |
| Notice board (`notice_board`) | 1.2 × 0.1 × 0.8, hung at 1.3 | Galley, Admin office, Staging bay, School, Entrance, Cargo elevator, Site office, Construction office, Construction yard, Storeroom, Warehouse, Depot, Maintenance, Cleaning service |
| Safety sign (`safety_sign`) | 0.6 × 0.05 × 0.6, hung at 1.75 | Galley, Water tank, Water recycler, Life support, Battery bank, Deep well pump, Smelter, Machine shop, Silicon refinery, Electronics fab, Staging bay, Composter, Concrete plant, Entrance, Cargo elevator, Construction yard, Storeroom, Warehouse, Depot, Stairwell, Maintenance, Elevator |
| Hanging planter (`wall_planter`) | 0.8 × 0.5 × 0.8, hung at 1.35 | Flat, Family apartment, Suite, Residence, Farm, Elder care, Tiny plaza, Small plaza, Stairwell, Elevator |
| Banner (`banner`) | 0.9 × 0.1 × 1.6, hung at 1.6 | Tiny plaza, Small plaza |
| Plaque (`plaque`) | 0.5 × 0.05 × 0.35, hung at 1.4 | Crypt |
| Family photos (`family_photos`) | 1 × 0.05 × 0.7, hung at 1.35 | Bunk dorm, Studio, Apartment, Flat, Family apartment, Suite, Residence, Clinic, Admin office, School, Elder care, Site office, Construction office |
| Woven hanging (`wall_textile`) | 0.9 × 0.1 × 1.25, hung at 1.3 | Bunk dorm, Studio, Apartment, Flat, Family apartment, Suite, Residence, Elder care, Crypt |
| Picture of Earth (`earth_photo`) | 0.7 × 0.1 × 0.7, hung at 1.4 | Bunk dorm, Studio, Apartment, Flat, Family apartment, Suite, Residence, Clinic, Admin office, School, Elder care, Tiny plaza, Small plaza, Entrance, Site office, Construction office, Stairwell, Elevator |
| Coat hooks (`coat_hooks`) | 1.3 × 0.35 × 1, hung at 0.9 | Bunk dorm, Studio, Apartment, Flat, Family apartment, Suite, Residence, Elder care, Entrance |
| Whiteboard (`whiteboard`) | 1.6 × 0.2 × 1, hung at 1 | Clinic, Admin office, Machine shop, Electronics fab, School, Site office, Construction office, Construction yard, Maintenance |
| Pipe manifold (`pipe_manifold`) | 1.6 × 0.5 × 0.7, hung at 1.7 | Farm, Water tank, Water recycler, Life support, Battery bank, Deep well pump, Smelter, Silicon refinery, Composter, Concrete plant |
| Cable tray (`cable_tray`) | 1.8 × 0.6 × 0.15, hung at 2.95 | Water tank, Water recycler, Life support, Battery bank, Deep well pump, Smelter, Machine shop, Silicon refinery, Electronics fab, Staging bay, Composter, Concrete plant, Cargo elevator, Construction yard, Storeroom, Warehouse, Depot, Maintenance |
| Tool pegboard (`tool_board`) | 1.2 × 0.2 × 0.9, hung at 1.1 | Farm, Machine shop, Electronics fab, Construction yard, Maintenance |
| Fire extinguisher (`fire_extinguisher`) | 0.25 × 0.4 × 0.85, hung at 0.8 | Galley, Farm, Water tank, Water recycler, Life support, Clinic, Admin office, Battery bank, Deep well pump, Smelter, Machine shop, Silicon refinery, Electronics fab, Staging bay, School, Composter, Concrete plant, Tiny plaza, Small plaza, Entrance, Cargo elevator, Site office, Construction office, Construction yard, Storeroom, Warehouse, Depot, Stairwell, Maintenance, Elevator |
| First-aid box (`first_aid_kit`) | 0.4 × 0.3 × 0.4, hung at 1.4 | Galley, Water tank, Water recycler, Restroom, Life support, Battery bank, Deep well pump, Smelter, Machine shop, Silicon refinery, Electronics fab, Staging bay, Composter, Concrete plant, Tiny plaza, Small plaza, Entrance, Cargo elevator, Construction yard, Storeroom, Warehouse, Depot, Stairwell, Maintenance, Cleaning service, Elevator |
| Air vent (`air_vent`) | 0.7 × 0.1 × 0.4, hung at 2.7 | Bunk dorm, Studio, Apartment, Flat, Family apartment, Suite, Residence, Galley, Farm, Water tank, Water recycler, Restroom, Life support, Clinic, Admin office, Battery bank, Deep well pump, Smelter, Machine shop, Silicon refinery, Electronics fab, Staging bay, School, Elder care, Composter, Crypt, Concrete plant, Tiny plaza, Small plaza, Entrance, Cargo elevator, Site office, Construction office, Construction yard, Storeroom, Warehouse, Depot, Stairwell, Maintenance, Cleaning service, Elevator |
| Intercom (`intercom`) | 0.2 × 0.1 × 0.3, hung at 1.35 | Bunk dorm, Studio, Apartment, Flat, Family apartment, Suite, Residence, Restroom, Clinic, Admin office, School, Elder care, Tiny plaza, Small plaza, Entrance, Site office, Construction office, Stairwell, Cleaning service, Elevator |
| Menu board (`menu_board`) | 1.3 × 0.1 × 0.6, hung at 1.75 | Galley |
| Utensil rack (`utensil_rack`) | 1.1 × 0.25 × 0.75, hung at 1.3 | Galley |
| Grow light (`grow_light`) | 1.5 × 0.75 × 0.15, hung at 2.5 | Farm |
| Work light (`work_light`) | 0.2 × 0.6 × 0.25, hung at 2.45 | Water tank, Water recycler, Life support, Battery bank, Deep well pump, Smelter, Machine shop, Silicon refinery, Electronics fab, Staging bay, Composter, Concrete plant, Cargo elevator, Construction yard, Storeroom, Warehouse, Depot, Maintenance |
| Parts rack (`parts_rack`) | 1.15 × 0.55 × 2.2 | Maintenance |
| Repair stand (`repair_stand`) | 1.2 × 0.7 × 1.4 | Maintenance |
| Cleaning cart (`cleaning_cart`) | 0.95 × 0.55 × 1.85 | Cleaning service |
| Mop rack (`mop_rack`) | 1.2 × 0.45 × 1.45 | Cleaning service |
| Drying rack (`drying_rack`) | 1.05 × 0.5 × 1.6 | Cleaning service |
| Bunk bed (`bunk_bed`) | 2 × 1 × 1.9 | Bunk dorm |
| Bed (`bed`) | 2.15 × 1.05 × 0.9 | Studio, Apartment, Family apartment, Residence, Elder care |
| Locker (`locker`) | 0.65 × 0.55 × 1.95 | Bunk dorm, Site office, Cleaning service |
| Footlocker (`footlocker`) | 0.95 × 0.55 × 0.45 | Bunk dorm |
| Table (`table`) | 1.2 × 0.8 × 0.85 | Bunk dorm, Studio, Flat, Suite |
| Stool (`stool`) | 0.4 × 0.4 × 0.5 | Bunk dorm, Studio, Electronics fab |
| Chair (`chair`) | 0.5 × 0.5 × 0.95 | Flat, Suite, Clinic |
| Office chair (`office_chair`) | 0.8 × 0.8 × 1.15 | Family apartment, Residence, Clinic, Admin office, School, Site office, Construction office |
| Rug (`rug`) | 2.4 × 1.7 × 0.05 | Bunk dorm, Studio, Apartment, Flat, Family apartment, Suite, Residence, School, Elder care |
| Armchair (`armchair`) | 0.9 × 0.9 × 1.05 | Suite, Residence, Elder care |
| Sofa (`sofa`) | 2 × 0.9 × 1 | Apartment, Flat, Family apartment, Suite, Residence, Admin office, Elder care |
| Side table (`side_table`) | 0.5 × 0.5 × 0.95 | Studio, Apartment, Flat, Family apartment, Suite, Residence, Elder care |
| Potted plant (`plant_pot`) | 0.85 × 0.7 × 1.45 | Studio, Apartment, Flat, Family apartment, Suite, Residence, Clinic, Admin office, School, Elder care, Crypt, Tiny plaza, Small plaza, Stairwell, Elevator |
| Privacy screen (`partition`) | 1.9 × 0.4 × 1.8 | Bunk dorm, Studio, Apartment, Flat, Family apartment, Residence, Clinic, Elder care |
| Floor lamp (`floor_lamp`) | 0.4 × 0.4 × 1.8 | Bunk dorm, Studio, Apartment, Flat, Family apartment, Suite, Residence, Elder care |
| Media wall (`tv_unit`) | 2 × 0.5 × 1.75 | Apartment, Flat, Family apartment, Suite, Residence, Elder care |
| Coat rack (`coat_rack`) | 0.5 × 0.4 × 1.8 | Bunk dorm, Studio, Apartment |
| Double bed (`double_bed`) | 2.2 × 1.75 × 1.2 | Flat, Family apartment, Suite, Residence |
| Wardrobe (`wardrobe`) | 1.25 × 0.65 × 2.05 | Studio, Apartment, Flat, Family apartment, Suite, Residence |
| Dresser (`dresser`) | 1.25 × 0.55 × 1.8 | Flat, Family apartment, Suite, Residence |
| Coffee table (`coffee_table`) | 1.1 × 0.6 × 0.55 | Flat, Family apartment, Suite, Residence |
| Kitchenette (`kitchenette`) | 2.45 × 0.7 × 2.2 | Studio, Apartment, Flat, Family apartment, Suite, Residence |
| Bathroom (`bathroom_pod`) | 2.25 × 1.7 × 2.45 | Studio, Apartment, Flat, Family apartment, Suite, Residence |
| Bathtub (`bathtub`) | 1.75 × 0.85 × 0.9 | Suite, Residence |
| Fireplace (`fireplace`) | 1.5 × 0.5 × 1.35 | Suite, Residence |
| Piano (`piano`) | 1.55 × 1.45 × 1.35 | Residence |
| Washer (`laundry_machine`) | 0.7 × 0.7 × 0.9 | Restroom, Cleaning service |
| Stove counter (`stove_counter`) | 2.05 × 0.75 × 2.25 | Galley |
| Prep counter (`prep_counter`) | 2.05 × 0.75 × 1.75 | Galley |
| Fridge (`fridge`) | 0.9 × 0.85 × 2 | Galley |
| Dining table (`dining_table`) | 2.4 × 1.95 × 0.9 | Apartment, Family apartment, Residence, Galley, Elder care |
| Serving counter (`serving_counter`) | 2.45 × 0.75 × 2.55 | Galley |
| Water dispenser (`water_dispenser`) | 0.4 × 0.45 × 1.45 | Galley |
| Planter bed (potatoes) (`planter_bed_potatoes`) | 2.6 × 1.15 × 2.6 | Farm |
| Hydroponic rack (potatoes) (`hydroponic_rack_potatoes`) | 1.95 × 0.65 × 2.55 | Farm |
| Planter bed (soybeans) (`planter_bed_soybeans`) | 2.6 × 1.15 × 2.6 | Farm |
| Hydroponic rack (soybeans) (`hydroponic_rack_soybeans`) | 1.95 × 0.65 × 2.55 | Farm |
| Planter bed (wheat) (`planter_bed_wheat`) | 2.6 × 1.15 × 2.6 | Farm |
| Hydroponic rack (wheat) (`hydroponic_rack_wheat`) | 1.95 × 0.65 × 2.55 | Farm |
| Planter bed (barley) (`planter_bed_barley`) | 2.6 × 1.15 × 2.6 | Farm |
| Hydroponic rack (barley) (`hydroponic_rack_barley`) | 1.95 × 0.65 × 2.55 | Farm |
| Planter bed (`planter_bed`) | 2.6 × 1.15 × 2.6 | Farm |
| Hydroponic rack (`hydroponic_rack`) | 1.95 × 0.65 × 2.55 | Farm |
| Planter bed (mushrooms) (`planter_bed_mushrooms`) | 2.6 × 1.15 × 2.6 | Farm |
| Hydroponic rack (mushrooms) (`hydroponic_rack_mushrooms`) | 1.95 × 0.65 × 2.5 | Farm |
| Planter bed (algae) (`planter_bed_algae`) | 2.6 × 1.15 × 2.6 | Farm |
| Hydroponic rack (algae) (`hydroponic_rack_algae`) | 1.95 × 0.65 × 2.55 | Farm |
| Seedling bench (`seed_table`) | 2 × 0.8 × 1.05 | Farm |
| Tool cart (`tool_cart`) | 0.9 × 0.55 × 1.05 | Farm, Smelter, Machine shop, Composter, Maintenance |
| Compost bin (`compost_bin`) | 1.35 × 1.35 × 1.35 | Composter |
| Compost drum (`compost_drum`) | 1.8 × 1.05 × 1.45 | Composter |
| Soil sacks (`soil_sacks`) | 1.3 × 0.9 × 0.7 | Composter |
| Storage tank (`big_tank`) | 3 × 3 × 3.45 | Farm, Water tank, Water recycler, Deep well pump |
| Pipe run (`pipe_run`) | 3 × 0.4 × 0.95 | Farm, Water tank, Water recycler, Life support, Deep well pump |
| Valve panel (`valve_panel`) | 1.2 × 0.65 × 1.8 | Water tank, Water recycler, Deep well pump |
| Pump (`pump`) | 1.3 × 0.8 × 1.1 | Water tank, Water recycler, Deep well pump |
| Filter column (`filter_column`) | 1.1 × 1.1 × 3 | Water recycler |
| Control console (`console`) | 1.3 × 0.9 × 1.8 | Water recycler, Life support, Battery bank, Deep well pump, Smelter, Silicon refinery, Electronics fab, Staging bay, Entrance, Cargo elevator, Depot, Maintenance |
| Toilet stall (`toilet_stall`) | 1.1 × 1.55 × 2.1 | Restroom |
| Washbasins (`sink_basin`) | 1.85 × 0.55 × 2 | Restroom, Cleaning service |
| Shower (`shower_stall`) | 1.1 × 1.1 × 2.2 | Restroom |
| CO2 scrubber (`scrubber_unit`) | 2.45 × 1.45 × 3.4 | Life support |
| Gas bottles (`gas_bottles`) | 1.3 × 0.6 × 1.65 | Life support, Silicon refinery |
| Air handler (`big_fan`) | 1.6 × 0.7 × 1.9 | Life support |
| Air duct (`duct_riser`) | 0.95 × 0.8 × 4 | Life support, Battery bank |
| Battery rack (`battery_rack`) | 1.4 × 0.85 × 2.3 | Battery bank |
| Inverter cabinet (`inverter`) | 1 × 0.65 × 2 | Battery bank |
| Wellhead (`well_head`) | 2.4 × 2 × 2.6 | Deep well pump |
| Furnace (`furnace`) | 2.7 × 2.5 × 4 | Smelter |
| Ore bin (`ore_bin`) | 1.6 × 1.3 × 1 | Smelter |
| Ingot rack (`ingot_rack`) | 1.6 × 0.6 × 1.3 | Smelter |
| Lathe (`lathe`) | 2.2 × 0.6 × 1.4 | Machine shop |
| Workbench (`workbench`) | 2 × 0.8 × 2.1 | Machine shop, Maintenance |
| Tool wall (`tool_wall`) | 2 × 0.2 × 1.9 | Machine shop, Construction office, Construction yard, Maintenance |
| Drill press (`drill_press`) | 0.8 × 0.7 × 1.85 | Machine shop |
| Welding bay (`welding_station`) | 1.85 × 1 × 2 | Machine shop |
| 3D printer (`printer_3d`) | 1 × 0.95 × 1.75 | Machine shop, Electronics fab |
| Reactor vessel (`reactor_vessel`) | 2.9 × 2 × 3.6 | Silicon refinery |
| Crystal puller (`crystal_puller`) | 1.85 × 1.2 × 3.9 | Silicon refinery |
| Clean hood (`clean_hood`) | 1.8 × 0.95 × 2.3 | Silicon refinery, Electronics fab |
| Fab bench (`fab_bench`) | 2 × 0.8 × 1.65 | Electronics fab |
| Parts cabinet (`component_cabinet`) | 1.2 × 0.55 × 1.8 | Electronics fab |
| Mixer (`mixer_drum`) | 2.25 × 1.4 × 2.45 | Concrete plant |
| Hopper (`hopper`) | 1.9 × 1.9 × 2.75 | Concrete plant |
| Cement bags (`bag_stack`) | 1.3 × 1 × 0.85 | Concrete plant |
| Mould forms (`mold_forms`) | 2.05 × 1.2 × 0.6 | Concrete plant |
| Conveyor (`conveyor`) | 3 × 0.8 × 1.2 | Smelter, Concrete plant |
| Cargo crate (`cargo_crate`) | 1.25 × 1.25 × 1.2 | Staging bay, Entrance, Cargo elevator, Construction office, Storeroom |
| Crate stack (`crate_stack`) | 2.45 × 1.25 × 2.4 | Staging bay, Construction yard, Warehouse, Depot |
| Pallet rack (`pallet_rack`) | 2.8 × 1.1 × 3.2 | Warehouse, Depot |
| Shelving (`shelf_unit`) | 1.4 × 0.5 × 2 | Bunk dorm, Galley, Farm, Machine shop, Silicon refinery, Electronics fab, Site office, Construction office, Storeroom, Maintenance, Cleaning service |
| Cargo cart (`cart`) | 1.45 × 0.9 × 1.35 | Staging bay, Cargo elevator, Construction yard, Warehouse, Depot |
| Pallet jack (`pallet_jack`) | 1.6 × 0.7 × 1.35 | Staging bay, Concrete plant, Cargo elevator, Construction yard, Warehouse, Depot |
| Barrels (`barrel_group`) | 1.35 × 1.3 × 0.95 | Smelter, Staging bay, Composter, Cargo elevator, Construction yard, Storeroom, Warehouse, Depot |
| Kit container (`kit_container`) | 3.2 × 2.5 × 2.65 | Staging bay |
| Girder stack (`girder_stack`) | 3.2 × 1.1 × 0.7 | Construction yard |
| Scaffolding (`scaffold`) | 2.5 × 1.1 × 3 | Construction yard |
| Plan table (`blueprint_table`) | 2 × 1.3 × 1.15 | Site office, Construction office, Construction yard |
| Suit locker (`suit_locker`) | 1 × 0.8 × 2.2 | Entrance |
| Decontamination arch (`decon_arch`) | 2.3 × 0.85 × 2.65 | Entrance |
| Desk (`desk`) | 1.6 × 0.8 × 1.3 | Family apartment, Residence, Clinic, Admin office, School, Site office, Construction office |
| Reception desk (`reception_desk`) | 2.7 × 1.5 × 1.25 | Admin office |
| School desk (`student_desk`) | 1 × 1.25 × 0.95 | School |
| Filing cabinet (`filing_cabinet`) | 0.5 × 0.7 × 1.3 | Admin office |
| Meeting table (`meeting_table`) | 2.4 × 2.2 × 0.95 | Admin office |
| Wall screen (`wall_screen`) | 2.2 × 0.2 × 2.45 | Admin office |
| Board (`chalkboard`) | 3 × 0.3 × 2.25 | School |
| Bookshelf (`bookshelf`) | 1.4 × 0.4 × 2 | Flat, Family apartment, Suite, Residence, Admin office, School |
| Cubbies (`cubbies`) | 1.6 × 0.5 × 1.2 | School |
| Medical bed (`medical_bed`) | 2.25 × 1.05 × 1.05 | Clinic |
| Medicine cabinet (`med_cabinet`) | 1.2 × 0.55 × 1.9 | Clinic, Elder care |
| Monitor (`monitor_stand`) | 0.55 × 0.55 × 1.7 | Clinic |
| Body scanner (`scanner`) | 1.95 × 2.3 × 2 | Clinic |
| Water cooler (`water_cooler`) | 0.7 × 0.45 × 1.5 | Clinic, Admin office, Elder care, Site office, Construction office |
| Bench (`bench`) | 1.8 × 0.5 × 0.5 | Restroom, Crypt, Tiny plaza, Small plaza, Entrance, Stairwell, Elevator |
| Tree planter (`planter_tree`) | 1.7 × 1.7 × 3.35 | Suite, Residence, Tiny plaza, Small plaza |
| Lamp post (`lamp_post`) | 1.1 × 0.4 × 2.9 | Tiny plaza, Small plaza |
| Fountain (`fountain`) | 2.5 × 2.5 × 1.75 | Small plaza |
| Vending machine (`vending_machine`) | 1 × 0.85 × 2 | Small plaza |
| Bin (`trash_bin`) | 0.55 × 0.55 × 0.85 | Galley, Restroom, Tiny plaza, Small plaza |
| Info kiosk (`kiosk`) | 0.7 × 0.7 × 1.8 | Small plaza, Entrance |
| Memorial niches (`niche_wall`) | 3.1 × 0.5 × 2.6 | Crypt |
| Memorial stone (`memorial`) | 0.9 × 0.65 × 1 | Crypt |
| Candle stand (`candle_stand`) | 0.5 × 0.5 × 1.15 | Crypt |
| Stair flight (`stair_flight`) | 2.8 × 6.45 × 4 | Stairwell |
| Stair well (`stair_landing`) | 2.85 × 6.45 × 1.05 | Stairwell |
| Elevator shaft (`elevator_shaft`) | 2.4 × 2.4 × 4 | Elevator |
| Elevator (car waiting) (`elevator_car`) | 2.4 × 2.4 × 4 | Elevator |
| Call panel (`call_panel`) | 0.35 × 0.2 × 1.6 | Elevator |
