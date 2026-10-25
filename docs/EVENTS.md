# Event catalog

Events are how the colony talks back: citizen visits, hazards, discoveries, network politics and story beats, each offering a few choices with lasting consequences.

**As built (Sep 30, 2026):**

| Event | In the game |
| --- | --- |
| Citizen visits | Noise complaint and clinic demand, with promises the notable remembers (`data/visits.json`); the doctor and a residents' delegate about a lasting health or happiness cause (F-018, T-176) |
| Dust storm | Forecast a few days ahead; halves solar for a day or two |
| Equipment failure | Breakdowns: now and then something in a room breaks and knocks its condition down 20–30 points. Rooms also wear, and maintenance or cleaning crews repair them |
| Supply drops | Every few days from Earth, sometimes delayed |
| People | Births, retirements, deaths, migration between holes, opinion shifts between holes |
| Drill discoveries (M14) | Aquifer, rich ore vein, silica bed, lava tube, gas pocket and microfossils, struck as floors are finished, each with a choice (`data/events.json`, `sim/events.ts`) |
| Belt ship in distress (M14) | From day 20: bring her down (crew and salvage), send supplies up (thanks later), or ignore her |
| Celebrations (M14) | Milestones proposed as a festival (a feast, a slow day, lights and lanterns) or a toast. The milestones are one catalog, `data/milestones.json` (F-005, T-055): each reached is news, and those marked `celebrate` propose one |
| Too much oxygen (F-002, T-030) | Above 23.5% O2 a fire-risk warning; after half a day above it, **vent the excess** (back to 21%, lost for good) or hold it. At most once every 3 days |

Everything else here (the strike chain, cave-ins, outbreaks, the network events, the rest of Earth and the belt, story beats, notable life events) is still design. Visits and the M14 events offer choices; M14 events arrive as cards and don't pause the game.

## How events work

- **Anatomy:** a trigger (conditions in the hole), a messenger (usually a notable visiting the office), two to four choices, and consequences, both immediate and lingering.
- **No pure losses:** every event offers at least one reasonable compromise, keeping the tone chill.
- **Memory:** notables remember choices, so events chain into later ones.
- **Pacing director:** event frequency scales with hole size and difficulty, with guaranteed quiet stretches.
- **Delegation:** events at holes outside your view are handled by the local administrator, according to the delegation dial and their personality.

## Citizen visits

| Event | Trigger | Choices |
| --- | --- | --- |
| Noise complaint | Residents living near a loud room | Move the room; build a corridor buffer; enact quiet hours; refuse |
| The doctor's report (built, T-176) | Something has drained the hole's health for a month (meals, water, sanitation, thin oxygen, CO2) | The first time: information only, with the cause, what it costs and the fix ("Noted") |
| The doctor wants it fixed (built, T-176) | The same cause, still there 3 months after the last visit about it | Promise to fix it within 3 months (kept: +15 loyalty, +5 happiness; broken: −20 loyalty, −3 happiness); not now |
| A word from the residents / the residents want it fixed (built, T-176) | A happiness cause costing 3 points or more for a month (smell, stale air, no galley seat, crowding…; noise is left to the noise complaint) | As the doctor's: information first, then a promise. A residents' delegate (an organizer) comes |
| Room demand | A cohort lacks a service, e.g. a gym or bar | Grant it by a deadline; offer something smaller; refuse and risk a strike |
| Scientist's proposal | A research lab and a notable scientist | Fund the experiment to unlock a milestone early; decline |
| Luxury envy | Wide gap between housing tiers | Upgrade homes; promise upgrades later; enact a housing lottery |
| Ambitious notable | A notable with high skill and ambition | Appoint them administrator; give a smaller role; decline and risk a rival |

## The strike chain

A grievance can escalate through four steps: grievance, petition, ultimatum, strike. At each step the player can concede, negotiate or stall.

| Once a strike starts | Result |
| --- | --- |
| Concede | Strike ends; the cohort's loyalty rises, but others may learn that strikes work |
| Bargain | Partial deal; a short strike and a moderate loyalty change |
| Wait them out | Production stays halted until morale breaks; supply chains may suffer |
| Use security | Fastest end; loyalty crashes and the hole pushes toward Order |

## Hazards

Every hazard is forecast before it hits.

| Event | Warning | Choices |
| --- | --- | --- |
| Dust storm | Days ahead | Charge batteries; ration power; shelter the solar arrays |
| Cave-in warning | Cracks on deep or wide floors | Reinforce; evacuate the floor; gamble |
| Outbreak | Illness in a crowded, low-health area | Quarantine; surge the clinics; let it run |
| Equipment failure | An aging room falters | Repair now at a cost; limp along |

## Discoveries

| Event | Trigger | Choices |
| --- | --- | --- |
| Aquifer struck | Digging into a water layer | Tap it for water; protect it and keep it pristine |
| Lava tube found | Digging into a natural cavity | Turn it into a plaza; open it as a tourist attraction |
| Rich ore vein | Digging into a deposit | Open smelting in a hole that couldn't before |
| Microfossil find | Rare, deep digging | Research boost and tourism draw, plus a debate over continuing to dig there |

## Network events

