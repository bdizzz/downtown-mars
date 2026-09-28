# Milestone 3 plan: the 3D cylinder view

Goal: deliver the design doc's "one model, two cameras". A Three.js view of the same hole, switchable with the 2D view at any time, that sells the feeling of a city carved into a shaft, and that you can build in, not just look at.

Decided Sep 27, 2026 (Bryon): milestone 3 is the 3D view. When the network map comes, its terrain will be NASA MOLA elevation data, downsampled into `data/` (download to be confirmed at the time).

## Rules

- **The sim doesn't change.** 3D is a second face reading the same snapshot; no sim code learns about cameras.
- **Same coordinates.** A cell at (floor, ring, slot) becomes an annular wedge: angle from the slot, inner radius `R + (ring − 1)·d`, outer `R + ring·d`, one floor tall. The math lives in one module with tests, shared by drawing and picking.
- **Same tools.** Build, demolish, select, overlays, halo preview and hover info work identically in both views, through one view interface. The React UI doesn't care which view is showing.
- **Degrade gracefully.** No WebGL, or a slow machine: the 2D view keeps working and 3D says why it's off.

## Defaults (chosen, not yet confirmed)

- **Floor height:** 4 m per floor (rooms are 10 m deep and 10 m wide), in `data/config.json`.
- **Camera:** starts inside the shaft, looking at the wall, the way a colonist on the gallery sees it. Orbit around the shaft axis, move up and down floors, zoom in and out. A "look down the shaft" preset.
- **Seeing deeper rings:** rooms in rings 2+ sit behind ring 1. Two ways to see them: an **x-ray** toggle that makes rock and outer walls translucent, and a **cutaway** that slices the cylinder open along a vertical plane you can rotate.
- **Look:** category colours as in 2D; lit shaft windows; night makes the rooms glow; the surface is a disc of ground with the pod, pad and solar panels, and the sky above follows the day.
- **Toggle:** a 2D/3D switch in the HUD and the V key. The choice is remembered.

## Steps

1. **Scaffold.** Three.js in the view area, 2D/3D toggle (button and V), shared view interface, the empty hole: shaft, gallery ledges, floor slabs, rock, surface disc, sky. Orbit/up-down/zoom camera. *See:* fly around an empty hole in 3D.
2. **Rooms in 3D.** Cell geometry math with tests; rooms as wedges in category colours; blueprints translucent; stranded rooms outlined; corridors; the floor being dug with its dig front; surface props. *See:* your colony in 3D.
3. **Seeing inside.** X-ray and cutaway modes, shaft-view preset, fading the rock nearest the camera. *See:* rooms in rings 2 and 3.
4. **Picking and building.** Raycast to (floor, ring, slot); hover info, ghost, halo, build, demolish, select and paint corridors in 3D, through the same tools as 2D. *See:* build a colony without leaving 3D.
5. **Overlays and light.** Effect and happiness heat maps on rooms, day/night sun, glowing windows at night, the lander coming down. *See:* the noise halo in 3D; night falls.
6. **Life and polish.** Tiny colonists walking the gallery, dust in the shaft, instanced geometry for speed, a quality setting, WebGL fallback. *See:* a lived-in hole that stays smooth at 40 floors.
7. **Tests and performance pass.** Geometry and picking tests, a 40-floor stress check, frame-time budget, tutorial and help updated for 3D. *See:* a solid second camera.

## Notes as built

**Step 1, scaffold:** shared view types moved to `src/view/types.ts` (Tool, HoverInfo, Pick, StageOptions, Stage); the 2D stage and the new `src/render3d/stage3d.ts` both implement `Stage`, and `src/ui/ViewHost.tsx` (was PixiView) creates whichever is chosen. `src/render3d/cylinder.ts` is the Three-free source of truth for 3D positions: slot angles, ring radii (10 m per ring from the shaft wall), floor spans (4 m floors down from y = 0) and `pickAt`, the inverse; tests check every cell round-trips and that 3D and 2D agree on which slot is at an angle. The empty hole draws the shaft wall as one face per ring-1 slot per floor (so rooms can replace faces later), gallery ledges with railings, the floor being dug, the surface and a sky that follows the day. The camera stands in the shaft looking at the wall: drag to turn and move up and down, scroll to change floors, pinch or ctrl+scroll to step closer or back; above ground it tips down into the hole. A warm lamp travels with the camera so the shaft reads at night. The HUD button and V switch views; the choice is remembered; if 3D can't start (no WebGL) the game says why and returns to 2D.

**Step 2, rooms:** `src/render3d/rooms3d.ts` builds everything that depends on the layout: each room is one solid made of its cells' wedges without the faces its own cells share (tested); the shaft wall is drawn only where no built room replaces it; ring-1 rooms show a window band and a door to the shaft; labels float in front of each room; blueprints are translucent; stranded rooms get red outlines; surface props (domed pod, pad, tilted solar panels) stand 16 m back from the rim. The floor being dug has a glowing dig front that sinks as the drill works. Filmic tone mapping and gentler light keep the category colours readable. The 3D code loads only when first used. For manual testing, a day-15 save from the scripted player can be written to `public/dev-save.json` (git-ignored).

