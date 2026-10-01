# Downtown Mars — Game Design Doc

*Hole sweet hole.*

Sep 26, 2026 · Bryon

> Companion documents from the original design doc: **Room catalog**, **Resource pathways** and **Event catalog**. They are referenced below by name.

## Pitch and pillars

A real-time city builder on Mars where each city is a borehole: you dig down, carve rooms into the walls, and grow a network of holes whose cultures drift apart.

- **Two layers, one idea.** Proximity creates effects. Rooms affect neighboring rooms inside a hole; holes affect each other across the planet. Failing at either layer limits the other.
- **Bend with the wind.** You shape the colony through building, resources and ordinances, but cultures and factions emerge that you can steer, not control.
- **Vibe:** SimCity, SimTower and Terraforming Mars, with some of Frostpunk's social tension but chill rather than crushing.
- **Mode:** Sandbox. The goal is a self-sustaining network; total supported population is the high score.

## Where the build stands (Sep 30, 2026)

This doc is the design target; the game builds toward it. Milestones 1–12 are done (11: gallery tubes, air through the network, services by walking distance; 12: bulkheads, airlock dust, crowding, glass and the shaft dome): one or two holes, the 3D view, people, corridors on edges, construction time, storage, excavation and the entrance, furnished rooms, and condition and upkeep. Sections below carry an **As built** note where the game differs today. `DECISIONS.md` lists what was decided while building, and `ROOM-STATUS.md` which rooms are in the game.

| Area | In the game | Not yet |
| --- | --- | --- |
| The borehole | Floors dug by the drill; rooms excavated from rock; entrance, stairs and elevators; the shaft open to Mars, with a sealed network of gallery tubes, corridors and stairs (milestone 11) | Rings 4–6; cave-ins; choosing a diameter |
| Rooms | 56 room types (see `ROOM-STATUS.md`) | About half the catalog, H-size rooms, multi-floor rooms beyond stairs and elevators |
| Resources | Air, water (clean, gray, black), food, soil, waste, rock and ores, brick, marscrete, metal, machinery, wafers, electronics; storage for dry goods | Glass, plastics, textiles, consumer goods, currency |
| Happiness | Three factors: noise, health and comfort (smell, shaft views, homelessness, care, seating at meals, ordinances and room condition feed them); parks, plazas, gyms and clinics lift the homes within walking reach; air quality feeds health | Safety, entertainment, diet variety, crowding |
| Office and ordinances | Citizen visits (noise complaint, clinic demand) and promises; 5 ordinances | The other 27 ordinances, delegation |
| People | Children, adults, elders; births, aging, deaths, migration; notables | Skills, mentoring, factions and strikes |
| Network | A Mars globe (MOLA terrain), founding holes, rovers, trade routes, culture sliders and opinions | Pipelines, the belt, independence, blocs |
| Hazards | Dust storms, breakdowns and wear | Cave-ins, outbreaks, difficulty settings |
| Views and sound | 3D (the main view), the 2D unrolled view, the plan view, overlays, flows; synthesized sound effects and an ambient hum | Real audio: music, recorded sound |

## The borehole

Every hole starts as a small shaft; rooms are carved into its wall, then floors stack downward and rooms expand outward from the cylinder.

- **Coordinates:** every room sits at (floor, slot around the ring, distance outward). Each floor is a loop with no edges, so neighbors exist along the ring, above/below, and radially.
- **Digging cost rises with depth.** At some point starting a new hole beats digging deeper.
- **Depth is double-edged:** deeper floors are costlier but better shielded from radiation and warmer, making them prime housing. Shallow floors suit noisy industry.
- **Diameter is chosen per hole.** Wider holes fit more rooms per floor, produce more and house more colonists, but cost more to dig.
- **The shaft is the spine.** Elevator capacity and commute time make distance from the center a real cost. Gravity helps: waste flows down, clean water is pumped up.
- **Excavated rock is a resource:** bricks, radiation shielding, or trade goods, so digging partly pays for itself.

### How far rooms extend outward

Each floor holds rings of rooms around the shaft, with ring 1 facing the shaft itself. The number of rings is capped.

- **Rings 1–3** are available from the start.
- **Rings 4–5** unlock once the hole has reinforcement frames.
- **Ring 6** is the hard cap, unlocked by an advanced excavation milestone.

**As built:** only rings 1–3 exist; the unlocks for 4–6 aren't built. The starter hole is R = 10 m with 9, 16 and 22 slots.

**Trade-offs of building outward:** each ring out costs more to dig, lengthens commutes (corridors required), raises cave-in risk and needs ventilation hubs for fresh air. In return, outer rings are quieter and more private, good for housing without a view, storage, or industry kept out of the way.

