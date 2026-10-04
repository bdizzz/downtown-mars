---
id: F-002
title: Air as a mix: O2 % of the living volume, O2 ↔ CO2 loop, gas tanks
status: draft
plan:
notes: [N-0005]
created: 2026-10-04 19:12
---
## Goal
Oxygen and CO2 form a stable loop, so once a hole's air is made it doesn't keep costing water. Water is slowly and irretrievably turned into oxygen **only as the hole's living volume grows**. (Bryon's answer about life support on T-005, Oct 4.)

## Design
Bryon's design (Oct 4, N-0005 answers, first written up in T-011):
1. **Track the hole's inhabited volume**, loosely: excavated empty rooms, rooms and corridors count; the open shaft and unexcavated rock don't. New games start small, so they need little oxygen.
2. The player sees the mix as **O2 %** (HUD: "Air 21% O2"). Target 21%; comfortable 19.5–23.5%; below 19.5% health falls, below 16% fast; above 23.5% a fire-risk warning (later a hazard). **CO2 above 1%** hurts health, replacing `co2DangerLevel`. "Air quality" stays the separate, local ventilation effect.
3. People (and anything that breathes or burns) turn O2 into CO2, 1:1.
4. Two rooms replace life support: an **electrolyzer** (water → O2, only to reach the target; water used up for good) and a **CO2 scrubber** (CO2 → O2 plus a little soil, for power, with noise). Fully efficient while there's scrubbing capacity for the CO2 being made.
5. **Gas tank rooms**, each set to O2 or CO2 (like the water tank's choice in F-001), are **ballast both ways**: extra above target goes into tanks with room, and O2 tanks release into the air when O2 is below target. When tanks are full the extra stays in the air, which is how O2 gets too high.
6. **An event when O2 is too high**: "vent the excess air into the atmosphere". O2 goes back to ideal and what's vented is lost for good; a deliberate exception to "nothing vents to the planet" (DECISIONS.md). M14 events: `src/sim/events.ts`, `data/events.json`.
7. **A tank at 0% condition** (gas or water) keeps what it holds but can't take more; what's in it can still be used.
8. No nitrogen, no overall pressure: "a little less realistic here in the name of game mechanics."

Today: O2 and CO2 are plain pooled resources (`data/config.json`: start o2 120; people need o2 1 and make co2 1 a day; `co2DangerLevel` 100; `co2ScrubFloor`). Life support turns water 6 + power 5 into O2 30; farms take CO2 2 and make O2 2; parks make O2 1.

Big enough for a plan doc of its own (the next free `docs/PLAN-M*.md`), written by `/build F-002` and linked in `plan:` above.

## Breakdown
Proposed; becomes tickets once this feature is agreed.
- Living volume from the layout; O2 and CO2 as amounts over it, shown as %; health bands; HUD and charts; save migration
- The electrolyzer and the CO2 scrubber (today's life support becomes the scrubber), with furniture and layouts
- Gas tanks with a chosen gas, ballast both ways, overflow into the air; the 0%-condition rule for all tanks
- The "vent excess air" event
- Rebalance the opening and the bots: a steady colony uses almost no water for air, and growing the hole costs water for its new air

## History
- 2026-10-04 19:12 made from T-011 (T-012 moved the air mix into a feature)
