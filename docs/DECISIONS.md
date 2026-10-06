# Decision log

A condensed record of the design conversation (Sep 26–27, 2026) between Bryon and Claude, and of what was decided while building (Sep 27–30): what was decided, what changed along the way, and what is still open. Use this to avoid reviving ideas that were already rejected.

**Where things stand (Sep 30, 2026):** milestones 1–12 are built (see "Decided while building" below and the `PLAN*.md` files). Which catalog rooms are in the game and which are only described is in `ROOM-STATUS.md`, generated from the catalog and `data/rooms.json`.

## Source of truth

When documents disagree, trust them in this order:

1. **This log** (most recent decisions and reversals), and the milestone plans' "Notes as built" (`PLAN.md`, `PLAN-M2.md` … `PLAN-M10.md`) for how things were actually built
2. **ROOMS.md**, **EVENTS.md**, **PATHWAYS.md** (detailed catalogs)
3. **DESIGN.md** (main design doc; some early sections are stale, listed below)

## Key decisions

**Identity**
- Name: **Downtown Mars**. Tagline: **"Hole sweet hole."** A quick web search found no game with that name; a proper trademark check is still needed before launch. "Hole Sweet Hole" was rejected as the title because a 2005 adult film uses it.
- Vibe: SimCity, SimTower, Terraforming Mars; Frostpunk-style social tension but chill. Sandbox; high score is total supported population.

**Player and time**
- The player is an overseer who can drop into any hole's administration office. All holes simulate at once; local administrators run the others.
- Real time with pause and speed controls.
- Story: Earth-sponsored start, then independence (with player choices) or Earth collapse, then self-reliance.

**Simulation scale**
- Colonists run as **pools** (cohorts) plus up to ~20 named **notables** per hole. Holes range from a few dozen to 10,000+ people.

**Views and tech**
- 2D unrolled view and 3D cylinder, switchable, drawing the same data. Build 2D first.
- Web first (TypeScript, PixiJS, React, Vite), sim in a Web Worker, data in JSON. Godot possibly later.

**Space**
- Rooms sit at (floor, ring, slot). Up to 6 rings: 1–3 at start, 4–5 with reinforcement frames, 6 via an excavation milestone.
- Outer rings have more slots; narrow holes grow outward, wide holes grow down.
- **Corridors run on the edges between rooms** (and between rooms and rock), not in slots; see Reversals. A walkway gallery rings the shaft, so ring 1 needs no corridors.
- Rooms come in S/M/L/H (1/2/4/8 slots). Most L/H rooms choose wide, deep or tall; grand plaza, stadium and reactor are at least 2×2×2; arena, theater, farm atrium and commons are at least 2 floors tall.
- Public rooms (plazas, markets, food courts, stadiums) are walk-through; private and industrial rooms block movement.
- Frontage: doors are automatic (one a floor, on the best wall); windows are an upgrade the player puts in (milestone 13); no wall where a corridor meets a plaza.

**Economy**
- Natural resources: regolith (rock, silica), water ice, ores, CO2 atmosphere; energy from sun, geothermal, reactors. Everything else is made.
- Silica → silicon refinery → wafers → electronics fab.
- Glass is optional on every room; substitutes cost more and lower comfort. Marscrete can replace brick at 1.5× with a comfort penalty but better cave-in resistance.
- Money has three eras: Earth credits, barter after the break, then a player-founded Mars currency.
- Rooms need staff; output scales with staffing; rooms have priority tiers for shortages.

**Starting game**
- 20 colonists, a landing pod (temporary housing for 20 plus an admin desk), landing pad, one solar array, one battery.
- Critical set: bunk dorm, life support, water tank, restroom, galley.
- Then **two farms with different crops** (e.g. potatoes 12 + soybeans 8 = 20 food), water recycler, second solar array, clinic, admin office. (The excavator bay here became the drill plus empty rooms; see Reversals.)
- Earth covers rations, water, spare oxygen and metal, machinery, electronics early on. One hole can survive alone but can't grow alone (no ore or no silica), which pushes the network.

**Network**
- New holes are seeded from a parent's staging bay; volunteers set the child's starting culture.
- Rovers and pipelines move goods; routes can be disrupted and defended.
- Culture: four sliders (Work–Leisure, Order–Freedom, Earth–Mars, Open–Insular); opinions −100 to +100 with five tiers; blocs; cohesion within holes; abandonment of unviable holes.
- An independent asteroid belt society is a third trading partner; holes can trade with it as a bloc.