**Step 3, seeing inside:** a camera toolbar owned by the 3D view (top left) switches between **Shaft** (standing in the shaft), **Free** (added after: the camera stays on the shaft's axis and dragging aims it anywhere, all the way round and from straight up to straight down; scroll moves along the shaft, pinch or ctrl+scroll narrows the field of view; switching in from Shaft keeps your heading; picking works as in Shaft), **Cutaway** (orbiting outside; a clipping plane through the shaft's axis removes the half nearest the camera, with a rock backdrop sized to the unlocked rings behind) and **Top** (straight down the shaft; dragging turns the view). **X-ray** makes the shaft wall, ring-1 rooms and the planet's surface translucent, so rings 2 and 3 show from the shaft and the whole colony shows from above; in x-ray the surface only takes clicks when placing a surface building (or when nothing below was hit). The toolbar shows the current floor. Mode and x-ray are remembered. Rooms are inset 6 cm on every outside face so neighbours never share a plane: that removed flicker between touching rooms and reads as thin walls. A camera-attached fill light lights the outside views; the headlamp is only on in the shaft.

**Step 4, building in 3D:** the rules that turn a pick into hover info and actions moved to `src/view/interaction.ts` and both views use them, so building, demolishing, selecting, invalid-click messages and corridor painting behave identically. `src/render3d/pick3d.ts` holds the tested ray math (cylinder, plane, "step just past the hit and ask what's there"). What you can pick depends on the camera: in the shaft, the wall and the rooms on it (ring 1); with x-ray, rooms behind ring 1 and ring 2's cells; in the cutaway, rooms on the far side (hits on the sliced-away half are ignored) and any cell on the section, which is how rings 2 and 3 are reached; in every mode, the ground and surface props for surface buildings. The ghost, halo (the room's strongest effect, banded by strength), hover and selection outlines draw over everything so they're never hidden inside a room. A mode-dependent near plane fixed roofs showing through the ground in far views. Heat-map colours moved to the shared palette.

**Step 5, overlays and light:** the overlay picker now works in 3D. Effect overlays tint every cell of the dug floors in the unlocked rings, grouped into strength bands (one mesh per band) and drawn just proud of the cells so they show in front of the rock; happiness tints homes (and a disc under the pod). At night the shaft windows glow and warm lamps along every gallery railing light up (one instanced mesh for the whole hole). The Earth lander (`src/render3d/scenery3d.ts`) descends onto the pad with a flame in the hours before a drop, like the 2D one.

**Step 6, life and polish:** colonists walk the gallery ledges (one per three colonists, up to 60, one instanced mesh; they stop when the game is paused) and dust drifts down the open shaft; both are cosmetic and use their own seeded scatter, so the sim stays deterministic. Ambient animation runs at up to 30 fps. A **3D detail** setting (High/Low) trades full-resolution rendering, walkers and dust for speed on slow machines. Pixel ratio is capped at 2. If the browser drops the WebGL context, the game says so and switches to 2D.

**Step 7, tests and performance:** a stress colony (40 floors, rings 1–3 full: 1,296 rooms) was loaded in 3D and timed with a dev-only hook (`window.__stage3d` in dev builds: `measure()` renders once and waits for the GPU). Frames: median 1.3 ms in the shaft, 3.4 ms in cutaway, 9.5 ms from the top, against a 16.7 ms budget; the first frame after switching modes can take up to ~200 ms while shaders compile. Layout rebuilds were ~200 ms, a visible hitch on every build; label materials are now shared by text and room solids and outlines are cached between rebuilds (freed when unused), bringing rebuilds to ~30 ms. The first build of that colony on load is ~0.6 s. The tutorial gained a last goal, looking at the colony in 3D, and the README covers the 3D view. Tests cover cell geometry, 2D/3D agreement, room solids, and ray picking (119 in all).

## Still to decide

- Whether 3D should become the default view once it has been playtested.
- Real art for rooms in 3D (see `docs/ART.md`); the current look is code-drawn.
- Shader warm-up on mode switches, if the one-time hitch bothers playtesters.

**Later addition (Sep 27, Bryon): floor selector and plan view.**
- **Floor strip:** a strip of floors beside the Plan and 3D views ("All" plus each dug floor, and the one being dug). Page Up / Page Down step through it. The choice lives in the app, so it carries between Plan and 3D.
- **3D:** picking a floor removes everything above it: shallower rooms (tall rooms keep their lower part), the shallower gallery ledges, the surface and its props, lamps, walkers and the lander. A rock cap covers the chosen floor's empty cells (carved, locked, and solid rock past the last ring), with hairline slot edges. The Top camera looks down from the same height above that floor's ceiling. The cap is pickable, so empty cells can be built on from above, and the surface isn't picked while it's hidden. The readout says "Floor N from above" or "Floor N and below".
- **Plan view:** a third view (`src/render2d/plan.ts`, PixiJS) that draws one floor from above: the open shaft, the gallery ledge, every ring as a band of slot wedges (locked rings darker, the 0° seam marked), rooms as filled sectors with outlines, glyphs and labels, and disconnected rooms in red. It uses the 3D view's metres and `pickAt`, so slots sit where they do in the 3D top view. Hover, ghosts, effect halos, painting corridors, building, demolishing, selection and overlays all go through the shared interaction rules. It fits the carved rings on screen until you pan or zoom; drag pans and pinch or ctrl+scroll zooms. Surface rooms still need the Unrolled or 3D view.
- The HUD's view button became a three-way switch (Unrolled, Plan, 3D), and V cycles through the three.