**Outer rings are bigger,** because each wraps a wider circle. Approximate slots per ring:

| Hole | Ring 1 | Ring 3 | Ring 6 |
| --- | --- | --- | --- |
| Narrow | 9 | 22 | 40 |
| Wide | 28 | 41 | 60 |

Narrow holes gain the most by expanding outward, since their outer rings more than double in size; wide holes gain more from digging down. The diameter choice therefore shapes each hole's building style.

### Corridors and access

**As built (milestone 6, reversing this section):** corridors don't take slots. They run along the edges between rooms, and between rooms and rock, carved out of what they pass; spokes and ring roads as slot-rooms are gone. The gallery and the access rule stand. See `PLAN-M6.md`. The original design follows.

Corridors take up slots just like rooms, rather than getting rings of their own, so every corridor is a placement trade-off.

- **Shaft gallery:** a walkway ledge rings the shaft on every floor. Ring 1 rooms open straight onto it and never need corridors.
- **Spokes** run outward from the shaft, taking one slot in each ring they pass through, including ring 1.
- **Ring segments** run around a ring, connecting rooms sideways to a spoke.
- **Access rule:** every room needs at least one side touching a corridor, a plaza, or the shaft gallery.
- **Ring road:** a complete loop of ring segments around a floor gives faster transit than scattered segments. Costly in slots, worth it on busy floors.

Every spoke costs a ring 1 slot, the prime shaft-view real estate, so players want few spokes that each serve many rooms. Corridors also buffer noise, and plazas can stand in for corridors, making a plaza at a spoke junction a natural town square.

### Room shapes

Large rooms can be laid out wide (along the ring), deep (across rings) or tall (up floors). Most choose their shape; a few have fixed minimums.

- **Flexible:** most L and H rooms let the player pick an orientation within their slot count, e.g. an 8-slot hive block as 4 wide × 2 rings or 4 wide × 2 floors.
- **Naturally deep:** industrial complexes, deep reservoirs and distribution hubs suit spanning rings. Placing them in outer rings keeps their noise far from the shaft.
- **Wedge bonus:** a room spanning several rings is wedge-shaped, and its outer part is wider, so it gets slightly more capacity than the same slots laid along one ring.
- **Access:** even a room spanning rings needs one side on a corridor, plaza or the shaft gallery.

| Fixed-shape room | Minimum shape |
| --- | --- |
| Grand plaza | 2 wide × 2 rings × 2 floors |
| Stadium | 2 wide × 2 rings × 2 floors |
| Reactor | 2 wide × 2 rings × 2 floors |
| Arena | At least 2 floors tall |
| Theater | At least 2 floors tall |
| Farm atrium | At least 2 floors tall |
| Commons | At least 2 floors tall |

**Pass-through vs. blocking:** public rooms (plazas, market halls, food courts, stadiums) let people walk through and count as corridors, so a deep plaza can serve as a spoke and a town square at once. Private and industrial rooms block movement, so corridors must route around them, and a badly placed factory can cut off the rooms behind it.

## Rooms and adjacency

Placement is the core puzzle: each room emits effects that fade with distance, like ripples in a pond, and neighbors feel them.

- Effects include noise, health, smell, heat and comfort, each with a strength and falloff.
- Effects travel along the ring, between floors, and outward, so a factory directly above housing is as bad as one beside it.

| Room | Converts | Effect on neighbors |
| --- | --- | --- |
| Farm | Water + soil + CO2 + power → raw food and a little O2 | Smell −1 |
| Kitchen | Raw food → cooked food | Smell −1 |
| Canteen | Serves cooked food | Comfort +1 |
| Restroom | Sanitation; returns users' water as gray and black water | Smell −1 |
| Life support | Water + power → O2; scrubs CO2 | Noise −2 |
| Factory | Raw materials → goods | Noise, lowers comfort |
| Clinic | Staff time → care | Health +2 |
| Administration office | Handles citizen visits and ordinances | See its own section |

Full list with stats and costs: see the **Room catalog**.

### Frontage: windows, doors and storefronts

What a room faces shapes how it looks and what it earns. Walls and doors are generated automatically from its neighbors; windows are an upgrade the player puts in (milestone 13: see DECISIONS.md, which wins where this section differs).

| Room faces | What appears | Effect |
| --- | --- | --- |
| The shaft (inner edge of the hole) | Large windows looking out across the hole | Comfort +1 from the view and light; premium spots for housing, hotels, restaurants and offices |
| A corridor | Doors, windows, and storefronts on commercial rooms | Access for the room; storefronts draw passing foot traffic |
| A plaza | Doors, large windows, and open storefronts | Comfort +1 from windows; storefronts get a bigger customer bonus than on corridors |
| Another room | A plain wall | Neighbor effects pass through as usual |

