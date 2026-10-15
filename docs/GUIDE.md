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

**The landing kit:** the landing crew sets up the basics before you arrive. On the surface, the landing pod, a landing pad and a solar array; on floor 1, the entrance, a **battery bank** in ring 2, and out in ring 3 two **water tanks** (one for clean water, one for gray), an **electrolyzer**, a **CO2 scrubber** and a **water recycler**, with a corridor along their fronts and one spoke in from ring 1. Air, water and power work from the start, ring 2 is left nearly free for what you want there, and you can begin with food, a restroom and beds. The tutorial skips the steps the kit has done. Holes you found later start with only the pod, pad, solar array, entrance and battery: their seed kit brings the rest. (Once difficulty levels arrive, hard starts bare too, and normal offers it as a veteran start.)

**The title screen:** while the game loads, a loading screen shows the name over a Mars dusk with a bar that fills as each part arrives (the code, the typeface, the colony, the 3D view, the map of Mars), then fades into the title. Behind the title menu your own hole drifts by at dusk, its first floor turning slowly: the one you were last playing (from the autosave), or a showcase colony if you haven't played yet or your last game failed. On a phone, on low graphics or with a flat view chosen, a painted dusk stands in for it.

**The welcome card:** every new game (not a loaded one) opens with a short card on why you're here and why the colony goes underground: the surface is open to radiation from the Sun and deep space, so you dig. Only Mars and the hole show behind it, and the game waits; **And so it begins...** brings in the rest of the interface and starts the clock at 1×. Its text is in `data/tutorial.json` (`welcome`).

**The tutorial:** your deputy's card (bottom right) gives one goal at a time, with a hint and a dot per goal. The goals can be met in any order: **‹** and **›**, or a dot, show another step, and done ones show ticked. The card stays on the step you picked until you meet it, then moves on to the next one not done yet. – shrinks it; **Hide tutorial** puts it away (**Settings → Game → Tutorial** brings it back).

**Time:** the clock at the top counts the colony's time in **months**, then years and months (month 45 reads "Year 3, month 9"). Each month passes as one sol of light and dark, with the hour beside it and a little dial where the sun rides over the horizon by day and the moon by night. Rates are per month and people age in months too. At 1× a month takes a real minute.

**The afterglow:** everyone arrives thrilled. For the first 20 months happiness gets a boost (+20 at landing, easing away), so there's time to get air, water and food running and put something by before reality sets in. Newly founded holes get their own. Point at **Happiness** (the smiling face in the grid) to see how much is left.

**The top bar:** the menu (☰), the hole's name, the clock, the speed (pressing ❚❚ while paused plays again at the speed you had), then **what needs you first**, the drill and the next supply drop, and the **Office**. Everything that's fine stays quiet; anything in trouble shows as a chip in the middle, trouble (red, solid frame, a warning triangle) before worries (amber, dashed frame), at most three with a **+N** for the rest: a stock running out, oxygen or CO2 out of its band, health below 70, low morale, condition below 50%, power short, the homeless, a dust storm blowing or coming, a supply drop the pad can't land, people waiting at the office. Click a chip to open its trend (or the office). The drill shows its floor and progress with a small ❚❚ / ▶ to pause it; the rocket counts down to the next drop.

**The resource grid** under it: one small cell per stat or stock, each an icon, its value and a tiny arrow (green rising, red falling), in four labelled sections, each its own panel: **Colony** (colonists and beds, health, happiness with its ✦ afterglow, condition, workers, power used of made), **Life** (oxygen, water, CO2), **Food** (meals and Earth rations together, raw food, soil) and **Materials**. The bowl in Food is everything there is to eat: meals plus Earth rations, with each on its own in its tooltip. People eat only meals (kitchens cook rations in place of raw food), so the bowl goes red when meals run out even with rations in store. A cell turns amber in a dashed frame when it's a worry (a stock out in under two months), red in a solid frame when it's trouble (under half a month), and blue with a dotted frame when its storage is full. Point at a cell for its name, what it means and a sparkline of its last two months; click or tap it to open it in **Charts → Trends**. On a narrow screen each section takes a row of its own, its label down the left and its cells wrapping in rows beside it.