**Follow-up, walls down (Bryon, Sep 27):** a **Walls down** toggle on the 3D camera toolbar, remembered with the mode and x-ray, like The Sims' cutaway walls.
- **Which walls:** a wall is in the way when the camera sees it from behind, meaning it stands between the camera and the room (or, for the shaft wall, the shaft) it bounds. Those walls drop to 15% of their height (`WALLS_DOWN.stub`). All others stand, so from the shaft you see into every room, and in the Cutaway you see into rooms on the far side.
- **How:** every room wall, the shaft wall, and the windows and doors carry an `aWall` tag per vertex: which side the room is on, and the wall's base and top. A small vertex-shader patch on those materials squashes a wall that's in the way down to its stub as the camera moves, so there's no rebuild per frame. Each curved segment uses one normal, so a segment drops as a whole. Windows and doors go down with their wall.
- **Outlines** know which walls each line borders. A corner line only drops when both of its walls are down. Hover and selection outlines, and the heat-map tints, drop with the walls.
- **Picking** goes through a lowered wall to the floor behind it (`loweredAt`).
- **Tests:** tags point into the room and floors carry none; outlines along a wall's top carry that wall; a wall is lowered only when seen from behind, and only above its stub.
- **Browser check:** Shaft and Cutaway views, walls up and down.

**Follow-up, Iso and First person (Bryon, Sep 28):** two more modes on the 3D camera toolbar.
- **Iso:** above the picked floor (floor 1 if none is picked), and off to one side. It looks across the floor, a little past its centre, from 1.6× the floor's radius at about 43°, so the whole floor is in view.
  - Everything above that floor is hidden, as when a floor is picked. The stage now separates the picked floor (`pickedFloor`) from what's hidden (`cut()`).
  - Drag turns it and tilts it (30°–80°). Scroll zooms; Shift+scroll turns.
- **First person:** eye height 1.8 m above a floor, starting on the gallery of the floor you were looking at, facing along it.
  - **Controls:** WASD or the arrow keys walk (3 m/s, 7 with Shift), and dragging turns the head. Clicks act on what's under the pointer, as in every view.
  - **Keys:** while walking, these keys are caught before the rest of the app sees them, so W doesn't pick a room.
  - **Where you can walk:** the gallery (not over the railing), public rooms, empty space, and bands along built corridors. Private rooms and rock are behind walls, and a walker slides along them rather than stopping dead. The rules live in `src/view/walk.ts` (tested in `tests/walk.test.ts`).
  - **Stairs:** standing in stairs or an elevator, Q goes up and E goes down to the floors it reaches. The readout says which.
  - **No pointer lock:** it isn't available everywhere (not in the in-app browser), so looking is by dragging.
- **Browser check:** Iso on floors 1 and 2, with and without walls down. Walked floor 1's gallery in first person until the wall stopped the walker.
- **Changes (Bryon, Sep 28):**
  - **Turning and stairs:** Q and E turn left and right (1.8 rad/s while held). Stairs moved to R (up) and F (down).
  - **Mouse look:** Tab toggles it, where the browser allows pointer lock. The pointer is locked to the view, the mouse turns the head, a crosshair marks the centre, and clicks land there. Tab or Esc stops it.
  - **No building while walking:** the stage tells the app (`onWalking`), which hides the build palette, clears the tool, and ignores the build shortcuts (room keys, C, X, R rotate). Selecting rooms, the map, views, holes and floors still work.
  - **Iso is the default:** Iso is the 3D camera's default mode, and new players start in the 3D view. A saved choice still wins.
  - **Fix:** a stage that React's development double mount throws away no longer reports "not walking" after the real one says it is. The view host reports it when it tears a stage down.
- **More changes (Bryon, Sep 28):**
  - **Iso** comes first on the camera toolbar. Scrolling sideways turns the hole, as in the cutaway.
  - **Walls down also clears neighbours:**
    - **Rule:** a wall now comes down if it hides its own room (seen from behind, as before) or if there's something to see across it: a neighbouring room, empty space, a corridor, or the gallery. Such a wall hides that neighbour from its own side, so it comes down from either side.
    - **Rock:** a wall with only rock behind it comes down only when it hides its own room, so a floor keeps its outer outline.
    - **How:** each wall segment asks what's just past it, so a wall facing two cells in the next ring can be half down. It's tagged by a doubled normal, read by the shader and by picking. Windows count the gallery as behind them. A room's cached shape now depends on what's around it.
    - **Tested:** an outer wall with a room behind it comes down from inside the room; the inner wall, with rock behind, stays up.
    - **Browser check:** Iso, walls up and down, before and after a sideways scroll.