- **Corridor meets plaza:** no wall between them. The corridor opens straight into the plaza, carrying a little of the plaza's comfort and customer bonus into the corridor.
- **Inner ring is scarce real estate:** only the ring facing the shaft gets the view, so the player chooses who earns it.
- **Rendering:** walls, windows, doors and storefronts are picked automatically from each face's neighbor, like auto-tiling, in both the 2D and 3D views.

### Early room brainstorm

Bryon's first room list, from before the room catalog existed. Most of these are now covered in ROOMS.md; library, restaurant and a drill production facility are ideas not yet in the catalog. The water-tank rule below still stands.

- **Residential:** dorms, apartments, homes. Each trades off capacity, noise suppression, comfort and similar factors.
- **Water:** well, reservoir tanks, restrooms, water treatment plant. A tank stores only one type of water (clean, gray or black).
- **Food:** farms (several types), storage, kitchen, dining hall / mess / canteen, restaurant.
- **Mining:** drill production facility, storage, brick works, refinery.
- **Amenities:** library, medical clinic, plaza, school, theater, gymnasium, indoor park.

## Resources and flows

The economy is a set of conversion chains, and the player should always be able to see where each resource comes from and where it goes.

- **Core resources:** water, food (raw and cooked), earth (excavated rock), electricity, money, soil, metals and ores, oxygen, CO2, solid waste, brick, marscrete, glass, silica, silicon wafers, plastics, fiber, methane, machinery, electronics, beer, consumer goods (clothing, furniture, toys, appliances), pipe segments, rovers.
- **Chains:** rooms turn inputs into outputs, e.g. farm → raw food, kitchen → cooked food, restroom → dirty water.
- **Water ledger:** track sources (deep well, imports, ice), transformations (drinking → gray → black water), recycling rates per room, and losses to leaks.
- **Flow diagram UI:** a river-style chart shows each resource's full path, so a leak or bottleneck is visible at a glance.
- **Self-sufficiency is hard at scale:** waste, noise and friction grow faster than population, and some essentials only exist in certain regions.

*Resource flow overview:* four tiers. **Natural resources** (regolith: rock and silica; water ice: ice and aquifers; ores: metals and minerals; atmosphere: CO2 and dust) feed **refined materials** (brick, glass and marscrete; clean water and O2; metal and silicon wafers; plastics and methane), which feed **products** (food; machinery and electronics; consumer goods; rovers and pipe), which colonists and rooms use. Waste loops back up to refined materials.

Only regolith, water ice, ores and the CO2 atmosphere are mined; everything else is made, and recyclers, composters and life support send waste back up the chain. Silica from regolith becomes silicon wafers for electronics. Energy comes from sunlight, geothermal heat and reactors.

Each pathway in detail, with the rooms involved: see **Resource pathways**.

## Colonists and happiness

Population runs as pools with a few named notables on top, which scales from a few dozen colonists to 10,000+ per hole.

- **Pools:** cohorts grouped by job, housing and floor carry the simulation math.
- **Notables:** named individuals surface for stories, demands and decisions. In a tiny hole everyone is notable; as it grows, individuals fade into cohorts.
- **Happiness** is an aggregate of health, entertainment, comfort, noise, safety and more. Low happiness cuts productivity.
- **Ordinances** tune a single hole, e.g. a day of rest or compulsory doctor visits.
- **Demands and strikes:** citizens may demand specific rooms. Refusing risks a general strike, which halts production and can ripple through the supply chain.
- **Soft failure:** problems escalate slowly with clear warnings. Unhappy colonists emigrate to other holes first; death only follows prolonged neglect.

## Ordinances

Ordinances are hole-wide rules that trade one benefit for a cost and nudge the hole's culture. Picking which few to enact is the decision.

- **Limited slots,** set by the admin office's size: admin desk 1, admin office 2, town hall 4, council chamber 6.
- **Per hole:** each hole has its own ordinances, and a local administrator may enact or repeal them while you're away, depending on personality.
- **Settling in:** effects ramp up over a few days, and notables react according to their traits.
- **Repealing popular ordinances hurts** more than never granting them.
- **Enforcement:** security makes mandatory ordinances more effective, at the usual cost of pushing toward Order.
- **Network charters:** after independence, holes in a bloc can sign shared ordinances that apply to all of them.

