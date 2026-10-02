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
4. Building: place rooms, dig, corridors, from Godot. **Rooms done** (corridor drawing, windows and bulkheads not yet).
5. Looks: materials and models made for Godot, graphics presets. Bryon, Oct 2: keep going; I took "grounded and textured, lighting calm" as the default.

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

