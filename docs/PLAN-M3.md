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