| Ordinance | Effect | Culture push |
| --- | --- | --- |
| **Work** | | |
| Day of rest | Happiness up; output down about 10% | Leisure |
| Extended shifts | Output up 15%; health and comfort down; strike risk up | Work, Order |
| Essential services draft | Critical rooms always fully staffed; loyalty down | Order |
| Apprenticeships | Workers gain skills faster; uses school capacity | Work |
| Hazard pay | Unpopular jobs (deep floors, loud factories) fill easily; costs goods or currency | — |
| Construction overtime | Build speed up; crews tire | Work |
| **Health and safety** | | |
| Compulsory checkups | Health up; clinics busier | Order |
| Quarantine protocol | Outbreaks end faster; comfort drops during one | Order |
| Fitness hour | Health up; output down slightly | Leisure |
| Emergency drills | Hazards recover faster; small regular output dip | Order |
| **Resources** | | |
| Water rationing | Water use down 25%; comfort and health down slightly | Order |
| Ration cards | Food use down 15%; comfort down | Order |
| Recycling mandate | Waste recovery up 20%; small labor cost | Order |
| Power curfew | Night power use down; comfort and safety down | Order |
| **Families and livability** | | |
| Compulsory schooling | Children grow into more skilled adults; uses school capacity | Order |
| Family allowance | Births up; more food, housing and schools needed | Mars |
| Quiet hours | Noise effects halved at night; industrial output down slightly | Leisure |
| Green corridors | Air quality and comfort up in public spaces; more water use | — |
| Fair housing lottery | Homes assigned by lottery; comfort evens out; luxury residents resent it | Freedom |
| **Society** | | |
| Festival days | Entertainment up; consumes food and goods | Leisure, Open |
| Free assembly | Protests allowed in plazas; strikes less likely to escalate, unrest more visible | Freedom |
| Curfew | Safety up; comfort and nightlife income down | Order |
| Open doors | More migrants arrive; crowding rises | Open |
| Closed borders | No migration; slower cultural drift | Insular |
| Visitor zones | Tourists stay in plazas and hotels; locals happier, tourists spend less | Insular |
| **Governance** | | |
| Elected administrators | Residents choose their admin; happiness up, admin answers to locals more than to you | Freedom |
| Colony newsletter | Early warning of trouble; criticism spreads | Freedom |
| Censorship | Calm on the surface; resentment builds unseen until it bursts | Order |
| **Economy and identity** | | |
| Price controls | Goods cheaper; shops earn less; shortages possible | — |
| Tourism tax | Income up; fewer tourists | — |
| Earth heritage day | Pushes loyalty to Earth | Earth |
| Martian founders day | Pushes Martian identity | Mars |

- **Paired choices:** newsletter and censorship, open doors and closed borders, and the two heritage days are mutually exclusive.

Every visit, hazard, discovery and story beat, with its choices: see the **Event catalog**.

## Administration office and delegation

Events and decisions are framed as citizen visits to a hole's administration office, and the player is an overseer who can drop into any hole's office.

- **A real room with limits.** Upgrades add staff: more visits per day and more ordinances. An undersized office becomes a bottleneck.
- **Placement shapes whose voices you hear.** Near housing, residents visit more; near industry, workers do.
- **The waiting room is a pressure gauge.** Petitioners queue while time flows; leave them too long and their cohort's happiness dips.
- **All holes run at once.** Holes outside your active view are run by local administrators, who are notables with skills and personalities.
- **Delegation dial per category,** e.g. handle routine requests, hold ordinance decisions, escalate strikes. Crises always break through.
- **Personality drives choices:** a populist grants demands freely, a cautious admin refuses often, an industrialist favors output over comfort.
- **"While you were away" briefing** opens each visit: what was decided, by whom, and the result.
- **Admins drift with their hole,** absorbing local culture over time. Replacing one with a loyal outsider may anger locals; promoting from within is popular but less predictable.
- **Evolves with the story:** a mission office reporting to Earth before independence, possibly a council chamber of hole delegates after.

## The network

Multiple holes support each other through trade, so one hole can live beyond its means if others carry it, but every hole has its own happiness and opinions.

