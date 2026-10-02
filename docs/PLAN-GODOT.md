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
2. People: colonists walking the galleries and corridors, at work and at home.
3. Picking and info: click a room for what it is and how it's doing.
4. Building: place rooms, dig, corridors, from Godot.
5. Looks: materials and models made for Godot, graphics presets.

### Notes as built

**Step 1** (Oct 2, 2026):

- Lamps: 955 on the showcase's floors below F4. Each light costs every pixel it might reach (37 → 50 fps without them), and a shadow pass per lamp redraws everything near it (51,000 draw calls and 2 fps with every lamp casting shadows). So, as the web's nearest-lamps pool, lamps light only on the floor in view, one floor above and two below, and the 8 nearest the camera within 40 m cast shadows.
- Furniture batches per item per floor rather than for the whole hole: 4,000 draw calls against 1,500, the same frame rate (draw calls aren't the limit now), and floors out of view drop out.
- Showcase (13 floors) cut at F4, Iso, by day: 39 fps at 1600×1000 on the M4 with SDFGI, SSAO, SSIL, volumetric fog and glow, about 5,000 draw calls (the sun's four shadow cascades redraw the scene). The effects are most of the cost; graphics presets come with step 5.
- With a floor picked the ground is hidden, as in the web view. Labels show the room's short name (`rooms3d.ts` now keeps the text on the sprite for the bridge).
- Fixed on the way, in the web game: the reflections' cave environment disposed a mesh with several materials as if it had one (`look.ts`), an error on every graphics change.