**Systems defined in full elsewhere**
- 32 ordinances with slot limits by admin office size (DESIGN.md, Ordinances).
- Event catalog with strike chain, hazards, discoveries and story beats (EVENTS.md).
- Crops, size ladders, security, plazas, vertical transport, tourism rooms (ROOMS.md).

## Reversals (don't revive these)

- **Farm scaling:** farm yields were briefly raised ~1.7× so one farm fed the starting crew. Reverted: yields are back to original values, and the start uses **two farms** so players learn diet variety.
- **Kitchen and canteen at start:** replaced by a single small **galley** for the opening; kitchen and canteen are later upgrades.
- **Bar name:** briefly renamed to "Bar." Reverted to **"Bar and lounge."**
- **Gym and park:** originally one combined room; now separate rooms (gym for health, park for comfort and air).
- **Mushrooms:** a crop choice for a regular farm, not a separate room (a diagram labeled it "Mushroom farm" for clarity).
- **Electronics input:** "rare minerals" was replaced by silicon wafers.
- **Restrooms:** no longer consume their own water; they provide sanitation for 25 and return users' water as gray and black water.
- **Life support:** raised from 10 to 30 oxygen so the starting crew has margin.
- **Corridors take slots** (spokes and ring segments, a "ring road" loop): replaced in milestone 6 by corridors that run along the edges between rooms, carved out of what they pass. Don't bring back 1-slot corridor rooms.
- **Excavator bay as the digger:** replaced in milestone 9. The drill sinks the shaft on its own; every room slot is rock until it's excavated, and **empty rooms** dig ahead for rock and space. (An excavator bay may return as a faster drill; see ROOM-STATUS.md.)
- **Free space:** rooms used to sit on ready-made slots. Since milestone 9, space is dug, not given.
- **Automatic windows:** every ring-1 room used to get shaft windows and their view for free. Since milestone 13 windows are an upgrade the player puts in (old saves keep the shaft windows they had). Frontage is no longer fully automatic: doors are, windows aren't.

## Cleanup before handoff

These sections were brought in line with the catalogs, both in this kit and in the live design doc.

- DESIGN.md "Rooms and adjacency" table updated to match ROOMS.md.
- DESIGN.md's early room list relabeled "Early room brainstorm." Library, restaurant and drill production facility are unadded ideas, not decided rooms.
- Room sizes corrected everywhere to L = 4 slots, H = 8 slots.
- First playable version now lists the full starter set, including two farms, battery bank, landing pad and oxygen.
- PATHWAYS.md no longer lists restrooms as water consumers.

## Standing rules easy to miss

