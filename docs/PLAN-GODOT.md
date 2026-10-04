# The Godot experiment

Bryon, Oct 2, 2026: an experiment to see how a desktop version looks and feels, before deciding on a port. Developed on a Mac, packaged for Windows too. The motivation is graphical power and detail: large holes, and several of them, shouldn't force cutting back on graphics, and the desktop version should be able to go further than the web one in models, textures and immersion.

Chosen: **Godot 4.7 with C#** (installed: Godot .NET 4.7.2, .NET SDK 10), **in this repo** under `godot/`, sharing `data/`.

## What the experiment answers

1. **Scale:** can Godot draw a very large hole (about 40 floors, every ring built and furnished) and more than one hole at a smooth frame rate, with full lighting? Compared with the web version on the same scenes.
2. **Looks:** with Godot's lighting (global illumination, volumetric fog, many real lamps with shadows, the sun down the shaft) and richer materials, is it clearly better?

It doesn't port the simulation. The game logic stays in TypeScript for now; if the experiment convinces, the next phase ports it to C#, checked run for run against the TypeScript.

## How

1. **Export the scene from the web game.** In the dev server, `__stage3d.exportGodot("name")` builds the 3D scene as the game draws it (rooms, walls, floors, furniture, gallery tubes, the drill rig, the shaft and the terrain round it) and writes it as `godot/scenes/<name>.glb`, with its lamps, the sun and the hole's shape as `<name>.json`. Whatever the view shows is what's exported (pick a floor first for a cut view). Materials are named for what they are (rock, a room's finish, glass, a furniture part), so Godot can give each its own look. `dm.showcase(floors)` builds a big test colony for the stress test.
2. **A Godot C# project** (`godot/`) loads an exported scene at runtime and dresses it: textured materials (Godot's procedural noise textures to start, no downloads), the sun and sky, SDFGI global illumination, volumetric fog in the shaft, a real light for every lamp, glow and tone mapping. Cameras: Iso (orbit, pan, zoom) and first person.
3. **Measure:** frame times and screenshots for a small and a huge hole, web against Godot.
4. **Windows:** one test export, to check packaging.

## Steps

1. Scene exporter (web dev tool).
2. The Godot project: load, dress, light, cameras.
3. The huge colony, measurements and side-by-sides.
4. Windows export check, and a write-up with a recommendation.

## Notes as built

Oct 2, 2026.

**Running it.** From `godot/` (with `/usr/local/share/dotnet` on the PATH): `dotnet build`, then `godot-mono --path .  -- --scene=<name>` to look round (Tab switches Iso and first person; F12 saves a screenshot to `shots/`). Add `--bench=12` to circle the camera for 12 s after a 4 s warmup and write `bench/<name>.json` and a screenshot; `--walk` does it in first person on the cut floor's gallery, `--no-lamp-shadows` and `--lite` (no SDFGI, SSIL or volumetric fog) turn things off to see what they cost. `godot/scenes/` and `godot/bench/` aren't committed: export again from the web game.

**The exporter** bakes each instanced mesh (furniture, people) into one plain mesh, because Godot's glTF importer doesn't read `EXT_mesh_gpu_instancing`; that costs Godot many draw calls (below). Exported materials carry their names (`rooms3d.ts`, `furniture3d.ts`), which `Dress.cs` uses to give rock, room surfaces, furniture and glass their own looks (world-mapped noise textures and normal maps; nothing downloaded).

**The showcase.** `dm.showcase(12)` on a new game: 13 floors, rings 1–3 full (216 rooms across about 600 slots, each built and furnished), tubes and corridors everywhere, stairs down every floor; skips costs, construction and access rules (`sim/showcase.ts`). Exported cut at floor 4 (76 MB, 997 lamps) and with all floors (99 MB, 1,355 lamps).

**Measurements** (Apple M4; Godot 1600×1000 debug build, every effect on; web 2048×1226 timed with `__stage3d.draw()` plus `gl.finish()`, since the hidden browser pane throttles frames):

| Scene | Web | Godot |
| --- | --- | --- |
| Showcase cut at F4, Iso | 5.8 ms | 25.3 ms (39 fps), 4,400 draw calls, 1.6M triangles |
| Same, lamp shadows off | | 25.7 ms |
| Same, `--lite` | | 17.1 ms (58 fps) |
| Showcase, all floors (surface) | 7.1 ms | 7.0 ms (144 fps), 4,700 draw calls, 2.2M triangles |
| First person on F4's gallery | 3.0 ms | 19.1 ms (52 fps) |

**What it showed.**

- **Scale isn't the web version's problem yet.** Thirteen fully built floors cost the web view 3–7 ms a frame on the M4: its instancing, furniture detail levels and pooled lamps (the nearest few real lights) hold up. The worry that big holes force cutting graphics isn't borne out at this size; 40 floors and several holes are still untested, and a weaker GPU (a typical Windows laptop) would be the real test.
- **Godot's cost here is draw calls, not lamps or geometry.** Turning off lamp shadows changed nothing; turning off GI and fog saved a third. The rest is the 4,000+ separate meshes the exporter makes. A real port would use MultiMesh (Godot's instancing), which would bring that down to hundreds. 997 real lamps were no trouble for Forward+ (`max_clustered_elements` raised to 4096).
- **Looks:** from above (`docs/godot/godot-iso.jpg` against `web-iso.jpg`), Godot is softer and more even but no better: the exported scene loses the web game's own surface shaders, labels and grime, and generic noise textures don't replace them. In first person (`godot-walk.jpg` against `web-walk.jpg`) it's clearly more immersive: sunlight through the gallery glass falls on the floor, walls take bounced light, and shadows are soft and grounded. That's the global illumination and real lights at work, which the web version can't match.
- **So:** Godot's gain is in lighting and immersion close up, not in raw scale. It would pay off with authored assets (modelled furniture and textured surfaces made for it), not by moving the web scene across.

**Not done:** the Windows export. It needs Godot's export templates (about 1 GB from godotengine.org), not downloaded yet.

## Phase 2: the live viewer

