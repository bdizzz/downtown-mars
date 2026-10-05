# Downtown Mars: the player's guide

Everything the game does, section by section. For a quick start, see the [README](../README.md).

- [Getting started](#getting-started)
- [Building](#building)
- [Digging](#digging)
- [Getting in and out](#getting-in-and-out)
- [Homes](#homes)
- [Meals, amenities and reach](#meals-amenities-and-reach)
- [Materials, waste and storage](#materials-waste-and-storage)
- [Air and smell](#air-and-smell)
- [People](#people)
- [Condition and maintenance](#condition-and-maintenance)
- [Earth, storms, the office and events](#earth-storms-the-office-and-events)
- [More holes](#more-holes)
- [The views](#the-views)
- [Controls](#controls)
- [Saving](#saving)

## Getting started

Start a new game and follow your deputy's tutorial, or dive in. Twenty colonists, one pod, and a hole that goes nowhere yet.

**The afterglow:** everyone arrives thrilled. For the first 20 days happiness gets a boost (+20 at landing, easing away), so there's time to get air, water and food running and put something by before reality sets in. Newly founded holes get their own. Point at **Happy** to see how much is left.

**Watch the bar at the top:** oxygen, water, meals and power, with how fast they're changing. Red means it runs out in under two days. Point at anything there for what it means and a sparkline of its last two days; click it to open it in **Charts → Trends**.

## Building

Open **Build** (B), pick a room from its category (or press its key: room keys work only in Build), then click a slot. Green means it fits; red says why not.

### Tubes and corridors

- The shaft itself is open to Mars. People get about in a sealed network of **gallery tubes** (glass walkways along the shaft wall), corridors, plazas and stairs.
- Floor 1 starts with its gallery tube all the way round. On deeper floors, lay tubes along the shaft wall where you want them (the corridor tool, on the shaft side of ring 1; **Connect** does it for you).
- Every room needs a tube, corridor or plaza along one side. Rooms have a door on each floor, wherever they open onto a tube, a corridor or a plaza.
- **The corridor tool** (Z): drag to snake a corridor along the borders between rooms. It follows the pointer, retracing takes it back, and on release you confirm the segments and cost. A plain click carves one segment. Pick a finish (bare rock, marscrete, brick or metal), or click **Connect** on a cut-off room.
- Shift snakes a fill-in instead, which costs as much as carving.

### Windows

- Rooms start without windows. The corridor tool's **Windows** mode puts them in, a whole wall at a click, on walls facing the shaft, a corridor or a walk-through room. Hover a wall: the room's half of the corridor along it lights up green where windows can go, with the cost and the comfort they'd give.
- Windows cost glass (2 per 10 m of wall); the landing kit brings 100. Shift-click takes them out.
- A home looking out over the shaft gets +1.5 comfort (a wall of glass where no tube runs), +1 behind a tube, less onto a plaza or a corridor, and a little more for each other glazed wall.
- Glass comes from a **glassworks** (Industry, from the start: a small 2×1 room, 2 staff, rock and power → 3 glass a day).

### The shaft dome

A hole's crowning work (Build → Public, from 300 colonists; glass, metal, machinery and electronics, and a long build). It seals the top of the shaft:

- every gallery becomes open walkway, and the shaft becomes an atrium (more comfort facing it);
- the air freshens everywhere;
- storms stop driving dust through the airlock.

### Room controls

Pause any staffed room, or have it stop at a stock level, from its details panel. Rename it there too.

## Digging

- The drill only sinks the shaft. In 3D a big boring machine sits at the bottom of the hole, riding down as it digs: a turning cutterhead, grippers braced on the bore, a conveyor lifting spoil into a skip, and the hoist cable and power line up to the rim.
- The first floors go quickly; from floor 4 on, each floor takes twice as long (`digging.slowFromFloor`, `slowFactor`).
- A new hole starts with only ring 1 of floor 1 dug out (and the landing kit's battery bank in ring 2). Every other slot is solid rock until it's dug out.
- A room placed on rock is excavated first (3 hours a slot, bringing up its rock and whatever the hole sits on), then built.
- **Empty rooms** (Build → Excavation) dig ahead for rock and space. Dug-out space with nothing in it has pillars and no walls, and is walk-through like a plaza; demolishing a room leaves it.

## Getting in and out

- People and goods come in through the **entrance** on floor 1 (its airlock stands at the rim).
- Deeper floors are reached only by **stairs** or elevators down from there.
- At 100 colonists a **cargo elevator** can run from the surface straight down to one floor, if its column above is clear.

## Homes

Bunk dorms from the start, then better homes as the hole grows:

| Colonists | Homes |
| --- | --- |
| Start | Bunk dorms |
| 50 | Studios and apartments |
| 200 | Flats and family apartments |
| 1,000 | Suites and residences |

Each tier houses fewer people per slot and costs more, but its residents are more comfortable, and the finer tiers cheer their neighbours too.

## Meals, amenities and reach

What people use counts by how far they'd walk. A step is about a room across, along corridors, tubes and stairs.

- **Meals:** a galley cooks and seats 25. A **kitchen** cooks 40 but seats no one, so pair it with a **canteen** (seats 60). Seats go to the homes nearest them first, within 8 steps; anyone without a seat within reach eats on the go, and their home's comfort drops (a home's card says how many are seated).
- **Amenities:** **plazas**, **parks** and **gyms** lift the homes within their reach (parks and plazas comfort, gyms health), less the further off. The nearest of each kind counts, so spread them out. Parks, plazas and canteens also cheer the rooms right next to them a little.
- At 50 colonists, gyms and parks (a park makes a little oxygen, and is walk-through like a plaza). At 300, a **hospital**: care for 400 within 16 steps.
- **Seeing reach:** while placing a room, the line at the bottom says what it would reach on foot ("On foot: Park 1 · Clinic 2 · Galley 3"). Select a galley, clinic, school, park or gym with no overlay on to see the homes it reaches in green and those it doesn't in red.

## Materials, waste and storage

- At 50 colonists a **brickworks** makes brick from rock, so you're not waiting on Earth. At 100, a **recycling center** turns solid waste into metal and brick.
- **Waste storage** holds more solid and organic waste until something uses it.
- **Storage:** dry goods (food and materials) only keep what storage has room for. Build storerooms, warehouses or depots and choose what each holds in its details panel; the landing pod has some to start. A good shown in amber has no room left, and what arrives is lost.

## Air and smell

The hole's air is a closed loop: life support makes it, and it moves where people do, through the corridors, gallery tubes and stairs (not through walls, and not by elevator).

- It goes stale away from the air trunk in the shaft wall (ring 3 starts at −1).
- Smelters, brickworks and concrete plants foul it for the rooms down the corridors from them, fading with every step.
- At home, stale air costs health (and so happiness). Crowded homes get stuffy.
- **Ventilation hubs** (Build → Air) scrub and freshen the air for the rooms along the network from them, and parks help a little.
- Smell travels the same way, and leaks into the room next door as well.
- The entrance's airlock lets in Mars dust, fouling the air down the corridors from it, twice as badly in a dust storm.
- **Bulkheads** (the corridor tool's Bulkhead button: click a corridor, 2 metal) seal a corridor against air and smell; people pass through.

## People

- Everyone starts as a working adult. Only adults work.
- With a clinic and a happy hole, children are born (they need a school). Adults eventually retire as elders (who want elder care), and elders pass away in time: build a crypt, or enact Return to the soil.
- Clinics, schools and elder care serve the homes within about 10 steps, nearest first. A home too far from one (or last in line at a full one) goes without, and feels it. A clinic nearby also lifts its neighbours' health.
- The **People** panel shows what's holding births back, and colonists in a miserable hole move to a happier one.

## Condition and maintenance

- Rooms wear down once they're built (all but the entrance, stairs, elevators and the service rooms), and look grubbier as they do.
- Below 50%, people in and around them get unhappy (more so for homes, galleys, restrooms and clinics); below 30% they work 30% slower; at 0% they stop. Now and then something breaks and knocks a room down 20 or 30 points.
- **Maintenance** rooms (Build → Services) repair rooms back to 100%, one room per maintenance room at a time, taking the worst from the hole's queue (rooms at 60% or below). They use machinery.
- From 150 colonists, **cleaning services** do the same for homes and other rooms people share, using clean water.
- Understaffed crews work slower; a crew that stops hands its room back, part-done, to the front of the queue. A crew with nothing to repair stands by, using power but no machinery or water.
- **Charts → Maintenance** shows the queue and what each crew is on; the **Condition** stat at the top and the Condition overlay show how things stand.

## Earth, storms, the office and events

- **Earth** sends supply drops every few days until you can stand on your own.
- **Dust storms** are forecast a few days ahead (the 🌪 chip at the top counts down), then blow for a day or two, halving what the solar arrays make. Charge your batteries before one hits. In 3D the sky thickens to a murk, grit streams past, and the panels dull over.
- **The office:** colonists visit with problems. What you promise, they remember.
- **Events:** things happen, and you choose. A card slides in at the top left with the choices (each with what it costs and does) and how long you have. The game keeps running; if you don't decide, it takes its own course.
  - **The drill strikes things:** each floor it finishes may break into an aquifer, an ore vein, a silica bed, a lava tube (free space, or rock), a gas pocket (vent it and lose a day, or push through and foul the floor above) or, deep down, microfossils. The rig shudders when it does.
  - **A belt ship in distress** calls now and then from day 20: bring her down on your pad (her crew join you, with salvage), send supplies up (the belt sends thanks later), or ignore her.
  - **Milestones** (the first birth; 50, 100 and 200 people; floors 5, 10 and 20; the dome) can be celebrated. A festival costs a feast and a slow day of work, lifts everyone for two days, and strings lights along the galleries with lanterns rising up the shaft; or just raise a toast.
  - Gains need storage space, like Earth's drops.

## More holes

- Once the network reaches 50 colonists the map opens. Build a **staging bay** to gather a seed kit, pick a site on the Map (M) and send a convoy.
- With two holes, a **rover depot** gives a hole 2 rovers, and the **Network** panel sets up trade routes between holes.

## The views

### Modes

Four buttons at the bottom right, as in SimCity. B, V, M and C open them from anywhere. Pick the open mode again to close it; Esc steps back one thing at a time.

- **Build** opens a strip of room categories along the bottom. Pick one (Storage, say) and its rooms pop up above it, with each room's details as you point at it. Demolish and Undo sit at the end. Only Build places rooms and corridors. The rooms' keys (and Z for corridors, X to demolish, R to rotate) work only in Build; outside it, bare rock doesn't light up under the pointer.
- **View** has the 3D cameras, the plan and unrolled views, X-ray, walls down, room colours, Flows and the overlays.
  - **Room colours** off shows each room in what it's built from: rock, marscrete, brick or metal.
  - **Flows** draws power, water, air and food as pipes, with dashes running from what makes each to what uses it.
  - **Overlays** show noise, smell, health, comfort, air, happiness and condition.
- **Map** opens the planet as a globe: drag or scroll sideways to spin it (it coasts to a stop), scroll to zoom, click to pick a site.
- **Charts** has People, Trends, Flows, Network, Maintenance and the construction queue (its badge counts the jobs). **Trends** shows how everything has been changing: pick a series for a detailed chart over the last 2 days, 10 days or the whole game, as amounts or as change per day, with the lines that matter marked (happiness 50 and 45, CO2 100 and so on); point along it to read any hour.

The floor picker stays on the right.

### The plan

One floor from above, rings around the shaft. Pick the floor from the strip on the right (point at a floor to preview it, click to keep it; or Page Up / Page Down). Everything you can do in the unrolled view works here too. Scroll or pinch to zoom and scroll sideways to turn it; it stays centred on the shaft, and opens with the unlocked rings filling the screen.

### 3D

New games open in 3D, in Iso. Everything you can do in 2D works in 3D.

**Cameras**

- **Iso** looks at one floor (or, with All, the surface) from above and off to one side, so you see all of it: drag to turn it, scroll to zoom. With a floor picked, the planet is cut open to show it: the land across the hole stands with a rock face down to that floor, and the near side is cut away.
- **Cutaway** slices the hole open (it opens framing the unlocked rings); **Top** looks straight down. Pick a floor on the right to hide everything above it: from the Top it becomes a clear plan you can build on.
- **First person** puts you on a floor at eye height: WASD to walk (hold Shift to run), Q and E to turn, drag to look (or Tab for mouse look, where the browser allows it). Walk up or down a stairwell's wide flights to change floors (R or F also takes the stairs from anywhere in a stairwell; picking a floor on the right takes you there too). You can walk the gallery tubes, corridors, plazas and empty space, and into a room through its door, but not through walls or furniture. Build is off while you walk.
- **X-ray** fades ring 1 so you can see behind it. **Walls down** lowers every wall standing between you and the room or shaft behind it to a short stub, as in The Sims.

**What you'll see**

- Built rooms are furnished: bunks in dorms, planters or racks of whatever the farm grows, furnaces in the smelter. Homes have pictures, family photos and lamps; workplaces have charts, gauges, pipes and tool boards; vents, cable trays and lights run high round every room.
- Floors suit each room: planks at home, tiles in kitchens and clinics, plating in plants, paving in plazas. Rooms get grubbier as their condition drops.
- Colonists stroll the gallery tubes or are where you'd expect for the hour: at their posts, asleep in bed at night, sitting about in homes, plazas and offices.
- Rooms in trouble are outlined in amber (slowed) or red (short of what they run on), with a ⚠ over their name; paused rooms in grey. The room's card says why.
- Screens flicker, indicator lights blink, fires dance, plants sway and windows fog at the bottom. Working smelters throw sparks and life support vents steam.
- Around midday sunlight falls down the shaft; deeper down everything settles into lamp-light. Lamps, fires and grow lights light the rooms around them.
- By day the sky fades from butterscotch at the horizon to a deeper tan overhead, with a bluish glow round the sun; at night the stars come out. The land round the hole rolls away in ridges, craters and boulders to mountains, mesas or low hills, depending on the site.

**Graphics:** soft shadows where things meet, glow around lit windows and lamps, a warm haze, a miniature-style blur in Iso, and a warm colour grade. **Settings → 3D graphics** picks a preset (Low, Medium or High, the default) or sets each effect, including lamp light and shadows, so a laptop can scale them down. Shiny floors, metal and glass reflect a warm, lamp-lit cave. `?renderer=webgpu` tries three's WebGPU renderer with light bouncing and reflections (an experiment: see [WEBGPU.md](WEBGPU.md)).

## Controls

| Key | Action |
| --- | --- |
| B V C M | Build, View, Charts and Map modes (anywhere) |
| Space | Pause / resume, at the speed you had |
| − + | Slower / faster (1×, 2×, 4×); from paused, starts one step from the speed you had |
| Esc | Put down the tool, close a panel or mode, or open the menu |
| ⌘Z / Ctrl+Z | Undo your last placement |
| ? | Controls help |
| [ ] | Previous / next hole, once you have more than one |
| ↑ ↓ or Page Up / Page Down | Floor up / down in the Plan and 3D views (walking, the arrows walk) |
| W A S D | Iso: pan across the floor (outside Build). Once a 3D view has moved, **Reset camera** (top left) takes you back |
| Drag / scroll | Pan (drag paints corridors with the corridor tool) |
| Pinch / Ctrl+scroll | Zoom |

**In Build only:**

| Key | Action |
| --- | --- |
| R | Rotate the room you're placing |
| Z | Corridor tool (drag to snake a corridor, confirm on release; Shift fills in) |
| X | Demolish |
| D G F T Y W L K A B S P | Dorm, galley, farm, tank, recycler, restroom, life support, clinic, admin office, battery, solar, landing pad |
| E Q | School, elder care (unlock with the first child and the first elder) |
| J | Composter: organic waste and black water into soil |
| U O H I N | Deep well pump, smelter, machine shop, silicon refinery, electronics fab (some need the right site) |

## Saving

The game autosaves every game day in your browser. Use the menu to save to a slot, or export a save file to keep it somewhere safe.