- Each water tank holds only one type of water: clean, gray or black (from Bryon's early room list).

## Decided while building (Sep 27–30)

Each milestone plan has the details, under "Notes as built".

- **Tick model:** 240 ticks a game day; 1× is 2 ticks a second (so a day is 2 minutes), with 2× and 4× (`data/config.json`). Resources are one pool per hole, no pathing. Neighbor effects are a per-slot field rebuilt when the layout changes (`PLAN.md`).
- **Rings:** only rings 1–3 are open. Rings 4–6 and their unlocks (reinforcement frames, the excavation milestone) aren't built yet.
- **Build UI:** four modes as in SimCity (Build, View, Map, Charts); Build has a strip of room categories. Room keys work only in Build. A yellow frame shows Build is on (`PLAN-M2.md`, `PLAN-M6.md`, `PLAN-M10.md`).
- **Save format:** autosave every game day in the browser, save slots, and export to a file (`PLAN-M2.md`).
- **Tutorial:** a deputy walks new players through the start (`data/tutorial.json`).
- **3D view (M3):** the main view; new games open in 3D Iso. Cutaway, Top, Iso and first person, X-ray and walls down. **Art direction:** a cozy, miniature look (soft shadows, glow, warm haze and grade, furnished rooms; `ART.md`, `PLAN-M10.md`). Space Grotesk for the UI and labels.
- **Network (M4):** a real Mars globe from NASA MOLA data. New holes are founded from a staging bay; rover depots and trade routes; culture drift and opinions between holes.
- **People (M5):** cohorts of children, adults and elders; births, aging, retirement, deaths, migration; school, elder care and crypt.
- **Corridors on edges (M6).** **Construction time (M7):** a queue per hole, paced by construction offices. **Storage (M8):** dry goods keep only what storerooms, warehouses and depots have room for.
- **Excavation and the entrance (M9):** the entrance on floor 1 is the only way in; stairs and elevators reach deeper floors; a cargo elevator at 100 colonists.
- **Furnishing (M10):** every room type has a furniture template; rooms of a kind vary (mirrored, stand-ins, shades).
- **Condition and upkeep (Sep 30):** rooms wear; worn rooms upset people, slow down and stop at 0%; breakdowns now and then. Maintenance rooms (using machinery) and, from 150 colonists, cleaning services (using water) repair them from a hole-wide queue (`data/condition.json`).
- **Housing tiers:** dorms, then studios and apartments at 50 colonists, flats and family apartments at 200, suites and residences at 1,000.
- **Dust storms** are forecast, then halve solar output for a day or two.
- **Staffing cuts (Bryon, Sep 30):** farm 5, life support 3, landing pad 1, rover depot 3; solar arrays, restrooms and small plazas need no staff.
- **Afterglow (Bryon, Sep 30):** a new hole's happiness starts +20 and eases to nothing over 20 days (slowly, then faster, then slowly), so the player can set up critical systems and stock up before unhappiness bites. Counted from each hole's founding (`happiness.afterglow`).
- **History and charts (Sep 30):** hourly samples for 10 days and daily averages for the whole game; sparkline tooltips on the top bar and Charts → Trends.
- **Air quality (Sep 30):** a fifth neighbor effect with an Air overlay. Every cell starts at a baseline by ring (0, 0, −1, −1.5, −2, −2.5; `effects.airQualityByRing`), so outer rings need ventilation; corridors don't block it. At home it adds to the health factor (`happiness.airHealth` 1). Ventilation hubs from the start (catalog: pop 100), so ring 3 can be fixed as soon as it's used. Crowding isn't modeled yet.
- **Idle crews stand by:** maintenance and cleaning rooms with nothing to repair use only power.
- **Rooms can be renamed**; farms are named after their crop.
- **More rooms (Sep 30):** kitchen and canteen, gym, park, hospital, brickworks, recycling center, waste storage. **Seating:** galleys seat 25 and canteens 60; kitchens cook but seat no one; diners without a seat cost comfort. Unlocks moved earlier than the catalog so players have more ways to lift happiness: gym and park at 50 colonists (catalog 100), recycling center at 100 (300), hospital at 300 (1,000); brickworks stays at 50 (`config.unlocks.rooms`).
- **Built so far, not the full design:** 5 ordinances (Quiet hours, Water rationing, Ration cards, Closed borders, Return to the soil), 2 kinds of citizen visit (noise complaint, clinic demand), and overlays for noise, smell, health, comfort, happiness and condition. The design's 32 ordinances and full event catalog are still the target.

## Decided for milestone 11 (Sep 30, in conversation)

See `PLAN-M11.md`: built (Sep 30), with its notes as built.

- **The shaft is outside:** open to Mars, not breathable or walkable. People live in a sealed network of rooms, corridors, stairs and glass gallery tubes.
- **Air is an internal loop:** ventilation hubs scrub and circulate; nothing vents to the planet. Stale air means contamination and distance from the air trunk in the shaft wall.
- **The gallery becomes buildable corridor** (glass tubes along the shaft), built on floor 1 at the start, laid by the player elsewhere. Direct shaft windows get the bigger view bonus (1.5 comfort); rooms behind a gallery tube get less (1, the old bonus), so nothing already built gets worse.
- **Effects travel three ways:** what you sense by nearness (noise, heat, view), what you breathe through the air network (air quality, smell), what you use by walking distance (parks, plazas, gyms, canteens, clinics, schools, elder care). Parks, plazas and canteens also keep a small nearness bonus.
- **Noise stays nearness-based,** and corridors still soak it up; smell now rides the air through corridors.
- **Steps:** one per room or corridor segment, stairs one between floors; reach is data (about 6 for a plaza, 10 for a clinic). Stairs carry air and people, elevators people only.
- **Services fill nearest first:** homes use the nearest clinic, school or elder care in reach, and spill over to the next one in reach when it's full.
- **The dome** over the shaft is a hole's end goal (a later milestone).

## Decided for milestone 12 (Sep 30)

See `PLAN-M12.md` (Claude's defaults, built at Bryon's "let's do all that"; every number is in data).

- **Bulkheads** on built corridor segments (not tubes): air and smell stop, people pass. 2 metal; free to take out.
- **Dust through the airlock:** air quality −1 by the airborne rules, twice as bad in a dust storm.
- **Crowding:** past 5 residents a cell, a home loses 0.15 air quality per resident a cell (a full bunk dorm −0.45).
- **Window walls** where no tube runs; open space and walk-through rooms walled off from the shaft without one.
- **Glass** and the **glassworks** (from 200 colonists; since milestone 13, from the start).
- **The shaft dome**, from 300 colonists: every gallery open walkway, the shaft an atrium (+0.5 comfort facing it), air +0.5 everywhere, no storm dust through the airlock.

## Decided for milestone 13 (Sep 30)

See `PLAN-M13.md` (Bryon's request; the numbers are Claude's defaults, in data).

- **Doors on any wall:** one per floor, on the best wall a room has: a gallery tube first, else the longest corridor, else a walk-through room. Every room touching a corridor has a way in.
- **Windows are an upgrade,** off by default. The corridor tool's **Windows** mode glazes a whole wall at a click, only where the shaft, a corridor or a walk-through room is across it. **Windows cost glass** (2 per 10 m; Bryon, Oct 1). To make that work early, the landing kit brings 100 glass (the pod holds 100 more units for it) and the glassworks is available from the start, smaller and cheaper: 2×1, 2 staff, rock 4 and power 3 → glass 3 a day, built from rock 20 and metal 4. (A metal price was tried first and stalled the bots; rock was a stopgap.)
- **Window comfort (homes):** the best wall's view, averaged along it: open shaft 1.5, shaft through a tube 1, a plaza or stairs 0.75, a corridor 0.25; +0.25 for each other glazed wall, up to 2; the dome's atrium on top. Replaces the automatic shaft view.

## Decided for milestone 14 (Oct 1)

See `PLAN-M14.md` (Bryon: drill discoveries, then the belt ship, then celebrations; the numbers are Claude's defaults, in `data/events.json`).

- **Events sting, they don't crush,** and **don't pause the game:** a card waits with its choices and a deadline; ignored, it takes its own course.
- **Drill discoveries:** a 45% chance each floor (the first always), six finds by depth. **The belt ship:** from day 20, 3% a day, at most once in 25 days. **Celebrations:** one per milestone, a festival or a toast.
- **Events roll their own dice** (hashed from a seed kept with them), never the hole's random stream, so adding an event doesn't reshuffle storms, births and visits.

## Decided for mobile browsers (Oct 5–6, T-025)

- **What mobile gets:** tablets in landscape fully playable; phones playable but cramped (portrait and landscape), with the 3D view as the main one (Bryon, Oct 5). The furnishing tool and Godot stay desktop-only.
- **Gestures:** one finger orbits in Cutaway and Iso and pans in Plan and Unrolled; two fingers always pinch-zoom, twist and pan (Bryon, Oct 5). Top still turns with one finger (it has no pan, and T-052 drops it).
- **Tap to aim, tap again to act** for every tool (rooms, demolish, a single corridor border, windows, bulkheads), since a finger can't hover first; with no tool a tap selects at once. A long press stands in for hover. Claude's default; the shared logic is `src/view/touch.ts`.
- **First person on touch:** a translucent joystick bottom left (analog: push further to walk faster, all the way to run), stair buttons beside it, drag elsewhere to look (Bryon asked for arrows or a stick, Oct 6; the stick won).
- **Narrow screens (under 760 px)** get panels as bottom sheets and a one-line, sideways-scrolling resource bar; wider tablets keep the desktop layout.

## Still open

Deliberately not decided yet:

- **Simulation at scale:** how many holes (and 10,000-person holes) run efficiently. Two holes run fine today.
- **Audio direction.** Today's sound is synthesized placeholder effects and a hum (`src/audio/sound.ts`). (Art direction is settled: the cozy 3D look.)
- **Full balancing pass:** the starter rooms and the first month are tuned (the playtest bots check them); mid- and late-game numbers are rough placeholders.
- **Build roadmap past milestone 10:** what to build next. `ROOM-STATUS.md` grades the unbuilt rooms by how big a step each is.
- **Rings 4–6** and how they unlock.
- **Smaller items:** difficulty settings, accessibility, mod support.
- **Trademark check** for "Downtown Mars."
- **Web or Godot, and the repo's layout.** The Godot viewer (`godot/`) is close to parity with the web game, with the sim still in TypeScript; whether it becomes the main version (and the sim moves to C#) isn't decided. Moving the web code into its own folder was considered (Oct 3) and held off: if it's done, split into `core/` (sim and shared view code), `web/`, `godot/` and `bridge/`, not a bare `web/`.