- **Map mode:** pick sites for new holes. Regions are richer in resources like iron ore, silica or water aquifers, and some essentials exist only in certain regions.
- **Recurring trades** move resources between holes on a schedule.
- **Two ways to move goods:** rovers are cheap to start and cover long distances easily but get expensive to scale to large volumes; pipelines cost a lot to build but carry huge volumes with little upkeep.
- **Routes can be disrupted** by weather events, pirates, or a desperate hole diverting a resource it badly needs. Disruptions shift opinions between the holes involved.
- **Routes can be defended** by hiring security, adding defense upgrades, and keeping good relationships with neighboring holes.
- **Specialization pays:** focused holes gain efficiency bonuses, which rewards interdependence but feeds cultural drift.
- **Opinions between holes** affect trade prices and whether holes will deal with each other at all.
- **Cultural drift** has several drivers: how different two holes' rooms and amenities are, their distance, trade imbalance, ordinances, the consequences of events and narrative decisions, relationships with other holes (being friends with a hole's rival hurts), and some randomness. A hole that gives much and gets little starts to resent the ones benefiting.
- **Drift speed sets difficulty.** Slower drift is easier to play. Within a game, drift starts slow and picks up pace over time.
- **Narrative drift events** push a hole apart in one step, e.g. "this hole adopted new slang" isolates it from the others while raising cohesion within it.
- **Cohesion inside a hole:** each hole also has a cultural cohesion level, the flip side of drift. High cohesion makes colonists slower to emigrate and more resilient to adverse events like disruptions or shortages. Events that push a hole away from the network, such as new slang, often pull its people closer together.
- **Distance trade-off:** far-off holes drift faster but may reach unique or abundant resources.
- **Emergent factions:** drift can produce blocs, embargoes, or a hole seeking independence from the network.
- **Abandonment:** if enough colonists leave or die, the ones who remain can decide the hole has dropped below a minimum level of viability and abandon it. Abandoned holes stay on the map but produce nothing, and no one can move back into them.

**Pipelines:** nearby holes can be linked by pipelines built from pipe segments, moving water, oxygen or methane continuously with no rovers needed. Cost scales with distance, and storms or cave-ins can break them. Rovers, built in a vehicle works and fueled by methane, carry everything else.

**Founding new holes:** every new hole is seeded from an existing one. The parent hole builds up machinery, food, water and citizens, and that stockpile becomes the starting seed of the new colony.

- **Staging bay:** a room in the parent hole where the seed kit accumulates: drill rig, power unit, food, water and volunteers. The parent runs leaner while it fills.
- **Seed size sets the ceiling:** a bigger drill rig allows a wider diameter for the new hole.
- **The journey:** the seed travels by rover convoy. Farther sites take longer and consume food and water en route; dust storms can delay or damage the convoy.
- **Founder effect:** volunteers come from specific cohorts, and the new hole's starting culture profile comes from theirs. Sending malcontents relieves pressure at home but creates a restless child hole.
- **Parent-child bond:** a new hole starts with high opinion of its parent, fading with drift and distance. Early aid to a struggling child doesn't count against fairness.
- **Timing:** founding drains workers and stock from the parent, so seeding too early can destabilize both holes.

**Asteroid belt society:** an independent belt society is a third trading entity alongside Earth and the Mars network. Holes can barter with it or pay in currency.

- **Bloc deals:** several holes can trade as one bloc in a specific deal, pooling contributions and sharing returns. How the contributions and returns are split feeds each hole's fairness ledger, so a lopsided bloc deal can breed resentment inside the bloc.
- **What they trade:** the belt offers metals, ice and rare electronics, and wants food, soil and manufactured goods that are hard to make in space.
- **Launch windows:** shipments arrive on an orbital cadence rather than on demand, and need a landing pad.
- **Their own opinion:** the belt society holds opinions of each hole or bloc, and could step in as a sponsor around independence.

## Story arc

The sandbox has a loose three-act shape: an Earth-supported start, a break, then self-reliance.

1. **Supported start.** The player is mission leader for an Earth government colony project. Periodic supply drops from the Earth benefactor get things going.
2. **The break.** Mars citizens vote for independence, or the Earth government collapses. Free resources stop.
3. **Self-reliance.** The network must sustain itself.

- Earth may ask for something back early, such as export quotas, creating tension before the break.
- The break is telegraphed through rising independence sentiment or shaky Earth news, so players can prepare.

## Presentation and time

The game runs in real time with pause and speed controls, and the player can switch freely between a 2D unrolled view and a 3D cylinder.

- **One model, two cameras.** Both views draw the same room coordinates, like a map and a globe, so they stay in sync.
- **2D unrolled** suits management: planning layouts, reading overlays for noise or health.
- **3D cylinder** sells immersion and the feeling of a city in a hole.
- **Build order:** 2D first, 3D later, with no data rework.

**As built:** 3D is now the main view (new games open in 3D Iso), with Cutaway, Top, first person, X-ray and walls down; the unrolled 2D view and a top-down plan view sit beside it. 1× runs 2 ticks a second, 240 ticks a game day.

## First 30 minutes

The opening session teaches digging, adjacency, the office and the water ledger, then teases the network.