| Event | Trigger | Choices |
| --- | --- | --- |
| Aid request | A struggling hole asks for help | Send it; send part; refuse (a lasting scar) |
| Trade dispute | Two holes disagree over a deal's fairness | Mediate in favor of one, split the difference, or let them sort it out |
| Migration wave | Unhappy colonists leave one hole for another | Welcome them; cap arrivals; send them back |
| Secession talk | A hole has drifted far and resents the network | Offer concessions; ignore; let it go |
| Festival invitation | Holes with a growing culture gap | Attend to narrow the gap; decline |

## Earth and the belt

| Event | Trigger | Choices |
| --- | --- | --- |
| Delayed supply drop | Early game, random | Stretch supplies; ration; trade for the gap |
| Earth quota demand | Before independence | Comply; negotiate; defy |
| Earth inspector visit | Before independence | Impress them; hide problems |
| Belt trade offer | A launch window opens | Accept; counter; decline |
| Belt ship in distress | Random, needs a landing pad | Rescue at a cost for lasting belt goodwill; ignore |

## Story beats

- **Independence arc:** rumblings, then a petition, a debate and a vote, with player choices at each step shaping timing and terms.
- **Earth collapse:** the alternate path. The news arrives, and the player chooses who fills the vacuum.

## Missions (ideas)

A **mission** (F-011) is a goal with a story, a checklist that ticks itself as the hole gets there, a deadline, and a reward that often unlocks rooms. The first is moving out of the landing pod (T-111); later holes move out of their base camp the same way (T-114). Missions share the milestones panel and tracking (F-005). These are candidates for the rest of the game, collected for Bryon to pick from (T-116); none is built, and the ones he picks become tickets. Deadlines are in game months (a game day), on normal; difficulty would scale them (F-014). **Needs** names what the game doesn't have yet.

| Mission | Story | Checklist | Deadline | Reward | Needs |
| --- | --- | --- | --- | --- | --- |
| **Move out of the pod** | Radiation on the surface; everyone must live and eat below ground. | Everything the pod provides, covered elsewhere | 24 months from start | The pod's salvage; standard homes, cargo, recycling | Planned (T-111) |
| **Feed ourselves** | Earth warns the drops will thin out. | Food made covers food eaten for a month, without drops; two crops growing | 18 months | Drops of seed stock; the brewery or a new crop | Steady-state balance (shared with T-058) |
| **Close the water loop** | Ice is hard to haul; every litre lost is a litre mined. | Treatment returns more than the hole loses over a month; gray tanks never overflow | 12 months | Water tanks at a discount, the "closed loop" milestone | F-001's loop (T-060) |
| **The first school** | The first children are walking; parents want them taught. | A school within reach of every home with children; a clinic and a park nearby | 12 months after the first birth | Happiness boost for families; elder care unlocked early | Built pieces only |
| **Deep enough for heat** | Geologists say the rock warms below floor 15. | Dig to floor 15; a power reserve; a reinforcement frame on the deep floors | None (an open goal) | The geothermal plant, a supply drop of machinery | Geothermal plant (T-134), cave-ins |
| **A second hole** | Earth wants proof the colony can spread. | A staging bay; a full kit loaded; a site picked; the convoy arrives | 36 months | A new hole on the map, Earth credits, network milestones | Built pieces only (founding, M4) |
| **Earth's quota** | Before independence, Earth asks for something back. | Ship N metal (or electronics) by the deadline, up the pad | 12 months | Extra drops and goodwill; refusing sours relations | Exports, Earth relations |
| **The inspector** | An Earth inspector lands for a month. | Health and happiness above a bar; no room in disrepair; no smell reaching homes | The visit's month | A bigger supply drop, or a smaller one | An inspector event (EVENTS "Earth and the belt") |
| **Good neighbors** | A belt ship crew stays on after a rescue and wants a home. | Homes for the crew; a bar or lounge nearby; a landing pad staffed | 6 months after a rescue | A belt trade offer; the crew's notable | Belt trade |
| **Under glass** | The shaft is open to Mars; the dome is a hole's end goal. | Glass in stock; every gallery sealed; the dome built | None (an open goal) | Daylight and a lift to everyone's comfort, the "under glass" milestone | Built pieces only (M12) |
| **Ready for independence** | The vote is coming; the hole must stand alone. | Self-sufficient for food, water, air and power for a month, without drops or trade | Before the vote | Independence on good terms; holding out loses Earth's goodwill | The independence arc, self-sufficiency (T-058) |
| **A trade route** | Two holes have what the other lacks. | A rover depot in each; a route set up; a round trip delivered | 12 months after the second hole | Cheaper goods both ways, the "first trade route" milestone | Trade routes (built) |
| **Tourist season** | A hole near a landmark could host visitors from Earth. | A hotel, an experience venue, happiness above a bar, a pad free | 24 months | Tourist income | Tourism rooms |

**Shapes they share:** most checklists are counts the sim already keeps (rooms built, floors dug, people, stock), a held balance (as T-058 needs), or an event that has happened. Rewards are resources, unlocks moved from population thresholds (as T-113 does for homes), or a milestone. Some are required (the pod), most optional with a gentle deadline: missing one costs goodwill or a smaller drop, never the hole, in keeping with "no pure losses".

## Notable life events

| Event | Trigger | Choices |
| --- | --- | --- |
| Rivalry | Two notables with clashing traits or goals | Side with one; broker peace |
| Founder's dream | A notable wants to lead a new hole | Back them and they bring volunteers; ask them to wait |
| Loss of a beloved notable | A high-influence notable dies | Build a memorial; move on |