**On a phone** the top bar folds to one short row: the menu, the hole's name, one ❚❚ / ▶ button to pause and play, a ⚠ count of the things that need you (when any do), the office (its icon only) and **Show stats ▾**. That button, or the ⚠ count, drops down the rest: the clock (without its sun dial), the speeds, the chips, the drill, the next drop (a waiting drop shows only as its chip) and the resource grid. It stays down until **Hide stats** closes it, so you can keep an eye on your stocks while you play.

## Building

Open **Build** (B), pick a room from its category (or press its key: room keys work only in Build), then click a slot. Green means it fits; red says why not. With a surface room in hand (solar arrays, the landing pad), every free spot round the hole it fits on is tinted faintly green on the ground, and the one under the pointer brighter.

### Tubes and corridors

- The shaft itself is open to Mars. People get about in a sealed network of **gallery tubes** (glass walkways along the shaft wall), corridors, plazas and stairs.
- Floor 1 starts with its gallery tube all the way round. On deeper floors, lay tubes along the shaft wall where you want them (the corridor tool, on the shaft side of ring 1; **Connect** does it for you).
- Every room needs a tube, corridor or plaza along one side. Rooms have a door on each floor, wherever they open onto a tube, a corridor or a plaza.
- **The corridor tool** (Z): drag to snake a corridor along the borders between rooms. It follows the pointer, retracing takes it back, and on release you confirm the segments and cost. A plain click carves one segment. Through uncut rock the preview sits on the rock's top, where you're pointing. Pick a finish (bare rock, marscrete, brick or metal), or click **Connect** on a cut-off room. **Refit** changes a built corridor's lining later (see Refits and salvage).
- Shift snakes a fill-in instead, which costs as much as carving.

### Windows

- Rooms start without windows. The corridor tool's **Windows** mode puts them in, a whole wall at a click, on walls facing the shaft, a corridor or a walk-through room. Hover a wall: the room's half of the corridor along it lights up green where windows can go, with the cost and the comfort they'd give.
- Windows cost glass (2 per 10 m of wall); the landing kit brings 100. Shift-click takes them out.
- A home looking out over the shaft gets +1.5 comfort (a wall of glass where no tube runs), +1 behind a tube, less onto a plaza or a corridor, and a little more for each other glazed wall.
- Windows onto the shaft let the sun in too: +0.5 comfort on floor 1, less each floor down, none below floor 10. In 3D, around midday, sunlight falls down the shaft (still visible in Free view with a floor picked), lights the gallery tubes and pools on the floor inside rooms with windows onto the shaft, fainter the deeper they are.
- Glass comes from a **glassworks** (Industry, from the start: a small 2×1 room, 2 staff, rock and power → 3 glass a month).

### Refits and salvage

- **Building in a material:** above each category's rooms in Build, **Built in** picks the lining new rooms go in. It's **bare rock** each time you open Build and stays on what you pick while you place room after room. A room built in brick (say) pays its own cost plus the brick a refit from bare rock would cost, but takes only its own build time: no refit afterwards. Undo and cancelling refund the lining too. Stairs, lifts, empty rooms and surface buildings ignore it and go in bare rock.
- Otherwise every room is carved from **bare rock**. Its panel's **Refit** picker lines the walls in smoothed rock, marscrete, polished marscrete, brick, patterned brick, metal panels or inlaid metal, each showing the comfort it gives (homes in full, rooms people share for everyone), how much slower the room wears, the cost and the work. Bigger rooms cost more: the price is per 10 m cell.
- Skipping a step costs both (bare rock straight to patterned brick pays for the brick and the pattern). Any lining can change to any other, including back to bare rock.
- **Salvage:** taking brick or metal out gives half of it back (rounded down) when the job is done; the inlay's glass and smoothed rock's rock are lost. Stripping takes half the lining's work.
- A refit is paid when you order it and goes in the **construction queue** ("Refit Dorm 3 in brick"). Once the crews start, the room works at half speed and a home is a little less comfortable; when it's done, the room is back to 100% condition. Order another and it replaces the queued one; cancelling (from the panel or the queue's ✕) refunds it in full.
- In the plan and unrolled views a lined room has a thin border in its lining's colour.
- **Corridors** take the same linings. The corridor tool's **Refit** mode lists them with their price per 10 m from bare rock (a quarter of a room cell: brick 2, the same as drawing a corridor in brick). Click a built corridor to refit it, or drag along several and confirm the chain's cost, work and salvage. A lined corridor's walls and floor take the lining's look, so a brick corridor looks like a brick room; for now that's all it does (no comfort). One job refits the lot ("Refit 4 corridor segments in brick"); the corridor stays in use meanwhile, and filling a segment in (or building over it) drops it from the refit, refunding just that one. Gallery tubes are glass and can't be lined. Corridors drawn in marscrete, brick or metal are already lined in it.

