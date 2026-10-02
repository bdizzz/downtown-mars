# Milestone 14 plan: excitement — discoveries, a ship in distress, celebrations

Goal: things happen to the hole. The drill strikes things on the way down, a belt ship limps in asking for help, and milestones are celebrated. Each comes with a choice.

Asked for by Bryon, Oct 1, 2026 ("i like the drill discoveries idea. after that the belt ship in distress, and then celebrations"), after "the game could use some more excitement". The defaults below are Claude's, flagged so they're easy to change; every number is in `data/events.json`.

## Defaults (to confirm or change)

- **Tone:** events sting, they don't crush. Nobody dies of an event; the worst is lost time, resources, condition or happiness.
- **Choices don't pause the game.** An event arrives as a card (top right) with its choices and how long you have; it waits like a visitor. Left too long, it resolves its own way (each event says which), and the message log says what happened.
- **One framework** (`sim/events.ts`, `data/events.json`) for all three: an event has a title, text, a patience, choices with effects (resources, happiness, condition, colonists, deposits, a follow-up later), and what happens if it's ignored.

### Drill discoveries

Each floor the drill finishes has a chance of striking something (`discoveries.chance` 0.45; the first floor dug always does, so a new player sees one early). What it can strike depends on depth:

| Find | From floor | Choices |
| --- | --- | --- |
| **Aquifer** | 2 | Tap it: the hole gains the aquifer (deep well pumps can be built) and 150 water now. Seal it pristine: everyone's proud (+4 happiness). |
| **Ore vein** | 2 | Work it: the hole gains the ore deposit (smelters; digging brings up ore) and 60 ore now. Leave it. |
| **Silica bed** | 2 | Work it: the silica deposit (digging brings up silica) and 60 silica now. Leave it. |
| **Lava tube** | 3 | Open it up: a run of empty space on that floor, dug for free. Mine its walls: 200 rock instead. |
| **Gas pocket** | 4 | Vent it slowly: the drill loses a day. Push through: the rooms on the floor above lose 20 condition, and −4 happiness. |
| **Microfossils** | 6 | Study them: the drill stops for 2 days, everyone's thrilled (+10 happiness), and it's celebrated. Dig on: the scientists sulk (−5 happiness). |

A find the hole already has (an aquifer under a hole on one) is skipped. In 3D the rig shudders and its beacon flashes when it strikes something.

### A belt ship in distress

From day 20, now and then (a 3% chance a day, at most once every 25 days), a belt freighter with a failing drive calls for help. It needs a staffed landing pad. You have half a day.

- **Bring them down:** 30 oxygen, 30 water. Its 6 crew join the hole as colonists, with their salvage (15 electronics, 10 machinery). One of them becomes a notable.
- **Send supplies up:** 60 oxygen, 60 water. They limp on, and 10–15 days later a thank-you drop arrives from the belt (20 electronics, 15 machinery).
- **Ignore the call:** it goes quiet. −5 happiness.

With no working pad, only sending supplies and ignoring are offered. In 3D, a rescue lands on the pad like a supply drop.

### Celebrations

When the hole reaches a milestone, a celebration is proposed:

- the first child born; population 50, 100, 200, 300, 500; floors 5, 10, 20; the dome finished; microfossils studied.

Choices: **Throw a festival** (30 meals or rations, and a day at 80% productivity) for +8 happiness easing off over two days; **Raise a toast** for +2. During a festival the 3D view strings lanterns along the galleries and sends lights drifting up the shaft.

## Steps

1. **The events framework.** State, data, the tick, `answerEvent`, follow-ups, an event card in the UI, bots answer events.
2. **Drill discoveries.** The rolls, the six finds, the rig's shudder.
3. **The belt ship.** Trigger, choices, crew, follow-up drop, landing.
4. **Celebrations.** Milestones, the festival's boost, lanterns in 3D.
5. **Docs.** README, DECISIONS, EVENTS, CLAUDE.md.

## Notes as built

**Step 1, the events framework:**
- `sim/events.ts` and `data/events.json`. An event (`PendingEvent`) waits in `state.events.pending` with a deadline; `answerEvent { eventId, choice }` picks a choice (refused if a cost can't be paid, or a pad is needed and none works); at the deadline its `ignored` effect happens. Effects as planned: resources, mood, message, deposit, openCavity, holdDrillDays, conditionFloorAbove, colonists, notableRole, followUp, celebrate, festival, landing.
- **Moods:** an effect's happiness is a mood that eases off linearly over its days, added to every home's target with the afterglow (`eventMood`). The drill's hold is `drill.holdUntil`.
- **Its own dice:** events don't draw from the hole's random stream: they hash a seed kept with them (`events.seed`, from the hole's seed) with what they're about (the floor, the tick). Drawing from the shared stream shifted every later storm, birth and visit, and the playthroughs swung by 40 people from that alone.
- **UI:** `EventCards`: a card per waiting event at the top left of the view (it slides in), with each choice's hint (or why it can't be picked) and the time left. The snapshot carries each event's choices and refusals.
- **Bots:** `tendEvents` answers with the first choice it can afford, once a day.

**Step 2, drill discoveries:**
- As planned: each finished floor rolls (`discoveries.chance` 0.45; the first always strikes), choosing by weight among the finds deep enough, skipping deposits the hole has and microfossils after the first. A lava tube needs three side-by-side rock slots in ring 2 or 3 of that floor (else something else is picked); opening it digs them.
- In 3D the rig shudders for three seconds and its lamps and beacon flare when the drill strikes something (`DrillRig.strike`, on a new `drill.struckTick`).
- **Playthroughs:** with the bot tapping every find, six seeds land at 115–159 people on day 80 (without finds: 122–165); the people playthrough's day-80 check came down to 110 (was 130) and its school check now looks across the network.

**Step 3, the belt ship:**
- `beltShip` in `data/events.json`: from day 20 of a hole's life, once a game day a 3% chance (its own dice), at most once in 25 days, of a call from a named belt freighter; half a day to answer.
- Choices as planned. **Bring them down** needs a working pad (else it's greyed, with why); six crew join as adults, one a notable ("belt pilot"), and the lander comes down on the pad (`events.landingTick`: the same descent as a supply drop, then a few hours on the pad). **Send supplies** schedules the thank-you drop 10–15 days on (it lands too). Ignoring it, or the call timing out: −5 happiness for four days. A rescue also cheers everyone (+4).
- **Gains need storage,** as Earth's drops do: an event's goods land only where there's room, and a warning says what was left behind (early on, the pod's shelves are full).
- **Console:** `dm.event("belt_ship")` (or any event id) raises one now, for trying them out.