| Time | What happens |
| --- | --- |
| Minute 1 | A landing pod arrives with 20 colonists and a starter drill. The player places the first hole (small diameter, no choice yet). |
| Minutes 1–10 | Dig three floors and place dorm, life support, water tank, restroom and galley, then two farms growing different crops. A deputy notable walks through the first adjacency problem: life support noise keeping dorms awake. |
| Minutes 10–20 | First supply drop lands. First citizen visits the office. The water flow diagram unlocks as recycling becomes necessary. |
| Minutes 20–30 | Population reaches about 50. Map mode unlocks and a second site is scouted, in a region with something the first hole lacks. |

### Starter set

The first hole survives with a free landing kit plus five rooms, while Earth shipments cover the gaps until farms and recycling come online.

| Tier | When | Rooms |
| --- | --- | --- |
| 0: Landing kit | Free at landing | Landing pod (temporary housing for 20 and an admin desk), landing pad, one solar array, one battery bank |
| 1: Critical set | First few days | Bunk dorm, life support, water tank, restroom, galley |
| 2: Weaning off Earth | First few weeks | Two farms with different crops (e.g. potatoes and soybeans), water recycler, second solar array, clinic, excavator bay, admin office |

**Daily budget for 20 colonists with tier 1 built**

| Resource | Needed | Supplied | Gap covered by |
| --- | --- | --- | --- |
| Oxygen | 20 | 30 from life support | — |
| Food | 20 | 25 served by the galley | Earth rations until two farms are running: potatoes (12) and soybeans (8) make 20 a day and cover two food groups |
| Water | About 48 (colonists, life support, galley) | Tank holds about 4 days | Earth shipments; the recycler later returns most of it |
| Power | About 9 | 10 from one solar array | Tier 2 needs a second array |

- **Earth covers** food rations, water, spare oxygen, and every material the hole can't make yet: metal, machinery and electronics. Shipments shrink as each tier 2 room comes online.
- **Why the network follows:** one hole can feed and water itself, but it can't make metal without ore or electronics without silica, and most sites have only one. The first hole survives alone but can't grow alone.

## Population growth

Colonists arrive from Earth early on; births take over once a hole is healthy and happy, and after independence births and migration are the only sources.

- **Births** require a clinic and happiness above a threshold.
- **Migration** moves colonists between holes, mostly away from unhappy ones.
- **Three life stages:** children need schools and don't work; adults work; elders need care and can mentor to raise skills. No finer detail, to keep pools simple.

## Energy, hazards and the surface

Power sources trade cost against reliability, hazards are forecast and recoverable, and the surface is a small, exposed footprint above each hole.

| Power source | Where | Trade-off |
| --- | --- | --- |
| Solar | Surface only | Cheap; output drops in dust storms |
| Geothermal | Below a set depth | Expensive; very stable |
| Reactor | Mid-game unlock | Powerful; noisy and feared by neighbors |

Power travels down the shaft, so a failing surface array affects the whole hole.

- **Dust storms:** forecast days ahead; cut solar output.
- **Cave-ins:** risk rises with depth and diameter; reinforcement rooms reduce it.
- **Outbreaks:** spread through crowded, low-health areas; clinics contain them.
- **Equipment failures:** aging rooms need maintenance.
- Hazard frequency follows a difficulty setting, and every hazard gives warning.

**As built:** dust storms (forecast, then halving solar for a day or two) and room wear with breakdowns, repaired by maintenance and cleaning services. No cave-ins, outbreaks or difficulty settings yet.

**Surface:** each hole has a limited footprint for solar arrays, a landing pad and a rover depot, exposed to storms and radiation. Rovers carry trade between holes along visible map routes, with travel time and storm disruption.

## Research, money and commerce

Unlocks come from milestones, money changes form across three eras, and shops and offices rise and fall with it.

**Research:** no tech tree screen. Population thresholds, depth reached, or a visiting scientist's proposal unlock rooms. Research labs speed milestones, and specialized holes unlock specialized rooms, e.g. a mining hole unlocks an advanced smelter.

| Era | Money | Shops |
| --- | --- | --- |
| Earth-supported | Earth credits buy supply drops and specialist shipments | Thrive selling Earth imports |
| After the break | Credits are worthless; holes barter at rates set by supply, demand and opinion | Shrink into swap markets and ration depots |
| Mars currency | Player founds a currency; it holds value only on a stable network | Revive as the consumer economy |

- **Shops and stores** turn goods into comfort and entertainment for nearby housing. In the currency era, spending in shops keeps the currency in circulation and helps it hold value.
- **Offices** employ colonists not needed for blue-collar work in large holes. Benefits:
  - Offset a coordination penalty: productivity drops as a hole grows, like a company without managers, and offices cancel it.
  - Produce tradeable services (engineering plans, logistics, finance) that cut build or trade costs in other holes and need no rovers.
  - Absorb surplus workers, since unemployment lowers happiness.
