# Downtown Mars

*Hole sweet hole.*

A real-time city builder on Mars. Each city is a borehole: dig a shaft down, carve rooms into its walls in rings and floors, and keep everyone breathing, fed and sane. Rooms affect their neighbors, so where you put the noisy life support matters as much as whether you build it.

This is an early playtest build: a hole or two, the first hour or so of play. Total population supported is your score.

## Playing

Start a new game and follow your deputy's tutorial, or dive in:

- **Build:** pick a room on the left (or press its key), then click a slot. Green means it fits; red says why not. Ring 1 opens onto the shaft; deeper rings need a corridor.
- **Watch the bar at the top:** oxygen, water, meals and power, with how fast they're changing. Red means it runs out in under two days.
- **Earth** sends supply drops every few days until you can stand on your own.
- **Office:** colonists visit with problems. What you promise, they remember.
- **Overlays** (bottom left) show noise, smell, health, comfort and happiness. **Flows** (top) shows where every resource comes from and goes.
- **More holes:** once the network reaches 50 colonists the map opens. Build a staging bay to gather a seed kit, pick a site on the Map (M) and send a convoy. With two holes, a **rover depot** gives a hole 2 rovers, and the **Network** panel sets up trade routes between holes.
- **3D view** (V): stand in the shaft, look anywhere from its centre with **Free** (drag to aim), slice the hole open with **Cutaway** to reach rings 2 and 3, or look straight down from the **Top**. **X-ray** fades ring 1 so you can see behind it. Everything you can do in 2D works in 3D.

### Controls

| Key | Action |
| --- | --- |
| Space | Pause / resume |
| Esc | Cancel, close a panel, or open the menu |
| R | Rotate the room you're placing |
| C D G F T Y W L K A B S P | Corridor, dorm, galley, farm, tank, recycler, restroom, life support, clinic, admin office, battery, solar, landing pad |
| U O H I N | Deep well pump, smelter, machine shop, silicon refinery, electronics fab (some need the right site) |
| M | Map of Mars |
| [ ] | Previous / next hole, once you have more than one |
| X | Demolish |
| V | Switch between the 2D and 3D views |
| ⌘Z / Ctrl+Z | Undo your last placement |
| ? | Controls help |
| Drag / scroll | Pan (drag paints corridors with the corridor tool) |
| Pinch / Ctrl+scroll | Zoom |

The game autosaves every game day in your browser. Use the menu to save to a slot or export a save file to keep it somewhere safe.

## Developing

Requires Node 20+.

```bash
npm install
npm run dev        # play at http://localhost:5173
npm test           # simulation tests
npm run playtest   # scripted first month, printed day by day
npm run package    # build and zip for a playtest upload
```

`npm run package` writes `release/downtown-mars-v<version>.zip` with `index.html` at the top. To publish on itch.io: create an HTML project, upload the zip, and tick "This file will be played in the browser". Nothing is uploaded automatically.

Design documents live in `docs/`: start with `DECISIONS.md`, then `DESIGN.md` and the catalogs. Build plans are `docs/PLAN.md` (milestone 1) and `docs/PLAN-M2.md` (milestone 2). `CLAUDE.md` has the architecture rules: the simulation is pure TypeScript in a Web Worker, deterministic, with all numbers in `data/*.json`.

## Credits

Mars elevation: NASA Mars Global Surveyor, Mars Orbiter Laser Altimeter (MOLA) Mission Experiment Gridded Data Record `MEGT90N000CB` (PDS Geosciences Node), public domain. `scripts/build-elevation.mjs` averages it to 1° for `data/mars-elevation.json`.
