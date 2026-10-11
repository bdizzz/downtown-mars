---
id: F-016
title: More events and office visits, many of them wagers with workers away and odds on the outcome
status: draft
plan:
notes: [N-0072, N-0076]
created: 2026-10-11 15:52
---
## Goal
"The proof of concept for events and office visits has been solid. Let's plan out some more of those." And many of the new ones should be **wagers**: you commit resources or colonists, and the outcome is rolled, "generally the higher the cost, the higher the reward. And the higher the risk, the higher the reward." The point: "an incentive to build your hole with spare capacity/resources in mind", so you can take an opportunity when it comes and survive it going wrong.

## Design
Bryon's example (N-0076): someone proposes a meteorite-collecting trip needing 10 machinery. Agree, and the machinery is gone for a day (or however long the trip lasts), then on return, rolled:
- all 10 come back; or 8 come back (a winch broke); or none (catastrophic tool failure, empty-handed);
- and separately, 25 metal ore found, or nothing (no ore if it was catastrophic).

The choices such an event offers:
1. Agree to the full proposal.
2. Agree, but commit fewer colonists (or resources) than asked: a smaller wager that can change the odds.
3. Deny it, sometimes with a short dip in happiness.

**Workers away:** colonists on a mission leave the worker pool for its duration. The top bar's worker count shows some are away, and its tooltip explains (who, on what, back when).
**Injured workers:** an outcome can be "some workers were injured on the mission". They're out of the pool for some days while they heal, shown as a separate count, perhaps only in the tooltip. Cozy rule: **nobody dies on missions or events, and the injured always heal fully.**
**Instant events:** some have no duration ("the drill is jammed and someone needs to get under it"), and resolve the moment you choose.

Context: M14 built events with choices (`docs/PLAN-M14.md`, `src/sim/events.ts`, `data/events.json`, about 39 events): an event waits `patienceDays` for an answer, effects include resources, mood, followUp (an effect some days later), colonists. Rolled outcomes, committing part of a request, workers away and injured are new. DECISIONS: "Events sting, they don't crush, and don't pause the game". `docs/EVENTS.md` catalogs the events planned (citizen visits, strikes, hazards, discoveries, network, Earth and the belt, story, notables) with what's built: the source of "more of those". The RNG is seeded, so rolls stay deterministic. Naming: F-011 already uses "missions" for the hole's goals (moving out of the pod), so these may want another word in the UI ("expeditions"? "jobs"?).

## Breakdown
Proposed; becomes tickets once this feature is agreed.
- Rolled outcomes in the sim: weighted outcome tables per choice in `events.json`, odds shifting with how much you commit, the roll on return; tests with the seeded RNG.
- Away and injured workers: a pool of colonists out on an event and a pool healing, both removed from the workforce for their days; in the snapshot and the save (version bump).
- Partial commits: a choice that takes a slider or steps (fewer colonists or resources), with the odds shown as words ("risky", "good odds").
- The top bar and tooltip: workers away and injured, what they're doing and when they're back; the Office card shows the stake and what might come of it. Web, and Godot through the shared view code.
- The meteorite run as the first wager event, then an instant one (the jammed drill).
- A batch of new events and office visits from EVENTS.md's unbuilt list, many of them wagers, balanced so cost and risk pay; bots that take and refuse them in the playthroughs.

## Open questions
- [ ] Which of EVENTS.md's unbuilt events first, or should the plan propose a list? (Claude's default: the plan proposes 8–10, mixing wagers, instant events and plain visits.)
- [ ] Should the odds be shown to the player as numbers, words, or hidden?
- [ ] What do we call them in the UI, given F-011's "missions"?
- [ ] Do injured workers need anything to heal faster (a clinic nearby), or just time?

## History
- 2026-10-11 15:52 opened from N-0072, N-0076