- Office workers are quiet neighbors but expect more comfort and shops nearby.

## Tourism

A hole can specialize as an entertainment destination, earning income from visitors who stay in hotels and book experiences.

- **Rooms:** hotel rooms in several quality tiers, entertainment venues, and tour companies running surface excursions.
- **Landmarks draw visitors:** holes near real Mars landmarks, like Olympus Mons or Valles Marineris, attract more tourists thanks to the real terrain.
- **Where visitors come from:** Earth before independence (afterward depends on relations), the belt society, and residents of other holes.
- **Reputation:** tourists avoid unhappy, unhealthy or noisy holes, so tourism rewards a well-run hole.
- **Costs:** tourists eat, drink, breathe and add crowding, and need landing pad capacity.
- **Culture:** tourism pushes a hole toward Leisure and Open, which can widen the gap with industrial holes.

## First playable version

The first build proves the adjacency puzzle is fun inside one hole; the network layer comes after.

- One hole, one diameter. Two starting farms introduce crop choice and diet variety.
- Rooms: bunk dorm, galley, farm (two of them, different crops), water tank, water recycler, restroom, life support, clinic, admin office, solar array, battery bank, landing pad.
- Resources: water, food, electricity, oxygen, rock.
- Happiness from three factors: noise, health, comfort.
- 2D unrolled view only; real time with pause.
- Office visits from notables.

**As built:** done (milestone 1, `PLAN.md`), and grown well past this; see "Where the build stands" at the top.

## Cultural drift model

Each hole has a four-slider culture profile that turns slowly toward a target, and every pair of holes holds an opinion of each other from −100 to +100.

**Profile sliders:** Work ↔ Leisure, Order ↔ Freedom, Earth ↔ Mars identity, Open ↔ Insular.

- **Target profile** is set by room mix, ordinances, events and the administrator. The actual profile moves toward it gradually, like a large ship changing course.
- **Contact converges:** trade and migration pull two holes' profiles together. Nearby holes mix often and stay similar; distant ones drift apart.
- **Opinion shifts daily from four inputs:**
  - Fairness: value given vs. received over the last game year.
  - Similarity: a large culture gap slowly lowers opinion.
  - Shared history: crisis aid gives a lasting boost; refusing help leaves a lasting scar.
  - Decay: opinion drifts back toward neutral, so grudges can heal.

| Opinion | Tier | Effect |
| --- | --- | --- |
| +60 and up | Allied | Trade discounts, crisis aid |
| +20 to +60 | Friendly | Fair prices |
| −20 to +20 | Neutral | Normal trade |
| −60 to −20 | Wary | Price markups, slower deals |
| Below −60 | Hostile | Refuse trade, possible embargo |

**Factions:** holes with similar profiles and high mutual opinion form blocs that negotiate as a group or resist the player together.

## Notables

Notables are named colonists who speak for cohorts, bring goals to the office, and remember how the player treats them; about 20 at most per hole.

- **Role:** worker, organizer, scientist, doctor, merchant or administrator.
- **Two traits** from a pool: Populist, Cautious, Industrialist, Idealist, Greedy, Charismatic, Hothead, Pragmatist, Earth Loyalist, Martian-born.
- **One goal,** e.g. fix the noise in my block, or push for independence. Goals generate office visits.
- **Loyalty** to the player (0–100) and **influence** over their cohort.
- **Numbers:** everyone is notable below about 30 colonists; above that the count scales gently to a cap of about 20.
- **Lifecycle:** new notables rise from events (a strike produces a union leader, an outbreak makes a doctor famous). They age, move between holes, retire and die.
- **Memory:** kept promises raise loyalty; broken ones drop it sharply, and their cohort notices.
- **Culture influence:** traits nudge their hole's profile, e.g. a charismatic Martian-born organizer speeds drift toward independence.
- **Administrators** are notables with an admin skill (1–5) whose personality drives delegated decisions.

## Room sizes and quality

Rooms come in several footprints, and housing comes in several quality levels that trade materials and space for comfort.

| Size | Footprint | Examples |
| --- | --- | --- |
| Small | 1 slot | Restroom, clinic, shop |
| Medium | 2 slots along the ring | Canteen, office, apartments |
| Large | 4 slots (wide, deep or tall) | Factory, water recycler |
| Huge | 8 slots, usually 2+ floors | Farm atrium, reactor |

| Housing quality | Comfort | Cost |
| --- | --- | --- |
| Bunk dorm | Low | Rock only, dense |
| Basic apartment | Moderate | Rock and brick |
| Standard apartment | Good | Brick and metal |
| Luxury apartment | High | Metal and electronics, fewer residents per slot |

