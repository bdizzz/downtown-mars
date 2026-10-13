# Event catalog

Events are how the colony talks back: citizen visits, hazards, discoveries, network politics and story beats, each offering a few choices with lasting consequences.

**As built (Sep 30, 2026):**

| Event | In the game |
| --- | --- |
| Citizen visits | Noise complaint and clinic demand, with promises the notable remembers (`data/visits.json`) |
| Dust storm | Forecast a few days ahead; halves solar for a day or two |
| Equipment failure | Breakdowns: now and then something in a room breaks and knocks its condition down 20–30 points. Rooms also wear, and maintenance or cleaning crews repair them |
| Supply drops | Every few days from Earth, sometimes delayed |
| People | Births, retirements, deaths, migration between holes, opinion shifts between holes |
| Drill discoveries (M14) | Aquifer, rich ore vein, silica bed, lava tube, gas pocket and microfossils, struck as floors are finished, each with a choice (`data/events.json`, `sim/events.ts`) |
| Belt ship in distress (M14) | From day 20: bring her down (crew and salvage), send supplies up (thanks later), or ignore her |
| Celebrations (M14) | Milestones proposed as a festival (a feast, a slow day, lights and lanterns) or a toast |
| Too much oxygen (F-002, T-030) | Above 23.5% O2 a fire-risk warning; after half a day above it, **vent the excess** (back to 21%, lost for good) or hold it. At most once every 3 days |

Everything else here (the strike chain, cave-ins, outbreaks, the network events, the rest of Earth and the belt, story beats, notable life events) is still design. Visits and the M14 events offer choices; M14 events arrive as cards and don't pause the game.

## How events work

- **Anatomy:** a trigger (conditions in the hole), a messenger (usually a notable visiting the office), two to four choices, and consequences, both immediate and lingering.
- **No pure losses:** every event offers at least one reasonable compromise, keeping the tone chill.
- **Memory:** notables remember choices, so events chain into later ones.
- **Pacing director:** event frequency scales with hole size and difficulty, with guaranteed quiet stretches.
- **Delegation:** events at holes outside your view are handled by the local administrator, according to the delegation dial and their personality.

## Wagers (F-016)

Built in T-150 and T-152; the events that use them come with T-154 and T-155.

A wager is an event choice where you put something up and the result is rolled. In `data/events.json` a choice can carry:

- **`stake`**: resources taken from stock when it's agreed and held until it resolves (`{ "resources": { "machinery": 10 }, "min": 0.5 }`). `min` is the least share you can commit instead; the card shows a − / + stepper counted in the stake's first resource. Without `min` it's all or nothing.
- **`durationDays`**: it comes back that many days later (a month each in the player's calendar). Without it, it resolves the moment you choose (the jammed drill).
- **`outcomes`**: a list of tables, each rolled once in turn. Each result is an ordinary effect (resources, mood, message…) plus `weight` (with the whole stake), `weightAtMin` (with the least; straight between the two), `returns` (the share of the stake given back, 1 if left out; the least across the tables counts) and `unless` (ruled out if one of those results came up in an earlier table).

What an outcome finds scales with the share put up. Outcome messages can say `{back}` (the stake given back) and `{gains}` (what was found). The odds are never shown to the player. Rolls are on the events' own seeded dice, so the same game always rolls the same way.

The first one, **A meteorite came down** (`meteorite_run`), only comes from the console for now (`dm.event("meteorite_run")`): send 5–10 machinery out for a month; all of it comes back (6 in 10 with the full stake), 8 in 10 of it (a winch broke, 3 in 10) or none (a catastrophe, 1 in 10). Separately, 25 ore is found 6 times in 10 (scaled to the stake; never after a catastrophe). Sending less makes a catastrophe and ore both rarer. Or decline, for a small dip in happiness. T-154 gives it a trigger, a crew away and injuries.

## Citizen visits

| Event | Trigger | Choices |
| --- | --- | --- |
| Noise complaint | Residents living near a loud room | Move the room; build a corridor buffer; enact quiet hours; refuse |
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

## Notable life events

| Event | Trigger | Choices |
| --- | --- | --- |
| Rivalry | Two notables with clashing traits or goals | Side with one; broker peace |
| Founder's dream | A notable wants to lead a new hole | Back them and they bring volunteers; ask them to wait |
| Loss of a beloved notable | A high-influence notable dies | Build a memorial; move on |