Bryon, Oct 2, 2026: carry on, Mac only for now (no Windows export yet). Chosen: a **live viewer**. The TypeScript simulation runs in Node and Godot draws it, so it plays and looks good soon. The sim port to C# waits until it's worth it.

### How

- **One sim host, two homes.** The Web Worker's logic is now `src/worker/host.ts` (`createSimHost`): the world, real-time ticking and the message protocol. The worker (`sim.worker.ts`) is a thin wrapper round it. The **bridge** (`src/bridge/main.ts`, `npm run bridge`) runs the same host in Node and serves it on a local TCP socket, one JSON message per line, in the worker's protocol. To Godot it's just another main thread: it gets snapshots (20 a second, about 20 KB each) and sends commands (`setSpeed`, `command`, …).
- **The scene from the web's own code.** Porting the 3D builders to C# would be about 2,000 lines of carving geometry (walls with doors and windows, stairwells, tubes, corridors, rock faces), and the two copies would drift apart. Instead the bridge runs `render3d/rooms3d.ts` `buildLayout` in Node (`src/bridge/dom.ts` stubs the canvas it draws labels on) and sends the result (`src/bridge/scene.ts`): meshes merged by material and floor into chunks, the lamps, the room labels, and the furniture as placements. It sends again whenever the layout, the drill, wear or the picked floor change. The viewer asks for a floor with `{ type: "view", topFloor }`.
- **Furniture as instances.** Sent as triangles, furniture made a 12-floor scene 398 MB. Now the bridge sends what stands where (item, position, turn, the room's accent), and Godot builds each item once from `data/furniture.json` (`Furniture.cs`: boxes, cylinders and spheres, as `furniture3d.ts`) and draws every copy as a MultiMesh, one per item per floor. A small shader gives accent parts their room's colour, lights glowing parts by night and sways plants. The scene is 4.7 MB and builds in Godot in about 100 ms.
- **Godot's side** (`godot/src/`): `Bridge.cs` (the socket, read and parsed on a background thread, reconnecting by itself), `HoleScene.cs` (chunks into meshes, dressed by material name with `Dress.cs`; a real light per lamp; Label3D labels), `Live.cs` (the sun and sky by the game's hour as the web's `updateSky`, the ground, the HUD with the day, speed buttons, stocks and floor picker, keys), with `CameraRig.cs` from phase 1.

### Steps

1. Bridge and live viewer: the hole, furniture, lamps, day and night, speed and floor picking. **Done.**
2. People: colonists walking the galleries and corridors, at work and at home. **Done**, with a performance pass.
3. Picking and info: click a room for what it is and how it's doing. **Done.**
4. Building: place rooms, dig, corridors, from Godot. **Done**: rooms, corridors, bulkheads and windows.
5. Looks: materials and models made for Godot, graphics presets. Bryon, Oct 2: keep going; I took "grounded and textured, lighting calm" as the default.

### Status and next (Oct 4, 2026)

The viewer plays the whole game: every camera (Iso, Cutaway, Top, first person) and the plan with its overlays; building with the room card and effect halo, corridor chains, demolish and undo; the room panel; the HUD with its tooltips; office, charts, map, network and colony panels; the tutorial, help and settings; saves shared with the web.

Still to do, roughly in order of value:

- **Overlays in 3D** (they're plan-only so far; the web tints cells in 3D too: `render3d/stage3d.ts`, around `overlayType`).
- **The status line**: the web's bottom line saying what's under the pointer and what placing there would do (`ui/StatusBar.tsx`); Godot shows only key hints there.
- **Tutorial hints** come from `data/tutorial.json` and name the web's buttons ("View, at the bottom right"); they need wording for both.
- **Colour-blind colours** reach the plan's overlay and legend but not the build halo (`src/bridge/build.ts` `halo` uses `HEAT.normal`).
- **Sound**: none yet in Godot (the web has synthesized sound in `src/audio/`).
- Smaller: the trouble ⚠ badges are small; the interface-size setting hasn't been checked on screen; no first-person screenshot in the README yet (the shaft view is hazy).

### Testing the viewer

- **Never touch Bryon's own game.** His viewer's bridge runs on port 17878 and saves to `~/.downtown-mars/saves`. Test runs use `--port=7979` and `DM_SAVES=<a scratch folder>`, for example:
  `DM_SAVES=/tmp/x/saves godot-mono --path godot -- --port=7979 --load=save.json --view=iso --floor=2 --shot=10`
  The viewer starts its own bridge on that port. Afterwards stop it with `pkill -f "bridge.mjs --port=7979"`, and **wait a second or two before the next run**: a viewer that starts while the old bridge is still shutting down connects to it and gets an empty scene.
- **Flags** (after `--`): `--shot=<s>` saves `godot/shots/live.png` and quits; `--no-hud` hides the interface; `--new`, `--showcase=12`, `--load=`; `--view=iso|cutaway|top`, `--plan`, `--walk`, `--floor=`; `--overlay=noise`; `--build=<room>` or `--build=corridor:rock` puts a tool in hand; `--hover=x,y` and `--click=x,y` point and click in the scene.
- **Key playback** (`--keys=`, comma-separated, each `name@seconds`): key names (`B@8`, `F1@9`; letters type into fields), `tap:x:y` (a click through the GUI), `down:x:y`, `drag:x:y`, `up:x:y` (a drag), `move:x:y` (hover, for tooltips), `pan:dx:dy`, `pinch:f`, `wheel:up`.
- Test runs don't save settings (`ViewSettings.ReadOnly`), but they do read Bryon's, so pass the view you want on the command line.
- **Test saves**: make one with a small script under `scripts/` run by `npx tsx` (`createSimHost`, a `consoleShowcase` command, `stepWorld`, then `serialize` from `sim/save`), and delete the script afterwards. Topping up stocks every tick makes the HUD's rates absurd: top up once at the end.
- Godot's screenshots come from the viewport, so they include the HUD unless `--no-hud`.

### Notes as built

**Step 1** (Oct 2, 2026):

- Lamps: 955 on the showcase's floors below F4. Each light costs every pixel it might reach (37 → 50 fps without them), and a shadow pass per lamp redraws everything near it (51,000 draw calls and 2 fps with every lamp casting shadows). So, as the web's nearest-lamps pool, lamps light only on the floor in view, one floor above and two below, and the 8 nearest the camera within 40 m cast shadows.
- Furniture batches per item per floor rather than for the whole hole: 4,000 draw calls against 1,500, the same frame rate (draw calls aren't the limit now), and floors out of view drop out.
- Showcase (13 floors) cut at F4, Iso, by day: 39 fps at 1600×1000 on the M4 with SDFGI, SSAO, SSIL, volumetric fog and glow, about 5,000 draw calls (the sun's four shadow cascades redraw the scene). The effects are most of the cost; graphics presets come with step 5.
- With a floor picked the ground is hidden, as in the web view. Labels show the room's short name (`rooms3d.ts` now keeps the text on the sprite for the bridge).
- Fixed on the way, in the web game: the reflections' cave environment disposed a mesh with several materials as if it had one (`look.ts`), an error on every graphics change.

**Step 2** (Oct 2, 2026):

- **People** as the web's `people3d.ts`: the bridge works out who's at a work post, in a seat or in bed (the web's `occupied`, from the furniture's spots, the hour, each room's staff and the head count) and sends it when that changes, with the gallery tube runs. Godot (`People.cs`) draws the figures as three MultiMeshes (standing and lying, sitting, heads), clothes and skin per instance, and walks the gallery crowd itself, bobbing and swaying, every frame (0.4 ms of script a frame).
- **Measuring.** The bridge's `--hour=12 --speed=0` holds the game at noon; the viewer's `--bench=<s>` averages frames after an 8 s warmup and prints them with draw calls and triangles; `DM_FX=no…` (`Dev.cs`) turns things off one by one. Showcase, 1600×1000, M4, every effect on:

| Change | Iso F4 | First person F1 |
| --- | --- | --- |
| Start of step 2 | 26 fps | 19 fps |
| Furniture's far copy from 55 m (the web's: fewer facets, small parts left out, no shadow): 4.2M triangles a frame to 0.48M | 29 | 20 |
| Lamps static for GI, only the shadowed ones light the haze, lit on the floor in view and one below, GI at half resolution | 34 | 21 |
| Lamp reach as the web's (1.6× before), 4 shadowed lamps with two-pass (dual paraboloid) shadows, the sun's shadows in 2 cascades | 36 | 27 |
| Floor occluders (each floor's slab, from the picked floor down): 3,800 draw calls to 1,900 | 38 | 27 |

- **Where the time goes** now (first person): lamps about 14 ms with their shadows, SDFGI 8, SSIL 4, volumetric fog 4; with all of those off it's held at 60 fps (vsync). Chunks per floor and eighth of the ring changed nothing measurable, and neither did MSAA or the labels. So Godot's cost here is lighting quality, which graphics presets (step 5) can trade, and which a desktop graphics card has far more room for than the M4's.
- The bridge resets the picked floor when a viewer connects, and the viewer asks again if a scene comes for another floor.

**Step 3** (Oct 2, 2026):

- Click a room (a click, not a drag: under 5 px of movement) and the viewer sends the point where the pointer meets the floor in view (the picked floor in Iso, your own in first person); the bridge finds the room as the web view picks (`pickAt` in `cylinder.ts`), and sends its panel twice a second while it's open (`src/bridge/inspect.ts`): its name, type and floors, how it's running, staff, homes, what it makes and uses a day, condition, and its outline (the web's `outlineGeometry`), drawn over everything in Godot (`Inspector.cs`). Esc or × closes it.
- The inspector's state line ("Running at 40% · short of staff", "No access: connect it with a corridor") moved from `ui/Inspector.tsx` to `src/view/roomState.ts`, so the web and the Godot panel say the same.
- Test option: `--click=x,y` clicks there once the scene is up.
- Not yet: surface rooms (the pod, the pad, solar arrays) can't be picked; the web's inspector does much more (renaming, priority, crops, storage, windows, reach), which comes with building.

**Step 4** (Oct 2, 2026):

- **Build mode** (`BuildMode.cs`): B opens a strip of categories along the bottom (the web's, in order); each pops up its rooms, one line each with cost and hotkey, locked ones dimmed (the reason in the tooltip), two columns when there are many. A room in hand shows a ghost of its footprint where the pointer meets the floor in view (the surface, for surface rooms), green or red, with its cost and why not or what it does ("A blueprint: builds when its floor is dug"). Click builds; R turns it (cycles its shapes); Esc or a right click puts it down; with the strip open, a room's hotkey takes it in hand.
- **By the web's rules**, in the bridge (`src/bridge/build.ts`): the palette from `roomDefs` with `siteRefusal` and `missingCost`, sent when the gates or what the stocks can pay for change; hover and place use `pickAt`, `locationFor` (`view/interaction.ts`) and `checkBuild`, so placement, costs, blueprints and refusals match the web exactly. Building over corridors asks first (a Godot dialog), as the web's confirm. A refused command comes back as a toast.
- The palette's catalogue (categories in order, their names, room hotkeys, shapes) moved from `ui/BuildPalette.tsx` to `src/view/buildCatalog.ts` for both.
- The room panel gained **Connect** (carves corridors in rock to reach an unconnected room, as the web's) and **Demolish** (Cancel for a blueprint or a room being built).
- Test options: `--build=<room>` opens Build with it in hand, `--hover=x,y` points there.

**Step 5, surfaces** (Oct 2, 2026):

- **The web's procedural surfaces in Godot** (`godot/shaders/surfaces.gdshader`, chosen by material name in `Looks.cs`): rock strata, regolith, marscrete, brick and metal finishes, and rooms' floors by kind (planks, tiles, diamond plate, paving, concrete, with the web's colours, tints and sheen) under walls in the room's colour with a fine plaster grain, and the web's grime. Ported from `surfaces.ts`'s GLSL, plus two things the web doesn't do: each pattern's relief bends the light (bump mapping from the pattern's own slope, so grout, plank gaps, plate, seams and strata catch the lamps), and gaps are rougher than faces. Gallery tube ribs and rims take bolted metal; their floors marscrete. No cost measured (38 fps Iso, 28 first person, as before).
- The phase-1 noise materials (`Dress.cs`) remain for the rest (glass, doors, props, lamps), with a gentler bump: its cellular normal map is what made the tube rims look like gravel.
- Calmer air: the global haze at 40% of what it was and the shaft's at 40%, and the sun's shadows with more bias and some blur, which ends the jagged self-shadowing on walls at a low sun.
- Testing note: the bridge now says when its port is taken, rather than crashing, and the viewer takes `--port=<n>`; I test on 7979 so as not to touch a bridge you're running on 7878.

**Step 5, graphics presets** (Oct 2, 2026):

- `Graphics.cs`: four levels, F2 or the HUD's Graphics button cycles them, kept in `user://settings.cfg`; `--quality=low|medium|high|ultra` sets one for a run. Low: no GI, haze or ambient occlusion, no lamp shadows, FXAA. Medium: SSAO, 2 lamp shadows, MSAA 2×. High (default): SDFGI and the haze, 4 lamp shadows. Ultra: SSIL too, 8 lamp shadows, lamps lit a floor above and two below.
- Showcase (13 floors), 1600×1000, M4, at noon:

| Level | Iso F4 | First person F1 |
| --- | --- | --- |
| Low | 72 fps | 65 fps |
| Medium | 58 | 47 |
| High | 48 | 34 |
| Ultra | 41 | 30 |

- High moved SSIL to Ultra (4 ms for little to see), so the default is faster than step 4's everything-on (38 and 28).

**Step 5, furniture and first person** (Oct 2, 2026):

- Furniture's near copy has **chamfered edges** (1.5 cm, less on small parts; built at each part's real size so the bevel doesn't stretch): every box is 44 triangles, not 12, and its edges catch the light. The far copy stays plain. Iso on High: 47 fps as before (most furniture is far there).
- Furniture parts get **what they're made of**, as the web's `partTone`: wood grain, fabric weave, brushed and scuffed metal (more metallic), worn paint, soil; the material rides in each vertex's UV, and each varies roughness a little too.
- **A headlamp in first person**, as the web's: soft and warm, a little above and behind the eyes, no shadows. Without it unlit rooms were black.
- Rooms' outlines are hidden in first person (from above they help; up close they looked like dotted glitches on the floor).
- Test option: `--at=x,y,z,heading[,pitch]` stands there in first person.

**Fixes after Bryon's first run** (Oct 2, 2026): a gray screen with half the HUD. Docker on his Mac listens on port 7878, so with no bridge running the viewer connected to Docker, heard nothing, and (with no scene yet) had no camera. Now: the bridge's port is **17878**; the bridge says hello first and the viewer counts itself connected only once it hears it (else it says what's on the port isn't the bridge); the camera and sky are there from the start, with the waiting message in the middle of the screen; and the socket thread catches its errors (closing the window while connected aborted Godot).

**Walking** (Oct 2, 2026):

- First person walks by the web's rules (`view/walk.ts`): open ground (gallery tubes, corridors, public rooms, dug-out space) and rooms joined only through doorways, furniture in the way, stairs climbing a floor, steps sliding along whatever blocks them. Rather than port every rule to C#, the bridge samples them (`src/bridge/walkmap.ts`): the web's `regionAt` on a 15 cm grid over the floor, run-length encoded (a floor of the showcase: 25 KB, 0.3 s), with the furniture's footprints and the stairs' flights. The viewer asks for the walker's floor and those above and below, and again after the layout changes. `Walker.cs` ports `step`, `clear`, the stairs and `stairLift` against the grid.
- In first person, WASD walks (Shift runs) at eye height (1.7 m) over the floor, rising up the flights; until a map comes, it flies as before. The HUD says "on foot, floor N".
- Checked by script (`--stroll=<s>` walks ahead; test shots print where the walker is): from floor 1's gallery toward the shaft it stops at the railing; from the foot of a floor-2 flight it climbs (eye height between the floors partway) and comes off the top onto floor 1.
- The showcase keeps corridors off the stairwells' sides: their doorways left no room for the flight, so its stairs had none.

**Corridors, bulkheads and windows** (Oct 2, 2026):

- Build's Access category starts with the corridor tool (Z): a button per finish with its cost per 10 m, Bulkhead, Windows, and Erase (or hold Shift). Hovering shows the border's strip, green or red, with what it costs or why not; a click carves it (or fits the bulkhead, or glazes the wall); dragging paints corridors along every border crossed (a left drag then paints rather than turning the camera; a right drag still turns).
- All by the web's rules in the bridge (`build.ts`): the border nearest the pointer as the web finds it (`nearestEdge`), what the tool would do there (`edgeHoverFor`), and its command (`corridorCommand`). A click's refusal comes back as a toast; painting skips what it can't do quietly.
- With this, a whole game can be played from Godot: rooms, corridors, stairs, speed, and what each room is doing. Still only in the web: the office and visits, events, ordinances, charts, the network map, saving and loading (the bridge's `--load` takes a save file).

**Fixes after Bryon's second run** (Oct 2, 2026):

- *Walking through walls and furniture; changing floors didn't move the first-person camera.* Walking worked, but the walker stayed on its floor when a floor was picked, and picking one cuts the hole there, so after picking F4 you walked an invisible floor 1 under F4's rooms. Now in first person picking a floor (the picker, or ↑↓ from where you stand) takes you to its gallery; going into first person with a floor picked starts you on it; and first person shows every floor (the cut is for Iso, and comes back with it).
- *Clicking a room didn't work.* A click looked where the pointer meets the floor in view, which looking ahead in first person it never does. Now a ray finds the surface under the pointer (collision from the scene's solid chunks, made floor by floor as they come into view, since all at once took a second per rebuild), and the room is the one it hits (through a wall, the room behind it).
- *Build shortcuts.* They worked (B, then a room's key), but WASD, Q and E are room keys too (restroom, admin, solar, dorm, elder care, school) and also moved the camera, and L toggled labels instead of taking life support. As in the web, camera keys rest while the build bar is open, and room keys come first.
- The bridge forgets the room panel when a viewer connects.
- Test option: `--keys=Tab@3,W@4-7` presses keys as a keyboard would (at 3 s; held from 4 to 7 s), through Godot's own input.

**Saves and the game menu** (Oct 2, 2026):

- The bridge keeps saves as the web does (`src/bridge/saves.ts`): an autosave each new game day and three slots, each `{ data, summary, savedAt }` with `data` the web's own save file, as files in `~/.downtown-mars/saves` (or `DM_SAVES`; `--no-autosave` stops it). The autosave is the bridge's, so it happens whether or not a viewer is open.
- The viewer's game menu (`GameMenu.cs`; Esc when nothing else is open, or ☰ Menu): resume, save to a slot, load the autosave or a slot (each described as the web's menu does), new game (asks first), import a save file (the web's Export makes one; so does Godot's), export the game to a file, quit. The game pauses while it's open. A new game or a load resets the walker and closes the room panel.
- Checked: a slot saved and listed; the autosave written as a new day began; loading a slot put the game back.
- Known: a save's summary counts days from tick 0, not from the 6:00 start, so an autosave made as day 2 begins says day 1 (the web's menu does the same; it's the sim's `summarize`).

**Events and the office** (Oct 2, 2026):

- **Event cards** (`Choices.cs`), as the web's: one each at the top left, with its icon, text, a button per choice (its hint, or why not, and disabled then) and how long you have to decide, from the snapshot's pending events (the sim works out each choice's refusal). The game runs on.
- **The office**: an Office button in the HUD (amber, "Office · N waiting", when someone is) or O opens a panel on the right (it and the room panel take turns there): who's waiting, with their role, traits and loyalty, what they want, when they leave and the answers you can give (an answer that would enact an ordinance with no slot free is disabled); promises and how long is left; ordinances to enact or repeal against the slots; the notables and their loyalty. The bridge sends it (`src/bridge/office.ts`, laid out as `ui/Office.tsx`) when it changes.
- Checked by tapping through the UI (`--keys=…,tap:x:y@t` clicks a screen point as a mouse would): answering a noise complaint emptied the waiting room and left a promise; raising a toast to five floors brought up the next card.
- **News**, as the web's messages: the latest four from the last game day at the bottom right, coloured by kind (good, warning), fading as they age; rooms they name show as "Galley (F1)".
- With the colony panels below, everything the web game shows is in the viewer too (bar the 2D views and the web's dev tools).

**Charts** (Oct 2, 2026):

- A Charts panel (C, or the HUD's Charts button; it takes turns with the office and the room panel on the right), as the web's two: **Trends**, one series up close over 2 days, 10 days or the whole game, as amounts or change per day, drawn with its scale, reference lines ("people leave below") and the time span, its first-to-last and low and high under it, and every series below as a row with a sparkline, its value and its change, to pick from; and **Flows**, a tab per family (water, air, food, power, materials), each resource as a river from its sources through to its uses, with the share of water recycled.
- The bridge works the numbers out with the web's own code (`src/bridge/charts.ts`: `ui/trends.ts` for the series, points, scales' data and rows; sparklines thinned to 48 points), and Godot draws them (`Charts.cs`: line charts, sparklines and rivers drawn by hand). Refreshed every two seconds while open.
- The flow panel's rules (tabs, colours, what's shown, the recycled share) moved from `ui/FlowPanel.tsx` to `src/view/flows.ts` for both.

**Holes, the map and the network** (Oct 2, 2026):

- **More than one hole**: the HUD's title becomes a picker (each hole with its head count), and [ and ] step between them. The bridge keys everything it resends by hole (the scene, people, office, palette, walking maps) and closes the room panel when the hole in view changes; the viewer resets the walker, maps and camera. Each hole keeps its own time of day.
- **The map** (M, or the HUD's Map; `MapView.cs`): a globe wearing MOLA relief, built in Godot from `data/mars-elevation.json` with the web's colour ramp, shading and polar caps; the deposits you know painted on as the web's ellipses; named features (`data/mars-features.json`); your holes, convoys (dashed, with the convoy and its days left), trade routes with their rovers, and colonists on the move, as arcs and dots. It's drawn on a render layer of its own with its own camera, light and dark sky, far above the hole (the hole's camera and controls rest while it's open). Drag turns the globe, the wheel zooms, the bottom line says where the pointer is (place, height, the nearest feature, deposits), and a click picks a site: its report says where it is, what's in the ground (if scouted), how far each hole is by rover, and what founding a hole there still needs, with the button to send a convoy.
- **The network panel** (N, or the HUD's Network): every hole with its people and rovers, culture (where each hole is on each axis, and where it's heading), opinions, who's on the move, the trade routes with what each is doing (and × to end one), and a form for a new route from the hole in view.
- By the web's rules: what moved to `src/view/network.ts` (deposit styles, hole colours, a route's state in words, elevation, and the site report with its founding checks) is shared by the web's map and network panels and the bridge (`src/bridge/network.ts`), and the sim host gives the bridge the whole snapshot the web sees (`host.snapshot()`).
- Checked with a two-hole save (the tests' `twoHoles()`): switching holes, the map, a site's report, and starting a route from Bradbury to Gale (a rover set off carrying 22 metal).

**Scrolling with any pointing device** (Oct 2, 2026). Bryon uses a Magic Mouse: the web got scrolling from the browser (a wheel event's deltaX and deltaY, whatever the device), Godot doesn't. On a Mac a wheel mouse sends wheel clicks (WheelUp/Down/Left/Right, with a factor); a trackpad and the Magic Mouse scroll with phases, which Godot turns into pan gestures (two axes, smooth); a trackpad's pinch is a magnify gesture. The viewer only read wheel clicks, so on the Magic Mouse and the trackpad scrolling did nothing.

- `ScrollInput.cs` turns all three into the browser's terms (a scroll as dx, dy in pixels; a pinch as a zoom factor), and the views follow the web's rules with them: **Iso** turns with sideways scrolling and zooms with up and down (Shift turns instead) or a pinch; **the globe** spins with sideways scrolling and zooms with up and down or a pinch; **first person** ignores scrolling, as the web's. Panels' lists scroll on their own (Godot's ScrollContainer takes every kind).
- Godot hands each gesture to the scene twice (two copies, the same frame; wheel clicks come once), so a pinch zoomed twice as far: the copy is skipped.
- Checked by sending what each device sends (`--keys=…,pan:dx:dy@t,pinch:f@t,wheel:down@t`) and printing the camera: three steps of a trackpad's scroll zoom 64 → 100 m, a sideways one turns, a 1.3 pinch zooms by exactly 1.3, three wheel clicks zoom 64 → 110 m; the same on the globe.

**The colony panels** (Oct 2, 2026): a Colony panel (P, or the HUD's Colony; it takes turns on the right with the others) with the web's three as tabs: **People** (life stages as a bar, work, who's leaving, births and their three conditions, school, care, clinic and meals, the departed, who's moving on next), **Construction** (bandwidth and the queue, each job with its progress, when it'll be done, ⤒ to move it to the front and ✕ to cancel it) and **Maintenance** (overall condition, what each maintenance and cleaning room is repairing, and the queue worst first, with condition bars in the web's colours). Rooms named in them open their panel. The bridge writes them (`src/bridge/colony.ts`); the people panel's words moved from `ui/PeoplePanel.tsx` to `src/view/colony.ts` for both.

**Readable nights** (Oct 2, 2026): at night the scene went near-black (the sun down, the sky dark, and with SDFGI on Godot's ambient light barely reaching). Now the sky's night colours are a little warmer and brighter, the ambient light turns toward a dim dust colour as the sky darkens, and a faint shadowless light from overhead (the night's dust glow) fades in as the sun sets: the hole and the surface read at night, and lamp-lit rooms stand out.

**One command** (Oct 2, 2026): the viewer starts the bridge itself when nothing answers on its port after a moment (through a login shell, for Node on the PATH; its output in `~/.downtown-mars/bridge.log`), continuing the autosave (`--continue`), or with `--new`, `--showcase=N` or `--load=file`; `--no-bridge` only connects. On quit it tells that bridge to stop, and the bridge autosaves first (it does on Ctrl-C and SIGTERM too, when run by hand). A bridge you started yourself is left running. Checked: started from nothing, autosaved and stopped on quit, and the next start continued that colony.

**The moving parts: the drill rig** (Oct 2, 2026). The bridge builds the rig with the web's own `makeDrillRig`, braces it in the bore as the web places it, and sends it as a tree of parts with their transforms and meshes (`src/bridge/rig.ts`; the web's rig now names its moving parts and its lamp and beacon materials, `rig:head` and so on), again only for another hole or when the grippers brace. Godot (`Rig.cs`) rides it down with the dig front from the snapshot (half a floor below the sim's front, as the web's), stretches the hoist and power cables to the rim, and moves it as the web's `step()` and `strike()` do, at the game's speed: the cutterhead turns, the beacon spins, the reel pays out, spoil rides the conveyor, the lamps blink; a strike (a drill find) shudders it for three seconds with the lamps flaring. Its floodlights light the bottom of the shaft with a real light.

**Dust storms** (Oct 2, 2026), as the web's (`render3d/storm3d.ts` and the stage's `applyStorm`), in `Storm.cs`: the storm's strength eases toward the sim's at 0.8 a second; the sky thickens to murk (dusty by day, near black by night) over the hour's colours; the air hazes over (Godot's volumetric fog, from the calm day's density to a brown-out twenty times thicker, which the lamps light); the sun and ambient dim as before; and grit streams past on the wind as GPU particles in a box round the camera, thicker as the storm builds, dimmer by night, fading out within a few metres of the lens. Grit only from above with no floor picked, as the web's. About 39 fps on Ultra in a full storm. Daylight and the storm are now applied each frame (the storm eases in and out smoothly).

**Sparks and steam** (Oct 2, 2026), as the web's (`render3d/effects3d.ts`): the bridge sends the emitters, worked out by the web's own `emittersOf` (each furnace's mouth and scrubber's vent from the rooms' furniture, with how hard its room is running), when they change; Godot (`RoomEffects.cs`) runs the web's particle motion at the game's speed in a pool per kind, drawn as camera-facing soft dots in one MultiMesh each: sparks glow (additive), fly out of the furnace and fall; steam rises, swells in and thins away. Nothing from floors above a picked one.

**Festivals** (Oct 3, 2026), ported from the web's `render3d/festival3d.ts` (pure geometry, so straight to C#, `Festival.cs`): strings of coloured lights looped along every floor's gallery from the picked floor down, sagging between hangers, and ninety paper lanterns drifting up the shaft to the rim, swaying and flickering; in Godot six of them carry real warm light (which the haze catches) as they rise. Shown while the snapshot says a festival is on.

With these, the web's moving parts are all in the viewer: the rig, storms, sparks and steam, festivals.

**Views and toggles, part 1** (Oct 3, 2026). Bryon asked for the web's cameras (Iso, Cutaway, Top, First person) and the plan view, with walls down (not in first person) and room colours (every view); x-ray and flows skipped for now.

- A **View bar** under the stocks: Iso, Cutaway, Top, First person; Walls down, Room colours. The camera and both toggles are kept in `user://settings.cfg` (`ViewSettings.cs`); `--view=cutaway|top` picks a camera for a run.
- **Top** (`CameraRig.cs`): straight down the shaft from above the picked floor (or the surface), turned by the shared heading; fitted to the unlocked rings as the web's; scroll up and down or pinch to zoom, sideways or drag to turn.
- **Cutaway**: out past the rings looking in at the axis, the near half cut away; drag or scroll up and down moves along the hole, sideways turns, pinch zooms, W/S and A/D too. Godot has no global clip plane (three.js has), so the cut is a global shader parameter (`cut_plane`, in `shaders/view.gdshaderinc`) that every surface of the hole honours: the room and rock surfaces, furniture, people, sparks and steam, festival lights; the built-in materials still used in the hole (doors, props, glass, lines, the rig) moved to a small shader of their own (`Plain.cs`). Lamps and labels on the cut-away side go too. Round it, as the web's: a rock backdrop (the inside of a cylinder past the rings, `Cutaway.cs`) and the cut face where the ground is sliced, turned with the camera. The floor occluders rest in the cutaway (whole slabs would hide the floors below). 27 fps on Ultra circling the 7-floor showcase.
- **Room colours** off: the bridge builds the scene with the web's `roomColors` off (rooms in their finish: rock, marscrete, brick, metal), which `Looks.cs` already draws.
- **Walls down**, as the web's: the bridge sends each wall vertex's tag (rooms3d.ts `aWall`, `aWall2`: the wall's inward normal, bottom and top, and a line's second wall) with the scene's chunks, which carry them as custom vertex data; the room surfaces' and the plain shader lower a wall to a stub when the camera is on its far side (`lower_wall` in `view.gdshaderinc`, only on materials whose meshes have tags). Wall hangings carry their wall in their placements and are hidden when it's lowered (on the CPU, as the camera moves: furniture is instanced). On in every camera but first person.
- Test runs (`--shot`, `--bench`) no longer save settings (one had saved the cutaway camera and room colours off into Bryon's; put back).

**Views and toggles, part 2: the plan** (Oct 3, 2026). The plan view is the web's own drawing: its floor drawing moved out of the plan stage's closure into `src/render2d/planDraw.ts` (functions drawing onto a Pixi `GraphicsContext`; the web's plan stage calls them as before, and the web plan was checked unchanged). Pixi's `GraphicsContext` runs in Node and records what's drawn, so the bridge (`src/bridge/plan.ts`) draws the floor with it and sends the instructions (fills and strokes of polygons, circles, ellipses and rects, with colours, alpha and widths) and each room's marker (centre, name, and its icon, recorded the same way); 825 operations, about 150 KB and 13 ms for a floor of the showcase, sent when asked and again when the layout, the floor, room colours or the crews change. Godot (`PlanView.cs`) paints them on a canvas layer over the 3D view (which rests while the plan's up), through a transform (centred on the shaft; scroll or pinch to zoom, drag or scroll sideways to turn), with the icons and names upright; 60 fps. Clicking picks the room (the point under the pointer on the plan's floor, as in 3D), build and corridor tools work, and their ghost and the selected room's outline are laid flat over it. Room colours off works in the plan too (built rooms in their finish's colour; an option added to `planDraw.ts`, the web's plan always on). Construction hatching shows as a plain amber wash (Pixi's pattern needs a texture), and the web plan's overlays (effects, condition, reach) and construction percentages aren't drawn yet.


**The world's looks, part 1** (Oct 3, 2026). The land, the sky and the scenery, as the web's.

- **Terrain** (`src/bridge/terrain.ts`, `godot/src/Terrain.cs`): the web's own `buildTerrain` runs in the bridge for the hole's site and sends the ground (rolling regolith with its craters), the boulders (one shape and a transform each, a MultiMesh in Godot) and the horizon's mountains, mesas or hills, once per hole (about 2 MB). The ground wears the regolith look; boulders and horizon are flat-shaded (`Plain`'s new `flat` option).
- **Sky** (`shaders/sky.gdshader`): the web's sky as a sky shader: the dust gradient from horizon to zenith by day and night, the sun's bluish halo, hashed stars at night, and the storm's murk over it (`Storm.cs` sets its `dust`). Night ambient and glow light are cooler, and saturation eases at night, so the ground no longer glows red.
- **Scenery** (`godot/src/Scenery.cs`), as the web's `scenery3d.ts`: the Earth lander comes down onto the landing pad over the descent before a supply drop (when the pad's ready) or after an event's landing, its flame lighting the ground (a Godot extra); the glass dome over the shaft once it's built (a flattened half-sphere on twelve ribs, a ring at its foot); and 260 dust motes drifting down the open shaft. All three only from above, with no floor picked.
- **Rooms in trouble and the hover** (`godot/src/RoomTint.cs`), as the web's `showTrouble` and hover outline: a room slowed (staff, morale, the weather, an ordinance, worn) gets an amber outline and a ⚠ over its label, one short of what it runs on (or broken) red, a paused one grey; the room under the pointer is outlined in the web's hover colour (not the one in the panel, nor while building, walking or in the plan). Godot merges the outlines into chunks, so they're tinted on the GPU: the bridge tags each outline vertex with its room (`rooms` in a chunk, CUSTOM1.z in Godot), and the edge shader looks the room up in a small texture of trouble colours (the global `room_tint`) and compares it with the global `hover_room`. The bridge answers `{ type: "pick", at }` with the room there, asked a few times a second as the pointer moves. Outlines had never really shown in Godot (they lie on the wall caps and floors and lost the depth test, which three.js passes at equal depth): lines now come 4 cm toward the camera.

**Plan details** (Oct 3, 2026). The plan's overlay and construction progress, from the web's own drawing: `drawField` (the overlay's tints, or with none on a selected service's reach) and `progressLabels` moved from the web plan's closure into `render2d/planDraw.ts` (the web plan calls them as before; checked in the browser). The bridge records the field for the floor shown as a `planField` message (ops as the plan's, the progress labels, and "being dug, 40%: blueprints only" while the drill's on it), resent when the overlay, the effects, happiness, condition, the reach, the jobs or the drill change; the overlay comes with the `view` message. In Godot, an **Overlay** picker (Off, Noise, Smell, Health, Comfort, Air, Happiness, Condition) joins the View bar while the plan's up, with the web's legend, kept in the settings (`--overlay=noise` for a run); the plan paints the tints over the rooms and "45%" upright on each room being built. Rooms being built keep the plain amber wash for their hatching. The 3D view's overlays are still to come.

**The room panel** (Oct 3, 2026), as the web's inspector. Its text moved into `src/view/roomPanel.ts` (rows of a dimmed label and text, flagged as warnings: staff and flows; homes' residents and happiness; teaching, resting, elder care, sanitation, seats; windows; crowding; meals, care and amenities within reach; a service's reach; the neighbours' effects felt here; and the construction, condition-note, seed-kit and stop-at details), which the web's `Inspector.tsx` now renders and the bridge sends (`inspect.ts`, with the snapshot) along with the panel's controls. Godot's `Inspector.cs` makes its widgets once and fills in their values twice a second (not a field being typed in): ✎ renames (Enter or leaving the field keeps it, Esc drops it; empty goes back to the usual name); construction progress with Priority construction; condition as a coloured bar with who's repairing it; storage, a row per good (tick to give it the free space, or share it evenly with none left; the amount by hand; how full) and Share evenly; Connect with a corridor; a staging bay's seed kit; crop and priority pickers; Running and Stop at; Demolish or Cancel construction. Key playback (`--keys`) now types letters, for testing fields.

**Building, part 1: the room card and the halo** (Oct 3, 2026). The web's room card is now data (`src/view/roomCard.ts`: size, each cost and whether the stocks are short of it, and its lines with their tone), which `RoomCard.tsx` renders and the bridge's palette carries per room. In Godot it floats above the build popup for the room pointed at there, or the one in hand (its shape, and "R turns it" when it has more than one). The bridge's hover answer carries the halo, as the web's `drawHalo`: the room's strongest spreading effect previewed where it would go, cells banded by strength in the overlay colours; Godot draws the bands over the scene (and the plan, its floor's cells only). The bridge is type-checked with `tsconfig.node.json` (the main `tsconfig.json` leaves it out).

**Building, part 2: demolish, undo, and corridor chains** (Oct 3, 2026), as the web's.

- **Demolish** (X, or the strip's Demolish button): the room under the pointer outlines in red (the hover outline with the global `hover_bad`), and a click takes it down (the bridge's `demolishAt` finds the room at the point).
- **Undo** (⌘Z or Ctrl+Z, or the strip's Undo): the viewer keeps the rooms placed in this hole from the build results' `roomId`, and sends `undoBuild` for the last; one refused (too late) forgets the older ones too.
- **Corridor chains**: pressing with the corridor tool and dragging snakes a chain along the borders crossed, as the web's (`view/corridorPlan.ts` `extendChain`, kept in the bridge: `chain` with `start`, then as the pointer moves), drawn as strips (new in green, already there in pale, filling in red), in 3D and the plan. On release a chain of two or more asks to confirm with the web's wording (`view/corridorProposal.ts`, shared with `CorridorConfirm.tsx`: segments, length, work, cost or what's short) and Build/Fill in (Enter) or Cancel (Esc) answers (`proposalAnswer`: `drawCorridors` or `removeCorridors` for the lot); a single border is drawn as a click.
- Key playback gained `down:`, `drag:` and `up:` for testing drags.

**The HUD** (Oct 3, 2026), as the web's top bar and resource bar. Their content moved into `src/view/hudItems.ts` (each bar item's label, value, rate, warning or full storage, and its tooltip's title and notes; the drill, storm and supply drop), which the web's `ResourceBar.tsx` and `Hud.tsx` render and the bridge sends twice a second when it changes (`hud.ts`, with each item's two-day sparkline lines). In Godot (`HudBar.cs`): the colony (colonists with health, happiness with its afterglow, condition, workers, power), life, food and materials, wrapping onto a second line when the window's narrow; pointing at one shows the web's tooltip (health from oxygen, water, meals, sanitation and CO2; the happiness average, afterglow, low-morale slowdown and homeless; days left; storage full) with its sparkline, and clicking opens Charts → Trends on it. On the top bar: the drill's floor and progress with Pause/Resume drill, a coming (or blowing) dust storm, and the Earth drop countdown (amber while the pad's not ready). The side panels and event cards keep just under the top bar however tall it wraps. Key playback gained `move:`.

**The tutorial, Help and Settings** (Oct 3, 2026), as the web's. The tutorial's goals are the web's (`data/tutorial.json`, checked by `ui/tutorialGoals.ts` `CHECKS`) worked out in the bridge (`tutorial.ts`), the viewer saying what it saw that the sim can't know (`tutorialFlags`: the noise overlay picked, Flows opened; 3D is always seen here, so the intro shows until the first goal's met rather than until none is). The deputy's card (`Tutorial.cs`) sits bottom right with the goal, its hint and a dot per goal; – shrinks it to a pill, Hide puts it away (Settings brings it back). What the goal points at glows amber: the top bar's new Build button (or, with Build open, the room's category and button, or the corridor tool), the Office, the speeds, the Plan button or its overlay picker. **Help** (? or F1, or the menu's Controls): the general controls for this viewer and every room's build key, from the palette. **Settings** (the menu): autosave each game day (the bridge's daily autosave follows it: `autosave` message), colour-blind overlays (the plan's tints and legend), interface size (the window's content scale) and the graphics level, kept in `user://settings.cfg`. Sound settings wait on audio.

**A sharper Mars** (Oct 3, 2026). The map (web and Godot) now wears a shaded relief at 8 px a degree, 2880 × 1440, drawn once by `scripts/build-relief.mjs` from NASA's 16 px/degree MOLA grid (`MEGT90N000EB.IMG`) into `data/mars-relief.jpg` (1.7 MB): the same colour ramp, north-west light and polar caps the map always had, but with craters, Valles Marineris and the volcanoes' calderas showing. Both views load the image (the web's globe texture and Godot's go to 4096 × 2048); the game's own 1° grid (`data/mars-elevation.json`) still decides deposits and site reports, so saves and deposits are unchanged. In Godot, the map's panels follow the top bar down, and the event cards step aside while the map's open.

**Rock round the rings underground** (Oct 4, 2026, T-004), as the web's. With a floor picked (Iso, Top, Shaft) or walking below ground, `RockWall.cs` draws the inside of a rock cylinder just past the unlocked rings (where the cutaway's backdrop sits), from that floor's bottom up to the surface; walking, the whole hole's depth, since nothing's lifted away. Its material is a plain one culling back faces (the rock look's shader draws both sides), so a camera zoomed out past it sees through the near side. The cutaway keeps its own backdrop instead.
