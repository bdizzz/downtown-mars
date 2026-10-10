---
id: F-011
title: "Missions, starting with moving out of the landing pod; later holes start from a base camp"
status: draft
plan:
notes: [N-0061]
created: 2026-10-10 00:18
---
## Goal
Frame the early game around "moving out of the landing pod so it is not needed for any housing, storage, meals, etc." The story: colonists take unwanted low-level radiation while above the surface, so they must move all habitation underground within a certain number of months; after that, health starts to suffer from going up to the surface so often.

A checklist shows what the lander provides (housing, a place to eat…). As the hole gains enough capacity, items tick off. When all are ticked, the player can "deconstruct the landing pod for resources": a boost of metal, glass, electronics, machinery and so on. This is the first **mission**, starting after the tutorial (or after some months), and we can "ideate on other missions that could occur throughout the rest of the game."

Holes after the first start with a **base camp** instead of a landing pod, since colonists arrive by rover from earlier holes with resources in tow.

## Design
- Today the lander is the `landing_pod` surface room (`data/rooms.json`: houses 20, 2 surface slots, no cost) placed by `landingKit` in `data/config.json` along with the pad, a solar array, the entrance and a battery bank. It also counts for some services (`data/condition.json` lists it with galleys and clinics). What else it provides needs checking in `src/sim/` (meals, storage).
- Checklist: **everything the pod currently provides** (find the full list in the sim). An item ticks only when the hole has enough spare capacity elsewhere that losing the pod leaves it no worse off.
- Start: after the tutorial or after a set number of months, **whichever comes first**. Deadline: N months later; the start and deadline months scale with difficulty (F-014).
- Past the deadline, **everyone** takes a small health penalty (radiation): in the story all colonists still go back and forth to the pod for things through the month. Ticking everything and deconstructing ends it.
- The mission is **required**. Some unlocks move from population thresholds to mission rewards: e.g. apartments/homes come from deconstructing the pod rather than at 100 people, with the story "we're really home now, there's no going back." (That would revisit T-100's thresholds for those rooms.)
- Deconstruct: a choice (like an event card) that removes the pod and pays out resources, all numbers in data.
- Missions as a system: a small catalogue in `data/missions.json` (trigger, checklist, deadline, reward including unlocks, story text), tracked in the sim. **Missions and milestones share** one panel and tracking (F-005, T-055), so this feature builds on F-005's catalogue and panel rather than a separate one.
- Base camp: second and later holes start with a base camp instead of a pod (the network founding code in the sim, M4), plus resources brought by rover. It works **just like a landing pod**, including its own move-out mission and deconstruction.

## Breakdown
Proposed; becomes tickets once this feature is agreed.
- The missions system in the sim: catalogue in data, start triggers, checklist tracking, deadline, reward; saved.
- The move-out mission: the pod's checklist, the radiation deadline and health penalty, and deconstructing the pod for resources.
- Missions in the shared milestones/missions panel on the web (checklist, time left, the deconstruct choice), and a notice when a mission starts or ends.
- Rewards that unlock rooms: move the chosen housing unlocks from population to the move-out mission.
- Base camp: a second landing kit for new holes, a camp room that behaves like the pod (same mission), and the rover's resources.
- Missions in Godot (via the bridge).
- Ideas for later missions (a doc pass to collect them).

## Open questions
- [ ] How many months for the start and the deadline on normal? (Start: whichever comes first of the tutorial ending or N months; both scale with difficulty.)
- [x] What goes on the checklist? Everything the pod provides; spare capacity so removing it leaves the hole no worse off.
- [x] Who takes the health hit? Everyone a little.
- [x] Required? Yes; some rooms (homes) unlock from it instead of population.
- [ ] Which rooms move from population unlocks to the move-out reward? Standard homes (now 100 people, T-100)? Luxury too?
- [x] Base camp? Functionally just like a landing pod, including the deconstruct mission.
- [x] Missions and milestones: shared panel and tracking.

## History
- 2026-10-10 00:18 opened from N-0061
- 2026-10-10 questions answered (start, checklist, penalty, required, base camp, shared with milestones)
- 2026-10-10 00:27 questions answered
