# Art direction

What the game should look like, written so the code-drawn placeholders in `src/render2d/art.ts` and `stage.ts` can be swapped for real art without changing how the view works.

**As built (Sep 30, 2026):** the art direction is settled as the **cozy 3D look**, and 3D is the main view. Rooms are code-built models, furnished from templates (`docs/FURNITURE.md`, `PLAN-M10.md`), with soft shadows, glow round lit windows and lamps, a warm haze swallowing the floors below, a miniature-style blur in Free view and a warm colour grade. Floors, materials and grime suit each room; grime follows the room's condition. Screens flicker, lights blink, fires dance, plants sway, windows fog. The sky, dust storms and terrain follow the site and the hour. The UI and all labels use Space Grotesk. The shaft is open to Mars: gallery tubes (glass walls and roof on ribs, a railing, a lamp strip) hang along the shaft wall where they're built; elsewhere a ring-1 room's shaft face is a wall of windows nearly floor to ceiling. Bulkheads are dark door frames with a gold door and an orange band across a corridor. The shaft dome is a low, ribbed glass dome over the shaft at the rim; under it the galleries are open ledges with railings. Audio is still open: today's sound is synthesized placeholder effects and a hum (`src/audio/sound.ts`). The 2D sections below were the first proposal; the readability rules still hold.

## Mood

A warm, lived-in city inside a cold, rusty planet. SimTower's cutaway clarity, with Frostpunk's lamplight against the dark. Chill, not grim.

