---
id: T-005
title: "Water as a closed loop: clean → gray → treatment, with tailings as the leak"
status: open
size: L
area: sim, data
touches: [data/resources.json, data/rooms.json, data/config.json, src/sim/economy.ts, src/sim/save.ts, src/ui/TrendsPanel.tsx, src/ui/trends.ts, src/ui/RoomPanel.tsx, tests/]
blocked_by: []
notes: [N-0005]
created: 2026-10-04 18:03
---
## Problem
A colony "loses way too much water and really relies on supply drops full of water." Bryon wants water to be largely a closed loop from the start (given power and upkeep): the hard part should be balancing clean against gray water, and not losing too much to tailings.

## Context
The agreed design (N-0005, Claude's proposal approved, plus Bryon's answers):
- **Clean water is one shared pool**, like power. Anything that uses clean water (people, farms, galleys and kitchens, life support, clinics, gyms, parks, industry) turns the same amount into **gray** right away, 1:1. Only clean water can be used.
- **Treatment** (the water recycler) turns gray back into clean, costing power, with noise. It returns about **95–98%**; the rest is **sludge that becomes soil**, slowly (the soil output Bryon asked for).
- **Some industrial rooms** turn part of their water into **tailings** instead of gray. Early on, tailings can only be stored; **if storage is full, the overflow just disappears for now**. A later room reclaims tailings (T-007).
- **Names:** clean / gray / **tailings** (not "black water", which means toilet waste in real life).
- **Wells bring in gray** (salty brine in the story), so well water needs treating. Supply drops and trade still top up what leaks away.
- **Gray water needs its own storage.** The water tank lets you **choose what it holds (clean, gray or tailings)**, the way a farm picks its crop. When the gray tanks are full, the rooms using water stall.
- **The water charts must show exactly what is converting water, by source and by user.** Today colonists show up as a single "colonists" consumer (`record(state, id, "out", LABELS.colonists, …)` in `src/sim/economy.ts`), and restrooms *return* gray/black water (`LABELS.restrooms`). Replace both with clear per-user flows: who used clean water, who made gray, the recycler's in and out, and tailings by source.

What the code does today (`data/rooms.json`): most users just *consume* water (galley 2, kitchen 3, farm 4, life support 6, clinic 1, hospital 3, gym 1, park 2, refinery 2, concrete 2, brickworks 1). Only people's drinking water comes back, via restrooms (75% gray, 25% black). The recycler turns 40 gray → 36 clean (90%) plus solid waste. The deep well makes 40 *clean*. The cleaning service uses 4 clean and makes 4 gray. The composter uses **blackWater** 2 with organic waste to make soil. Each tank holds one type already (DECISIONS: "Each water tank holds only one type of water"), but today it's fixed at clean, 200.

This changes the starting balance a lot: the bots (scripted playthroughs in `tests/`) and the landing kit (`data/config.json`: 240 water) will need retuning. Old saves need a migration: blackWater → tailings, and existing tanks hold clean.

## Approach
Data: rename `blackWater` to `tailings`; give each water-using room a gray (and for industry, tailings) output in the data (maybe a `waterReturns` split per room, rather than special-casing); the deep well makes gray; recycler about 97% plus soil; the water tank gets a "holds" choice like the farm's crop. Sim: people's water turns gray as it's used, not through restrooms (restrooms become an amenity: T-006). Charts: flows by source and user. Then rebalance the opening so a new colony with a recycler and a gray tank doesn't depend on drops. Done: `npm test` bots pass without water drops carrying them, and the charts show the whole loop.

## Docs to update
- DECISIONS.md: the water loop (replaces the restroom water line and "Restrooms ... return users' water as gray and black water"); tanks choose what they hold; black water renamed to tailings.
- PATHWAYS.md: Water.
- ROOMS.md: water rows (recycler, deep well, tank, restroom, industry).
- GUIDE.md: Water.

## Open questions
- [ ] Which industrial rooms make tailings, and how much? Proposed: the silicon refinery and concrete plant send half their water to tailings; the brickworks a quarter; everything else returns all of it as gray.
- [ ] The composter eats black water today (toilet waste + scraps → soil). After the rename that would mean it eats industrial tailings. Proposed: the composter stops taking water at all (scraps → soil), and the recycler's sludge is the other soil source.
- [ ] Life support splits water into oxygen in real life (it's really used up). Return it as gray like everything else (keeps the loop closed), or let it be a true sink? Proposed: gray, to keep the loop simple.

## History
- 2026-10-04 18:03 opened from N-0005
