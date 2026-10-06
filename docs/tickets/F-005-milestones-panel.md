---
id: F-005
title: A milestones panel: the hole's achievements, from first birth to self-sufficiency
status: agreed
plan:
notes: [N-0025]
created: 2026-10-06 01:26
---
## Goal
A **milestones panel** in the UI that lists what a hole has achieved and what's still ahead. Bryon's headline milestones are about survival:

- a hole that can keep people alive indefinitely at its current size, *provided continued supply drops from Earth*
- the same, *thanks to trade with other holes*
- a hole that is self-sufficient on its own
- a hole that has produced a kit to create another hole
- first birth in the hole

Plus the extra ideas Bryon approved (N-0025 follow-up): first Martian adult, third generation, laid to rest (first death of old age), closed loop (water treatment returns more than it loses over a month), first harvest, deep roots (floors 5/10/20), full ring, under glass (dome), a year on our own (no supply drop for a year), network (first trade route, then 3 and 5 holes linked), drifting apart (one hole's culture clearly different), good neighbors (belt ship rescued), population 50/100/250/500.

## Design
- **Existing pieces:** M14's celebrations already track milestones once each (`data/events.json` → `celebrations.milestones`, checks `population | born | floors | domed | event`; `src/sim/events.ts` `reached()`, `state.events.celebrated`). The panel should grow out of that list rather than a second one: one milestone catalog, some of which also propose a celebration.
- **The hard ones are the sustainability tiers.** "Alive indefinitely" needs a steady-state judgement: over a rolling window, does net production of food, water, air (and power) cover consumption at the current population, (a) counting Earth drops (`src/sim/earth.ts`), (b) counting trade but not drops, (c) counting neither. Should probably be held for a span (say a month) before it counts, so a lucky week doesn't earn it. Interacts with F-001 (water loop) and F-002 (air mix), which change what "sustainable" means for water and air.
- **Kit for another hole:** founding a new hole (`src/sim/founding.ts`) already sends volunteers and a kit; the milestone is the first successful founding from this hole.
- Per hole, with the network ones (trade routes, holes linked, culture drift) on the network side.
- Godot needs the panel too; the bridge should reuse the web's panel text (`src/view/`).
- Earned milestones should be news: a message, maybe the celebration card where one exists.
- **Answered (Bryon, Oct 6):** one list, where every celebration is a milestone but not every milestone gets one; milestones are a record and news, with a celebration for the big ones, no rewards; a hole must hold steady for one game month to count as self-sufficient; per hole, with a network section.

## Breakdown
Proposed; becomes tickets once this feature is agreed.
- Milestone catalog in `data/milestones.json` (folding in celebrations' list), sim tracking with the day each was reached, saved; existing checks (population, born, floors, domed, event). → T-055
- The panel on the web: earned (with date) and ahead, grouped; a dock button. → T-056
- Life checks: first harvest, first Martian adult, third generation, laid to rest, full ring, good neighbors. → T-057
- Sustainability tiers: rolling net-balance per resource, with Earth / with trade / alone, held for a month; "a year on our own". → T-058
- Network checks: kit sent (first founding), first trade route, 3 and 5 holes linked, drifting apart. → T-059
- Closed loop: water treatment returns more than it loses over a month, once F-001's water loop lands. → T-060
- The panel in Godot through the bridge. → T-061

## Open questions
- [x] Should milestones and celebrations be one list (every celebration is a milestone, not every milestone a celebration)? Proposed: yes.
- [x] Do milestones give anything (a reward, an unlock, score) or are they just a record? Proposed: a record and news, plus a celebration for the big ones.
- [x] Self-sufficiency: how long must a hole hold steady before it counts? Proposed: one game month (a game day may become a month, T-021).
- [x] Per hole, network-wide, or both? Proposed: per hole, with a network section.

## History
- 2026-10-06 01:26 opened from N-0025
- 2026-10-06 01:29 agreed
- 2026-10-06 01:29 questions answered
