# Downtown Mars

*Hole sweet hole.*

A real-time city builder on Mars. Each city is a borehole: dig a shaft down, carve rooms into its walls in rings and floors, and keep everyone breathing, fed and sane. Rooms affect their neighbors, so where you put the noisy life support matters as much as whether you build it.

This is an early playtest build: a hole or two, the first hour or so of play. Total population supported is your score.

## Playing

Start a new game and follow your deputy's tutorial, or dive in:

- **Build:** pick a room on the left (or press its key), then click a slot. Green means it fits; red says why not. Ring 1 opens onto the shaft; deeper rooms need a **corridor** back to it. Press C and drag along the borders between rooms (Shift erases), pick a finish (bare rock, marscrete, brick or metal), or click **Connect** on a cut-off room.
- **Watch the bar at the top:** oxygen, water, meals and power, with how fast they're changing. Red means it runs out in under two days.
- **Earth** sends supply drops every few days until you can stand on your own.
- **Office:** colonists visit with problems. What you promise, they remember.
- **People:** everyone starts as a working adult. With a clinic and a happy hole, children are born (they need a school); adults eventually retire as elders (who want elder care), and elders pass away in time: build a crypt, or enact Return to the soil. Only adults work. The **People** panel shows what's holding births back, and colonists in a miserable hole move to a happier one.
- **Room controls:** pause any staffed room, or have it stop at a stock level, from its details panel.
- **Overlays** (bottom left) show noise, smell, health, comfort and happiness. **Flows** (top) shows where every resource comes from and goes.
- **More holes:** once the network reaches 50 colonists the map opens. Build a staging bay to gather a seed kit, pick a site on the Map (M) and send a convoy. With two holes, a **rover depot** gives a hole 2 rovers, and the **Network** panel sets up trade routes between holes.
- **Plan view:** one floor from above, rings around the shaft. Pick the floor from the strip on the right (or Page Up / Page Down); everything you can do in the unrolled view works here too.
- **3D view**: stand in the shaft, look anywhere from its centre with **Free** (drag to aim), slice the hole open with **Cutaway** to reach rings 2 and 3, or look straight down from the **Top**. Pick a floor on the right to hide everything above it: from the Top it becomes a clear plan you can build on. **X-ray** fades ring 1 so you can see behind it. Everything you can do in 2D works in 3D.

### Controls

| Key | Action |
| --- | --- |
| Space | Pause / resume |
| Esc | Cancel, close a panel, or open the menu |
| R | Rotate the room you're placing |
| C | Corridor tool (drag along borders; Shift erases) |
| D G F T Y W L K A B S P | Dorm, galley, farm, tank, recycler, restroom, life support, clinic, admin office, battery, solar, landing pad |
| E Q | School, elder care (unlock with the first child and the first elder) |
| J | Composter: organic waste and black water into soil |
| U O H I N | Deep well pump, smelter, machine shop, silicon refinery, electronics fab (some need the right site) |
| M | Map of Mars |
| [ ] | Previous / next hole, once you have more than one |
| X | Demolish |
| V | Cycle views: Unrolled, Plan, 3D |
| Page Up / Page Down | Previous / next floor in the Plan and 3D views |
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
npm run playtest:net  # scripted first hour across two holes
npm run package    # build and zip for a playtest upload
```

`npm run package` writes `release/downtown-mars-v<version>.zip` with `index.html` at the top. To publish on itch.io: create an HTML project, upload the zip, and tick "This file will be played in the browser". Nothing is uploaded automatically.

Design documents live in `docs/`: start with `DECISIONS.md`, then `DESIGN.md` and the catalogs. Build plans are `docs/PLAN.md` (milestone 1) and `docs/PLAN-M2.md` to `docs/PLAN-M4.md` (milestones 2 to 4). `CLAUDE.md` has the architecture rules: the simulation is pure TypeScript in a Web Worker, deterministic, with all numbers in `data/*.json`.

## Credits

Mars elevation: NASA Mars Global Surveyor, Mars Orbiter Laser Altimeter (MOLA) Mission Experiment Gridded Data Record `MEGT90N000CB` (PDS Geosciences Node), public domain. `scripts/build-elevation.mjs` averages it to 1° for `data/mars-elevation.json`.
