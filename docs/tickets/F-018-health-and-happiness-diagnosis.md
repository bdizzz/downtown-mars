---
id: F-018
title: Diagnosing health and happiness: why they're falling and what to do about it
status: agreed
plan:
notes: [N-0095]
created: 2026-10-19 21:55
---
## Goal
"A way for the player to diagnose problems with hole health and happiness, so they know why it is dropping and what to do to turn it around." Bryon's hole sits at health 3 and he can't tell why. His ideas: room details, office visits (information only, or a challenge to act within a time frame), a charts interface, and extra tutorial steps (e.g. what bulkheads are for).

## Design
**What the sim does today (the causes are all there, just never named):**
- **Hole health** (0–100, the HUD's Health) is a meter that drains and refills (`stepColonists`, `src/sim/economy.ts`). Each game day it loses: water shortfall × 20, meals shortfall × 10 (`colonists.healthLossPerDay`), sanitation below 50% coverage up to 5 (`noSanitationHealthLossPerDay`), and O2 below 18% (−5, or −20 below 15%) or CO2 above 1% (−7.5, or −30 above 3%) (`airHealthLoss`, `src/sim/air.ts`). Only when *nothing* drains does it recover, +10 a day. So a hole stuck near 0 has at least one steady drain, and the HUD note just says "From the air's oxygen and CO2, water, meals and sanitation" without saying which.
- **Happiness** is per home (`src/sim/happiness.ts`): 60 + 8 × (noise + comfort + health factors, each −3..+3) + afterglow + event mood. Each factor is a sum of a dozen parts: neighbour effects, air quality and crowding, smell, clinic reach, no seat at a galley, no restroom, wear, linings, windows, amenities, ordinances, homelessness, and the hole's own health (via `needsHealth`). The home panel (`src/view/roomPanel.ts`) shows only the three totals; the HUD only the average.
- Two different things are both called "health": the hole meter and a home's health factor. Part of the confusion.

**As built (T-171, T-172):** `src/sim/diagnosis.ts` with words in `data/diagnosis.json`; `happiness.points` (hole) and each pool's `points` hold the happiness parts in points, `population.healthDrain` the meter's drain; `healthWhy` / `happinessWhy` in `src/view/hudItems.ts` make the card lines. Cause sources (which room makes the noise) are left to T-174.

**As built (T-173, T-174, T-175):** `effectSources` (`src/sim/effects.ts`) splits each home's neighbour effects by the room making them; the diagnosis carries them as `sources` (occupied homes, cached on the layout's version and the dust) and names each neighbour cause's `rooms`. `data/diagnosis.json` gained `label` (a part's short name), `field` (the effect behind it), `shared` (felt by all: no Show me) and `factors`. The "Why?" panel's text is `src/view/whyPanel.ts` (for T-178 to reuse), the home breakdown `factorRows` / `feltByRows` in `src/view/roomPanel.ts` (already in Godot through the bridge's inspector). Show me is `Stage.setSpotlight` with tints from `roomTints` (`src/view/reachView.ts`), which `planDraw.drawField` takes as an optional `spot`. History records `drain:<cause>` and `mood:<factor>` series; a save from before them gets NaN (null once saved) for the stretch it didn't record, drawn as a gap.

**As built (T-176, T-177):** the visits are four kinds in `data/visits.json` (`doctor_note`, `doctor_promise`, `delegate_note`, `delegate_promise`), with `concerns` saying when a cause counts (any health drain, or happiness `problemPoints` 3 or more; `skip` leaves noise to `noise_complaint`), how long it must hold (`holdDays` 1), when they come back (`repeatDays` 3) and when it's fixed (`fixedPoints`). `office.causeSince` keeps when each cause began; `lastVisit["cause:<key>"]` when they last came about it; a visit and its promise carry `cause` ("health:meals"); the promise's check is `causeFixed`. The delegate is an organizer. A note left unanswered costs nothing. Tips are `tips` in `data/tutorial.json`, each naming its causes; `dueTip` (`src/view/tips.ts`, for Godot too) picks the first unseen one whose cause is there (a happiness cause from `tipPoints` 1), from `fromDay` 2; `state.tipsSeen` (copied to a founded hole) and the `seeTip` command remember them; Settings → Tips (`tips`) turns them off. Show me on a visit or a tip is `causeSpot` (`whyPanel.ts`): it shows rooms and homes, not the corridor itself.

**As built (T-178):** the bridge sends `why` (`whyContent`) and `tip` (`dueTip`), each Show me's spot with its focus room's `floor` (`src/bridge/why.ts`), and the office's visits their `cause` and `spot`; the viewer's `spotlight` message tints the plan (`FieldView.spot`). In Godot: `Why.cs` (`WhyPanel`, `TipCard`, `ShowSpot`), Show me outlines in `RoomTint.Spotlight`, the Tips setting in `ViewSettings`. See PLAN-GODOT.md's notes.