- **Outside is cold and vast.** Dusty rust ground, a butterscotch day sky that falls to a violet-black night full of stars. Hills are silhouettes, never detail.
- **Inside is warm and small.** Rooms glow in category colours against dark rock. Light spills from shaft windows.
- **Underground views are closed in by rock (Oct 4).** With a floor picked (or walking), a wall of rock rings the unlocked rings, from the floor in view up to the surface, so the view ends at rock, not open distance. Only its inside is drawn: zoomed out past it, it never hides a room. In Free view the planet reads as a ghostly cut-out round the floor: the land is sliced square to the camera along the line where the rings look widest from it (where its sightlines graze the rock wall, a little nearer the camera than the axis), so the far side stands with its surface and a rock face down to the floor, meeting the wall at its visible edges, while the near side is cut away down to the floor (the cutaway's cut face, outside the rings only, without bisecting the colony). Land and cut face are solid by the rings and thin out in a fine stipple into the dark earth over the next 40 m or so; where the land meets the cut, both crumble raggedly over a few metres rather than meeting on a ruled line; the cut rock (the faces and the wall) darkens toward the earth the deeper and further it goes, so it recedes as the floors below do; the ground at the floor's level past the rings fades with the land, so far off, above and below the horizon, there's only the one dark backdrop; picking a floor dissolves the cut-out open over half a second rather than snapping.
- **The shaft is the showpiece.** Ring 1 windows face it; the gallery railing frames it. A future 3D view looks down it.
- **Room-colour mode tints, never retextures (Oct 8, T-076).** With room colours on (View), walls and floors take the room's category colour, but a floor keeps the same texture as with them off: the room's material and finish (and, later, its flooring), only tinted 40% of the way to the category colour. There are no per-kind floor patterns, so toggling room colours changes a floor's tint and never its texture.
- **Room linings (Oct 8, T-034).** A room looks like what its walls are lined with (`room.material` and `finish`, PLAN-M15), not what its build cost uses most: every room is bare rock until it's refitted. Each step is a procedural surface in `render3d/surfaces.ts`, the floor following the walls. **Bare rock:** the strata, as before. **Smoothed rock:** the same strata ground flat and sealed (softer contrast, a sheen), polished flagstones underfoot. **Brick:** running bond, square tiles underfoot. **Patterned brick:** banded courses (every third a shade darker) with an accent band of dark upright bricks at waist height, basket-weave pavers underfoot. **Metal panels:** bolted steel panels with seams and rivets, diamond plate underfoot. **Inlaid metal:** lighter panels with a darker inlay band at shoulder height (brass diamonds between brass trim), brass strips along the floor plates' seams. Rooms that can't have a lining (the entrance, stairs and lifts, empty rooms) keep their type's material. Corridor floors use the same surfaces as their finish (a brick corridor and a brick room match). **While a room is being refitted** a band of hazard stripes runs along the tops of its walls (over its colour or lining, and its grime), with the queue's % label over it.
- **No wood (Oct 5, T-009).** There are no trees on Mars, so nothing looks wooden. Floors follow each room's material and finish, and fibre-composite floor panels become an upgrade (F-003). Furniture frames, beds and cabinets are fibre composite (`fibre`, a fine twill under matte resin), not wood grain.
- **A miniature (Oct 9, T-078).** Free view has a tilt-shift look: a depth of field focused on what the camera orbits, so the floor in view stays crisp and nearer and farther things (the near rim, the far rooms, the rock wall, the land above) soften the farther they are from it, with a touch more colour, like a photo of a model. It's depth-based, so it stays right as you tilt, and soft, with a wide sharp band: most of the floor in view stays crisp, only its far and near edges and what lies beyond them soften. **Room labels, alert badges and construction progress are never blurred**: on the web they're drawn after the blur (`render3d/labelLayer.ts`), still hidden behind what stands in front of them; in Godot the floor in view's labels are drawn by a second camera over the blur, and other floors' labels stay in the scene. Gentle by default (Settings → Display → Miniature blur: High 40%, Medium 30%, off on Low), so far labels stay legible; the slider runs to a strong, obvious miniature. Never in Cutaway or first person. On the web it's a post pass (`render3d/tiltShift.ts`: blurred at half and quarter size, mixed per pixel by distance from the focus); Godot uses the camera's own depth of field (`CameraRig.cs`), tuned to match.
- **Light (Oct 1):** by day the sun falls down the shaft and the rim throws a crescent of shadow into it (the sun shines harder there, since rock keeps it out of the rooms); shiny things reflect a warm lamp-lit cave, not a studio: metal floors take a sheen, brick and marscrete hardly any. Lamps don't cast shadows yet: the rooms are lit mostly by fill light and the camera's lamp, so lamp shadows would barely show (and would cost a lot while walking) until room lighting is redesigned.

## Readability rules

These matter more than style, because the game is a placement puzzle.

1. **Category colour is sacred.** Every room's fill is its category colour (`src/render2d/palette.ts`), so a glance reads "that floor is all water and air". Art may add texture and light, but the hue family must survive.
2. **One glyph per room type,** in a single ink colour, readable at 20 px. Glyphs say what a room *is*; labels say which one.
3. **Frontage is auto-tiled from neighbors,** never hand-placed: shaft windows on ring 1, a door wherever a face meets a corridor, plain wall against other rooms. Future art needs a tile for each face type and each room size.
4. **Overlays sit on top of the art,** so art must stay mid-value: no pure black or white fills that would swallow a red or green heat-map tint.
5. **Blueprints are outlines,** translucent fill in the category colour. Stranded rooms get a red outline and a warning mark.
6. **Walls are solid, 0.25 m thick** (`wallThicknessM` in `data/config.json`), centred on the edge line: one wall between two rooms (each builds its half), and the same thickness along corridors, gallery tubes and rock, so a room gives up 0.125 m on each walled side. Wall tops are always bare rock, whatever the room is built from or coloured, and doors and windows cut through them with reveals (T-001).

## The icon set

One small set drawn for the game (T-089), in `src/view/icons.ts`: the top bar and the resource grid use it on the web (`ui/Icon.tsx`), and the Godot viewer gets the same SVGs through the bridge and tints them (`godot/src/Icons.cs`).

- **A 16-unit grid, a 1.5 stroke,** round caps and joins, drawn in one colour (`currentColor`), so each reads at 16–20 px and takes the colour of the text beside it. Only small solid details (the bolt, dots, the arrows) are filled.
- **Shape first, colour second:** every icon is its own silhouette (a drop for water, a bowl for meals, a sprout for raw food, a chip for electronics), and a cell's state shows in its frame as well as its colour (dashed amber a worry, solid red trouble, dotted blue full), so nothing depends on telling red from green.
- **Names live in tooltips:** the bar shows the icon and number; pointing (or a screen reader) gives the name.
- Adding a resource means adding its icon under the same id; the tests check every one shown has its own.

## Palette

| Use | Colour |
| --- | --- |
| Rock | `#2a1510` |
| Ground | `#7a3b22` |
| Day sky | `#c98a5e` |
| Night sky | `#120a14` |
| Accent (UI, dig front, seam) | `#e07a3f` |
| Shaft windows | `#9fd2ff` |
| Housing / Food / Water / Air | `#6f93bd` / `#86ad58` / `#4f9fc8` / `#8cc8cf` |
| Health / Admin / Power / Logistics / Access | `#d48092` / `#c9a456` / `#e0bf4a` / `#a08fb0` / `#9a8574` |
| Excavation / Industry / Public / Construction / Storage / Services | `#7a6a5e` / `#b48a6a` / `#d9a870` / `#d98c3a` / `#9c8a6a` / `#5aa89c` |

## What a real artist would make

- **Room interiors** per type and size (S, M, L; wide and deep variants of L), with 3–4 frames of idle life: steam from the galley, a turning fan in life support, sprouts that sway in farms.
- **Frontage tiles:** shaft window strip, gallery door, side door, top and bottom door, plain wall, corner pieces, storefront (for later shops).
- **Surface props:** solar arrays (tilting with the sun), landing pad with lights, the pod, lander with a landing plume, rovers later.
- **Colonists:** tiny figures walking the gallery and corridors, more of them when busier. Purely cosmetic.
- **UI:** a condensed technical sans for numbers, warm panels, one accent colour. (Built: Space Grotesk throughout.)

## Audio (for step 6)

Soft and diegetic: the hum of life support, a distant drill, the thump of a supply drop, a two-note chime when someone waits at the office. No music at first; a sparse ambient bed later.