**As built:** bunk dorms, then studios and apartments (50 colonists), flats and family apartments (200), suites and residences (1,000). Finer tiers house fewer per slot and cheer their neighbours.

## Air and solid waste

Air and solid waste get the same full-cycle treatment as water, and appear in the flow diagram.

- **Oxygen** comes from life support (electrolysis using water and power) and from farm plants.
- **CO2** is produced by colonists and some industry. Scrubbers in life support remove it; captured CO2 can feed farms.
- **Air quality** is a heat-map factor: poorly ventilated or crowded areas lower health.
- **Solid waste** comes from kitchens, restrooms and factories.
  - Composters turn organic waste into fertilizer and soil for farms.
  - Recyclers reclaim metal and materials.
  - Unprocessed waste fills storage and creates smell for neighbors.

## Staffing and jobs

Rooms need workers to produce, and output falls with understaffing.

- **Output scales with staffing:** a room at 50% staff produces about half its output.
- **Hole-wide job market:** each hole shows an unemployment rate or job vacancy rate. Unemployment lowers happiness; vacancies lower output.
- **Priority tiers:** each room is set to Critical, High, Normal or Low. During a shortage, Low rooms lose workers first. Life support defaults to Critical.

## Construction materials

Each room costs a mix of rock, brick, metal, machinery and electronics, and the materials used also set its quality.

- **Substitution:** some materials can stand in for others when one is short, e.g. marscrete for brick, or metal or brick for glass. Substitutes cost more and lower comfort; glass is optional everywhere (see Material substitution in the Room catalog).
- **Quality from materials:** rough rock builds are cheap but uncomfortable; brick is standard; metal and electronics produce premium rooms.
- **Machinery and electronics** gate advanced rooms like factories, reactors and labs.

## Independence choices

The break with Earth is telegraphed, and the player's choices shape its timing, speed and aftermath.

- **Accelerate:** back the independence movement. Earlier break and higher Martian loyalty, but Earth may cut supplies abruptly.
- **Delay:** negotiate with Earth for more supply drops. Buys time but splits Earth Loyalist and Martian-born notables, and risks a sudden, messier break.
- **Negotiate terms:** keep a limited Earth trade channel in exchange for export quotas.
- **New sponsors:** corporations, such as a metal company, may offer supplies in exchange for contracts or quotas, becoming a faction with its own demands.
- **Earth collapse variant:** the timing is out of the player's hands, but they choose who fills the vacuum.

## Overlays and information

Heat-map overlays let the player read a large hole at a glance.

- **Overlays:** noise, health, comfort, air quality, smell, staffing, power, safety, cave-in risk.
- **Alerts** flag shortages, hazards and waiting petitioners, and link straight to the problem.

**As built:** overlays for noise, smell, health, comfort, happiness and condition; a Flows view of power, water, air and food; messages that name rooms with their floor; rooms in trouble outlined in 3D with a ⚠.

## The map

The map uses real Mars terrain, with resource deposits randomized each game so every run has unique challenges and opportunities.

## Tech plan

The game starts on the web, built so a later move to Godot costs as little as possible.

| Layer | Choice | Role |
| --- | --- | --- |
| Language | TypeScript | Type safety across interlocking systems |
| 2D view | PixiJS | Fast sprite rendering for the unrolled view |
| 3D view | Three.js | Cylinder view reading the same data (built, and now the main view) |
| UI | React | Menus, office visits, flow diagram, overlay toggles |
| Build | Vite | Local dev and builds |

- **Simulation is separate from rendering,** like a brain and a face. The sim only updates numbers; the views only read and show them.
  - The sim runs in a Web Worker so the screen stays smooth with several holes running.
  - 2D and 3D are two views on one simulation.
  - A Godot move rebuilds the views and ports the self-contained sim.
- **Data lives in JSON files:** rooms, events, traits and resources. Balancing means editing numbers, not code, and the files carry over to Godot unchanged.
- **Saves** are stored in the browser, with export and import as files.
- **Hosting** is a static site; early playtests go on itch.io.
- **Desktop and Steam** can come later by wrapping the web build, which may delay the need for Godot.

## Win condition and open questions

There is no scripted ending: total population supported by a stable network is the high score, and bigger, more numerous holes raise it at the cost of a harder balance.

- [x] How deep do pools and notables go? Which traits does a notable have, and how many per hole?
- [x] What exactly drives cultural drift numerically, and how fast?
- [x] How are resources moved between holes: surface rovers, pipelines, something else? Can routes be disrupted?
- [x] What are the first 10 to 15 rooms for a minimum playable version?
- [x] Does Earth's independence event have player choices, or is it purely an outside shock?
- [x] Can a hole collapse or be abandoned, and what happens to its colonists?