### The shaft dome

A hole's crowning work (Build → Public, from 300 colonists; glass, metal, machinery and electronics, and a long build). It seals the top of the shaft:

- every gallery becomes open walkway, and the shaft becomes an atrium (more comfort facing it);
- the air freshens everywhere;
- storms stop driving dust through the airlock.

### Room controls

Pause any staffed room, or have it stop at a stock level, from its details panel. Rename it there too. A room's name floats in the middle of it, inside its walls: a long one wraps onto two lines or shrinks to fit, and one too long even then shows only while you point at the room (or have it picked).

## Digging

- The drill only sinks the shaft. In 3D a big boring machine sits at the bottom of the hole, riding down as it digs: a turning cutterhead, grippers braced on the bore, a conveyor lifting spoil into a skip, and the hoist cable and power line up the shaft. The top of the shaft is lined with a concrete collar that rises into a rim round the hole, with a railed walkway on top (the shaft dome stands on it). On the rim, lattice towers hold a gantry over the hole with a sheave for each cable, and a winch at either end winds them in. The cables follow the drill down. It's only for looks.
- The first floors go quickly; from floor 4 on, each floor takes twice as long (`digging.slowFromFloor`, `slowFactor`).
- A new hole starts with only ring 1 of floor 1 dug out (and the landing kit's rooms and corridor in rings 2 and 3). Every other slot is solid rock until it's dug out.
- A room placed on rock is excavated first (3 hours a slot, bringing up its rock and whatever the hole sits on), then built.
- An **excavator bay** (Build → Construction) speeds the drill: half as fast again at full staff, each, so floors and their rock come sooner. It's noisy.
- **Empty rooms** (Build → Excavation) dig ahead for rock and space. Dug-out space with nothing in it has pillars and no walls, and is walk-through like a plaza; demolishing a room leaves it.

## Getting in and out

- People and goods come in through the **entrance** on floor 1 (its airlock is a concrete gatehouse built against the collar's rim).
- Deeper floors are reached only by **stairs** or elevators down from there.
- At 100 colonists a **cargo elevator** can run from the surface straight down to one floor, if its column above is clear.

## Homes

Bunk dorms from the start, then better homes as the hole grows:

| Colonists | Homes |
| --- | --- |
| Start | Bunk dorms |
| 50 | Studios and apartments |
| 100 | Flats and family apartments |
| 200 | Suites and residences |

Each tier houses fewer people per slot and costs more, but its residents are more comfortable, and the finer tiers cheer their neighbours too.

## Meals, amenities and reach

What people use counts by how far they'd walk. A step is about a room across, along corridors, tubes and stairs.

- **Meals:** a galley cooks and seats 25. A **kitchen** cooks 40 but seats no one, so pair it with a **canteen** (seats 60). Seats go to the homes nearest them first, within 8 steps; anyone without a seat within reach eats on the go, and their home's comfort drops (a home's card says how many are seated).
- **Amenities:** **plazas**, **parks** and **gyms** lift the homes within their reach (parks and plazas comfort, gyms health), less the further off. The nearest of each kind counts, so spread them out. Parks, plazas and canteens also cheer the rooms right next to them a little.
- **Restrooms:** each has places for 25, going to the homes nearest it first, within 6 steps. People without one within reach lose comfort at home (up to −1), and a restroom close by is a small plus. Studios, apartments and the finer homes have their own bathroom and need none; the landing pod and bunk dorms do. Only when fewer than half the colony has a restroom does health suffer too.
- At 50 colonists, gyms and parks (a park makes a little oxygen, and is walk-through like a plaza). At 300, a **hospital**: care for 400 within 16 steps. At 500, the large **plaza**: comfort within 8 steps, and a good deal for the rooms around it.
- A **lounge** (Build → Public, from the start) is a small den of couches, a TV, a games table and arcade cabinets. It needs no staff and a little power, and cheers the rooms up to two slots away: put one among homes.
- At 200 colonists, the **spiral stair**: a handsome two-floor link that cheers the rooms beside it. In first person you take it like an elevator (R or F), rather than walking it.
- **Seeing reach:** while placing a room, the line at the bottom says what it would reach on foot ("On foot: Park 1 · Clinic 2 · Galley 3"). Select a galley, restroom, clinic, school, park or gym with no overlay on to see the homes it reaches in green and those it doesn't in red.

## Water

Water goes round in a loop. Everything that uses clean water (people, galleys, farms, clinics, industry) turns it into **gray water**; a **water recycler** treats gray back into clean, about 97% of it, with a little soil from the sludge. One recycler keeps up with about 35 people.

- **Gray water needs somewhere to go.** The pod holds 250. When it's full, rooms keep running but the gray water that doesn't fit overflows and is lost for good, and a warning says so. Build a recycler early, and more as you grow; **Charts → Flows → Water** says how much gray water is overflowing. A recycler that has treated all the gray water there is says it's **keeping up**: running below full speed then is fine, not a shortage (the same goes for a composter or a recycling center).
- **Water tanks** hold clean water unless you set them to hold gray water or tailings, in the tank's details panel.
- **The leaks:** the electrolyzer splits water into oxygen for good (only as the hole grows), and some industry (the silicon refinery, concrete plant, electronics fab and brickworks) sends part of its water to **tailings**, which can only be stored until 150 colonists, when a **tailings reclaimer** can turn them back into gray water (20 tailings into 18 gray a day, for a lot of power and a little machinery). Wells pump up gray water (brine), so it needs treating too. Earth's drops top up what's lost.

## Materials, waste and storage

- At 50 colonists a **brickworks** makes brick from rock, so you're not waiting on Earth. At 100, a **recycling center** turns solid waste into metal and brick.
- **Fiber:** set a farm's crop to **fiber hemp** and it grows fiber (6 a month) instead of food. It needs room in storage; it's shown in the resource grid once you have some.
- **Waste storage** holds more solid and organic waste until something uses it.
- **Storage:** dry goods (food and materials) only keep what storage has room for. Build storerooms, warehouses or depots; the landing pod has 600 units to start. Every storage room takes in everything until you say otherwise: its details panel shows a bar of what it holds and a checklist of goods to allow (with All and None). Goods share the space first come, first served, each going to the allowing room nearest to where it was made (deliveries come in at the entrance), so keep rock out of a room you want for food. Goods you stop allowing move to rooms that take them, when there's space. A good shown in blue with a dotted frame has no room left, and what arrives is lost.

## Air and smell

**The mix.** The hole's air fills its **living volume**: every dug cell (400 m³) and every built corridor and gallery tube; not the open shaft or the rock. The grid shows it as oxygen (the bubbles) **21.0%** and CO2 (the cloud) **0.20%**, and Charts → Trends → Air has both and the living volume.

- People breathe oxygen into CO2, one for one. A **CO2 scrubber** turns it back into oxygen for power alone (down to 0.2% CO2, left for the farms); one covers about 30 people. Plants turn CO2 back into oxygen too, parks included.
- **Digging dilutes the air:** a new room spreads the same oxygen over more space. An **electrolyzer** splits water into oxygen to make the difference (about 8 water a dug cell), and stands by once the air is at **21%**. A steady colony with enough scrubbers uses no water for air at all. Flows → Water shows where its water went: air for new space, replacing breathed air (build a scrubber), or into the O2 reserve.
- **Gas tanks** hold oxygen or CO2 (pick in the tank's panel). They're ballast: oxygen above 21% goes in, and comes back out when the air runs short, before any water is split. Supply drops land oxygen in them first. The **tank fill** slider (in any electrolyzer's or O2 tank's panel) has the electrolyzers keep the O2 tanks that full as a reserve for digging or a breakdown. When the tanks are full, extra oxygen stays in the air: that's how it climbs too high. A tank at 0% condition (gas or water) keeps what it holds but takes no more.
- **The shaft dome** pressurizes before it opens: the O2 reserve and the electrolyzers fill the shaft with air first (the HUD's oxygen note shows how far), so the hole's oxygen doesn't crash.
- Below **18%** oxygen health falls; below **15%**, fast. Above **23.5%** is a fire risk. **CO2 above 1%** hurts health, above 3% fast.
- A new game starts with its air made (the landing crew sealed the hole) and a scrubber and an electrolyzer built. A founded hole has neither: without a scrubber the CO2 passes 1% in about five months, and without an electrolyzer every room dug thins the air until Earth's next drop, so build both early there.

**Air quality.** The air also moves where people do, through the corridors, gallery tubes and stairs (not through walls, and not by elevator), and it can go stale or foul locally:

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
- Every room is carved from **bare rock**; the room panel's **Walls** row says what its lining is and what that gives. Brick and metal linings (a refit: see Building → Refits and salvage) make homes more comfortable, make shared rooms nicer for everyone, and wear more slowly (workshops and plants twice as much).
- **Charts → Maintenance** shows the queue and what each crew is on; the **Condition** stat at the top and the Condition overlay show how things stand.

## Earth, storms, the office and events

- **Earth** sends supply drops every few months until you can stand on your own. Each one covers what you're short of in food, water and oxygen, plus some materials, and up to six colonists if there are free beds and your people are in good health (50 or more). A hole that's dwindling (under 20 people) gets **replacements** even in poor health: half its drops bring three colonists, as long as there are beds for them.
- **A hole fails** when its last colonist is gone and it stays empty for half a month: with no one left to open the airlock, no newcomers can come in. Its card says how long it lasted and how many lived there at its peak. In a network, the others carry on; when **every** hole has failed the game is over and the card leads back to the start screen. The save is kept (shown as *Failed* in the menu) but can't be loaded to play on.
- **Dust storms** are forecast a few months ahead (a storm chip among what needs you counts down), then blow for a month or two, halving what the solar arrays make. Charge your batteries before one hits. In 3D the sky thickens to a murk, grit streams past, and the panels dull over.
- **The office:** colonists visit with problems. What you promise, they remember.
- **Events:** things happen, and you choose. A card slides in at the top left with the choices (each with what it costs and does) and how long you have. The game keeps running; if you don't decide, it takes its own course.
  - **The drill strikes things:** each floor it finishes may break into an aquifer, an ore vein, a silica bed, a lava tube (free space, or rock), a gas pocket (vent it and lose a month, or push through and foul the floor above) or, deep down, microfossils. The rig shudders when it does.
  - **A belt ship in distress** calls now and then from month 20: bring her down on your pad (her crew join you, with salvage), send supplies up (the belt sends thanks later), or ignore her.
  - **Too much oxygen:** above 23.5% O2 the air is a fire risk (the HUD and a message say so). After half a month above it you're offered to vent the excess to the planet (back to 21%, gone for good) or hold it.
  - **Milestones** (the first birth; 50, 100 and 200 people; floors 5, 10 and 20; the dome) can be celebrated. A festival costs a feast and a slow month of work, lifts everyone for two months, and strings lights along the galleries with lanterns rising up the shaft; or just raise a toast.
  - Gains need storage space, like Earth's drops.
- **News:** the latest few messages stack up in a corner of the view and fade over a month. Click a message's × to close it straight away.

## More holes

- Once the network reaches 50 colonists the map opens. Build a **staging bay** to gather a seed kit, pick a site on the Map (M) and send a convoy.
- **Not on the polar caps:** the white ice round the poles (from 80°N and 83°S) can't be dug. The map says "Ice cap: can't dig here" under the pointer and won't pick a site there.
- **Each site looks like where it is:** its ground takes the colour the map shows there, so a hole in a dark lowland basin sits on dark red-brown dust and one high on Tharsis on pale tan, and the sun and stars move for its latitude (below).
- With two holes, a **rover depot** gives a hole 2 rovers, and the **Network** panel sets up trade routes between holes.

## The views

### Modes

Four buttons at the bottom right, as in SimCity. B, V, M and C open them from anywhere. Pick the open mode again to close it; Esc steps back one thing at a time.

- **Build** opens a strip of room categories along the bottom. Pick one (Storage, say) and its rooms pop up above it, with each room's details as you point at it. Demolish and Undo sit at the end. Only Build places rooms and corridors. The rooms' keys (and Z for corridors, X to demolish, R to rotate) work only in Build; outside it, bare rock doesn't light up under the pointer.
- **View** has the 3D cameras, the plan and unrolled views, walls down, room colours, Flows and the overlays.
  - **Room colours** off shows each room in what its walls are lined with: bare or smoothed rock, plain or polished marscrete, plain or patterned brick, metal panels or inlaid metal (stairs, lifts and the entrance in what they're built from). A room being refitted has a band of hazard stripes along the tops of its walls. On, walls and floors take the room's category colour, but the floor keeps its material's texture, only tinted. Either way, the walls along a lined corridor are in the corridor's lining.
  - **Flows** draws power, water, air and food as pipes, with dashes running from what makes each to what uses it.
  - **Overlays** show noise, smell, health, comfort, air, happiness and condition.
- **Map** opens the planet as a globe: drag or scroll sideways to spin it (it coasts to a stop), scroll to zoom, click to pick a site.
- **Charts** has People, Trends, Flows, Network, Maintenance and the construction queue (its badge counts the jobs). **Trends** shows how everything has been changing: pick a series for a detailed chart over the last 2 months, 10 months or the whole game, as amounts or as change per month, with the lines that matter marked (happiness 50 and 45, oxygen 18% and so on); point along it to read any hour.

The floor picker stays on the right (except in Cutaway, which shows every floor).

### The plan

One floor from above, rings around the shaft. Pick the floor from the strip on the right (click a floor, or Page Up / Page Down; turn on **Settings → Controls → Preview floors on hover** to see a floor just by pointing at it). Everything you can do in the unrolled view works here too. Scroll or pinch to zoom and scroll sideways to turn it; it stays centred on the shaft, and opens with the unlocked rings filling the screen.

### 3D

New games open in 3D, in Free view. Everything you can do in 2D works in 3D.

**Cameras**

- **Free view** looks at one floor (or, with All, the surface) from above and off to one side, so you see all of it: drag to turn it, scroll to zoom (out only as far as all six rings' footprint, open or not, fills the screen with a little to spare). With a floor picked, the planet is cut open to show it: the land across the hole stands with a rock face down to that floor, fading into the dark further out, and the near side is cut away.
- **Cutaway** slices the hole open and always shows the whole hole, from the surface down (it opens framing the unlocked rings). The cut reads as a cross-section: solid rock, open only where rooms, corridors and dug-out space are. There's no floor picker here, and the floor keys do nothing; going back to Free view puts you on the floor you had picked. **How much it cuts away** is yours: the slider top left (or **;** and **'**) goes from a flat slice through the middle (180°, as it opens) down to a 60° wedge, centred on you, so at 90° only the front quarter of the hole is gone and you see in from both sides. The angle is kept in your settings. **Zoom** with the **−** and **+** buttons beside it, **,** and **.**, Ctrl+scroll or a pinch; a plain scroll still moves up and down the hole. For a flat plan to build on, there's the 2D **Plan** view.
- **First person** puts you on a floor at eye height, on its gallery tube (or, on a floor without one, the nearest corridor or room; failing that, the nearest floor with somewhere to stand): WASD to walk (hold Shift to run), Q and E to turn, drag to look (or Tab for mouse look, where the browser allows it; **Settings → Controls → Mouse look speed** sets how fast). The tutorial card steps out of the way while you walk, and comes back as you left it. Walk up or down a stairwell's wide flights to change floors (R or F also takes the stairs from anywhere in a stairwell; picking a floor on the right takes you there too). You can walk the gallery tubes, corridors, plazas and empty space, and into a room through its door, but not through walls or furniture. Build is off while you walk. Walk up to a home's kitchenette or the serving counter in a galley or canteen, face it, and press **F** (on stairs, F still goes down) to grab a hot drink: you carry the steaming mug until you leave first person.
- **Walls down** lowers the walls that hide a room from you to a short stub, as in The Sims: a room's near walls, and a wall that stands in front of another room. Each wall goes down or stays up whole, curves and all. A wall that only hides a corridor, a gallery tube, the shaft or rock stays up; one with a corridor and then a room behind it stays up while the stubs would hide that room's floor anyway, and comes down once you tilt the camera low enough that lowering it would show some of that floor. Hangings on a lowered wall go with it.

**What you'll see**

- Built rooms are furnished: bunks in dorms, planters or racks of whatever the farm grows, furnaces in the smelter. Homes have pictures, family photos and lamps; workplaces have charts, gauges, pipes and tool boards; vents, cable trays and lights run high round every room.
- Floors suit each room: honed stone at home and in offices, tiles in kitchens and clinics, plating in plants, paving in plazas. Nothing is wooden: there are no trees on Mars, so furniture frames and panels are fibre composite. Rooms get grubbier as their condition drops.
- Colonists stroll the gallery tubes or are where you'd expect for the hour: at their posts, asleep in bed at night, sitting about in homes, plazas and offices.
- Rooms in trouble are outlined in amber (slowed) or red (short of what they run on), with a ⚠ over their name; paused rooms in grey. The room's card says why.
- Screens flicker, indicator lights blink, fires dance, plants sway and windows fog at the bottom. Working smelters throw sparks and scrubbers vent steam.
- The sun crosses the sky for the hole's latitude, always as at an equinox: it rises due east, sets due west, and at noon stands toward the equator, overhead at the equator and lower the further north or south the hole is. Around midday sunlight falls down the shaft (furthest at a hole near the equator); deeper down everything settles into lamp-light. Lamps, fires and grow lights light the rooms around them.
- By day the sky fades from butterscotch at the horizon to a deeper tan overhead, with a bluish glow round the sun; at night the stars come out and wheel slowly round the celestial pole, which stands as high above the northern horizon as the hole is north (below it, south of the equator). The land round the hole rolls away in ridges, craters and boulders to mountains, mesas or low hills, depending on the site.

**Graphics:** soft shadows where things meet, glow around lit windows and lamps, a warm haze, a miniature look in Free view (the floor you're looking at stays sharp while nearer and farther things blur, as in a photo of a model; **Miniature blur** sets how strongly, gentle by default), and a warm colour grade. **Settings → Display** picks a preset (Low, Medium or High, the default) or sets each effect, including lamp light and shadows, so a laptop can scale them down. Shiny floors, metal and glass reflect a warm, lamp-lit cave. `?renderer=webgpu` tries three's WebGPU renderer with light bouncing and reflections (an experiment: see [WEBGPU.md](WEBGPU.md)).

## Controls

| Key | Action |
| --- | --- |
| B V C M | Build, View, Charts and Map modes (anywhere) |
| Space | Pause / resume, at the speed you had |
| − + | Slower / faster (1×, 2×, 4×); from paused, starts one step from the speed you had |
| Esc | Put down the tool, close a panel or mode, or open the menu (in the menu, Esc goes back a step, then resumes) |
| ⌘Z / Ctrl+Z | Undo your last placement |
| ? | Controls help |
| [ ] | Previous / next hole, once you have more than one |
| ↑ ↓ or Page Up / Page Down | Floor up / down in the Plan and 3D views (walking, the arrows walk) |
| W A S D | Free view: pan across the floor (outside Build). Once a 3D view has moved, **Reset camera** (top left) takes you back |
| Drag / scroll | Pan (drag paints corridors with the corridor tool) |
| Pinch / Ctrl+scroll | Zoom |
| , . | Cutaway: zoom out / in (or **−** **+**, top left) |
| ; ' | Cutaway: narrow / widen the cut, from 180° (flat) down to a 60° wedge (or the slider, top left) |

**In Build only:**

| Key | Action |
| --- | --- |
| R | Rotate the room you're placing |
| Z | Corridor tool (drag to snake a corridor, confirm on release; Shift fills in) |
| X | Demolish |
| D G F T Y W L K A B S P | Dorm, galley, farm, tank, recycler, restroom, CO2 scrubber, clinic, admin office, battery, solar, landing pad |
| E Q | School, elder care (unlock with the first child and the first elder) |
| J | Composter: organic waste into soil |
| U O H I N | Deep well pump, smelter, machine shop, silicon refinery, electronics fab (some need the right site) |

### Touch (phones and tablets)

The web game plays in mobile browsers: fully on a tablet in landscape, cramped but playable on a phone (portrait or landscape), with the 3D view as the main one. The page itself never zooms or scrolls; the views take every gesture. On a touch screen the status bar and **Controls** talk about fingers instead of keys.

| Gesture | Action |
| --- | --- |
| Tap | Select a room. With a tool in hand, the first tap only **aims** (the ghost shows where it lands and what it costs); a second tap on the same spot places, digs or demolishes |
| Hold | Show what's under your finger, as hovering does with a mouse; slide to look around, lift to put it down (it isn't a tap) |
| One finger | 3D: turn round the hole (Free view: up and down tilts, as with a mouse). Plan and Unrolled: pan. With the corridor tool: draw a corridor, confirmed on release |
| Two fingers | Pinch to zoom, twist to turn, move together to pan (in Free view across the floor; in Cutaway up and down). A second finger cancels whatever the first was doing |
| First person | A see-through stick, bottom left, walks and strafes (pushed all the way, you run); drag anywhere else to look round. **▲ Up** and **▼ Down** appear beside it on stairs, and **☕ Drink** at a kitchenette or serving counter |
| Map | Drag spins the planet, pinch zooms |

On a narrow screen (under 760 px), the resources run in one line that scrolls sideways, the dock stacks its strip above the mode buttons, and panels (the inspector, charts) open as a sheet over the bottom of the view, closed with ×. Touching the view folds an open room list away, so it doesn't hide where the room goes; the tool stays in hand. Keys still work with a keyboard attached.

**On the home screen.** The web game installs like an app, with its own icon (the borehole from above) and no browser bar round it:

- **Android (Chrome):** open the game, then menu ⋮ → **Install app** (or **Add to Home screen**). It opens without browser bars and, from your first tap, full screen too: the phone's status and navigation bars hide. **Settings → Display → Full screen** (only in the installed app) brings them back. It shares its saves with the game in Chrome.
- **iPhone and iPad (Safari):** open the game, then Share → **Add to Home Screen**. It opens without Safari's bars (the phone's status bar stays). A home-screen app on iOS keeps **its own saves, separate from Safari's**: export a save from the menu in Safari and import it in the app to carry a game across.

Each install opens the build it was installed from, so a PR preview added to the home screen stays that preview (with its own saves, as in the browser).

**Offline, and updates.** Once the game has loaded once, it plays without a connection (in airplane mode, say): the whole game and its typeface are kept on the device. When a newer version is out, the game downloads it quietly and shows a small banner at the top, **A new version is ready (v…) · Update**. Nothing changes until you tap **Update**: in the middle of a game it autosaves first, then reloads into the new version, and your saves carry over. ✕ puts the banner away until the next launch. It looks for a new version when you come back to the game and every hour while it runs. PR previews don't play offline; they always load fresh.

## Saving

The game autosaves every month in your browser. Use the menu to save to a slot, or export a save file to keep it somewhere safe.

## The menu and settings

**The menu** (Esc, or ☰): **Resume** first, then Save, Load, New game, Settings, Help and **Quit to title** two by two, with exporting and importing a save file as links underneath. Quitting to the title (or starting a new game) asks first: progress since the last autosave is lost. On the title, **Continue** loads the autosave. A loaded game (Continue, Load or an imported file) starts **paused**, so you can look around first; a new game starts at 1×.

**Settings** come in five sections: **Game** (autosave, the tutorial), **Display** (full screen in the installed Android app, the 3D graphics preset, sharpness and each effect), **Sound** (volume, sound effects, ambient sound), **Controls** (preview floors on hover, the keys) and **Accessibility** (interface size, colour-blind overlays). Each setting is one row: its name, a one-line hint, and a switch, slider or list. On a wide screen the sections are tabs; on a phone they stack, and sliders take a line of their own.

**By keyboard:** the menu opens with its first button ready. ↑ ↓ and Tab move (Tab stays inside the menu), Enter or Space acts, Esc goes back a step and then resumes. In Settings, ← → change section, sliders take ← →, switches flip with Enter or Space. Wherever you are, a ring shows what has the keyboard. On a touch screen every button, switch and list is at least a fingertip (44 px) tall.

The Godot viewer's menu and settings follow the same sections (those that apply there: autosave, the tutorial, the graphics level, the miniature blur, the keys, interface size and colour-blind overlays), from the same list (`data/settings.json`).
