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
- Checklist items, one per thing the pod provides: housing (its 20 beds), meals, storage, perhaps air/water or medical. Each ticks when the hole underground covers it without the pod.
- Deadline: N months after the mission starts. Past it, anyone living in or regularly visiting the surface takes a health penalty (radiation), growing over time; ticking everything and deconstructing ends it.
- Deconstruct: a choice (like an event card) that removes the pod and pays out resources, all numbers in data.
- Missions as a system: a small catalogue in `data/missions.json` (trigger, checklist, deadline, reward, story text), tracked in the sim, shown in a missions panel. Close kin to F-005's milestones (`src/sim/events.ts` and the milestone tracking in T-055); they could share tracking code.
- Base camp: a different landing kit for second and later holes (the network founding code in the sim, M4), with a camp room in place of the pod and resources brought by rover.

## Breakdown
Proposed; becomes tickets once this feature is agreed.
- The missions system in the sim: catalogue in data, start triggers, checklist tracking, deadline, reward; saved.
- The move-out mission: the pod's checklist, the radiation deadline and health penalty, and deconstructing the pod for resources.
- The missions panel on the web (checklist, time left, the deconstruct choice), and a notice when a mission starts or ends.
- Base camp: a second landing kit for new holes, a camp room, and the rover's resources.
- Missions in Godot (via the bridge).
- Ideas for later missions (a doc pass to collect them).

## Open questions
- [ ] How many months for the move-out deadline, and when does the clock start: right after the tutorial, after a set number of months, or whichever comes first?
- [ ] What exactly does the pod provide that goes on the checklist? Housing and meals for sure; storage, medical, air or water too?
- [ ] After the deadline, who takes the health hit: people still living in the pod, anyone working at surface rooms, or everyone in the hole a little?
- [ ] Is the move-out mission required, or can a player ignore it and live with the penalty?
- [ ] Should the base camp provide anything the pod does (some housing for the rover crew), and get its own smaller checklist?
- [ ] How does this fit with F-007's guided tutorial and F-005's milestones: one shared "goals" panel, or separate panels?

## History
- 2026-10-10 00:18 opened from N-0061