**Answered (Bryon, Oct 19):** the home factor is renamed **Wellbeing** (Noise, Comfort, Wellbeing), so Health means only the hole's meter; visits are information only the first time a cause shows up, then a challenge to fix it within 3 months; tips are one-time deputy cards per cause (can be turned off in Settings); build order as in the Breakdown, attribution and HUD cards first.

**The approach: one diagnosis in the sim, shown in several places.**
1. **Attribution in the sim** (`src/sim/diagnosis.ts`, pure, no UI): for health, the drain per cause per month and the recovery, with each need's % met; for happiness, each part's contribution in points, resident-weighted across homes, plus the worst homes and the rooms causing it (the loudest neighbours, the smelliest rooms, the homes out of reach of a clinic or restroom). Returned in the snapshot so web and Godot read the same thing. Each cause has an id, and its text and fix live in data (`data/diagnosis.json`): e.g. `meals` → "Meals 40% met: −6 a month. Build a galley, or more farms to feed it."; `smell` → "Smell from the recycler reaches 4 homes. A bulkhead on the corridor between stops it."
2. **The HUD tells you at once:** Health and Happiness hover cards list the top causes with numbers ("Health −13.5 a month: meals 40% met −6, CO2 1.4% −7.5"), and say "recovering +10 a month" when nothing drains. Shared in `src/view/hudItems.ts`, so Godot gets it free. The quick win, and enough on its own to answer "why is my health 3".
3. **A "Why?" panel:** clicking Health or Happiness opens a ranked list of causes, each with its fix and a "Show me" that highlights the rooms and homes involved (the same highlight the tutorial uses), and lists the unhappiest homes.
4. **Room details:** a home's panel breaks each factor into its parts (comfort +1.2 = view +1, galley out of reach −1, worn −0.5, …) and names the rooms behind neighbour effects. Work rooms and industry show who they bother ("noise felt in 3 homes").
5. **Charts:** the Trends Health chart gets a stacked band under it showing the drain by cause over time, so you can see *when* it started and what changed; Happiness gets the same by factor.
6. **Office visits:** the colony doctor (health) or a residents' delegate (happiness) visits when a cause has held for a while. The first time it's information only (what's wrong, the fix, Show me); later ones offer a promise in the existing visit format (`data/visits.json`, like `noise_complaint`): fix it within N months for loyalty and happiness, or pay for breaking it.
7. **Tips at the moment they matter:** a one-time deputy tip when a cause first appears, explaining the mechanic behind the fix: bulkheads when smell or stale air reaches homes through corridors, restrooms when sanitation drops, scrubbers when CO2 rises, clinics when homes are out of reach. Reuses the tutorial card (`data/tutorial.json`) as contextual steps, not a fixed sequence; F-007's guided tutorial can point at the same tips.

## Breakdown
- Rename the home health factor to Wellbeing; attribution in the sim: `diagnosis.ts` with health drain by cause and happiness contribution by part, causes and fixes in `data/diagnosis.json`, in the snapshot and bridge; unit tests that each cause shows up when provoked. → T-171
- HUD Health and Happiness hover cards list the top causes with numbers and the recovery (web and Godot via `hudItems.ts`). → T-172
- The "Why?" panel: ranked causes with fixes, Show me highlights, unhappiest homes. → T-173
- Home panel breakdown of each factor into its parts, and "felt in N homes" on rooms that bother others. → T-174
- Trends: drain by cause under the Health chart, contribution by factor under Happiness (history records the causes). → T-175
- Office visits from the doctor and a residents' delegate: information first, then a promise to fix within N months. → T-176
- Contextual tips when a cause first appears (bulkheads, restrooms, scrubbers, clinics, crowding), and GUIDE.md's section on health and happiness. → T-177
- The "Why?" panel, home breakdown and visits in Godot. → T-178

## Open questions
- [x] The two "healths": rename the home factor (proposed: **Wellbeing**, with Noise and Comfort) so Health means only the hole's meter? → Yes, Wellbeing. (Bryon, Oct 19)
- [x] Office visits: proposed information only the first time a cause shows up, then a challenge (fix within 3 months). → Yes. (Bryon, Oct 19)
- [x] Tips: a one-time deputy card per cause (can be turned off in Settings), or only messages in the news feed? → Cards. (Bryon, Oct 19)
- [x] Build order: the sim attribution and HUD cards first, then the panel and home breakdown, then charts, visits and tips? → Yes. (Bryon, Oct 19)

## History
- 2026-10-19 21:55 opened from N-0095
- 2026-10-19 21:57 questions answered
- 2026-10-19 21:57 agreed
