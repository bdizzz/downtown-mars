---
id: T-011
title: Air as a mix: O2 % of the living volume, O2 ↔ CO2 loop, gas tanks
status: dropped
size: XL
area: sim, data
touches: [data/config.json, data/rooms.json, data/resources.json, data/storage.json, data/events.json, src/sim/economy.ts, src/sim/events.ts, src/sim/save.ts, src/ui/ResourceBar.tsx, src/ui/TrendsPanel.tsx, tests/]
blocked_by: []
notes: [N-0005]
created: 2026-10-04 18:56
---
## Problem
From Bryon's answer on life support (T-005): life support should use water up for good (splitting it into oxygen), but oxygen and CO2 should form a stable loop, so once the air is made you don't keep spending water on it. Water is then slowly and irretrievably turned into oxygen **only as the hole's living volume grows**.

## Context
Bryon's design (Oct 4, N-0005 answers):
1. **Track the hole's inhabited volume**, loosely: excavated empty rooms, rooms and corridors count; the open shaft and unexcavated rock don't.
2. Filling that volume takes a certain amount of oxygen. The player sees it as an **O2 %** of the air. The target is Earth's normal at 1 atm (about 21%). Too low or too high is a problem: health falls when it's low, and fast when it's very low.
3. New games start with a very small living volume, so they need little oxygen.
4. People (and anything that breathes or burns) turn O2 into CO2, so O2 % falls and CO2 % rises. **Life support and scrubber rooms turn CO2 back into O2** for power, making a little **soil** (the captured carbon), with their noise and other room effects. O2 ↔ CO2 is 1:1 and fully efficient as long as there's scrubbing capacity for the CO2 being made.
5. **Gas tank rooms** can each be set to a gas (O2 or CO2), like the water tank's choice in T-005. They're **ballast**: once O2 is at its target %, extra O2 goes into O2 tanks with room; the same for CO2. When the tanks are full, the extra goes into the air, which is how O2 can get too high.
6. **A proposed event** when O2 is too high: "vent the excess air into the atmosphere." O2 goes back to ideal, and what was vented is lost for good. (M14 events with choices: `src/sim/events.ts`, `data/events.json`.)
7. **A tank at 0% condition** (gas or water) keeps what it holds, but can't take any more. What's in it can still be used.
8. No nitrogen tracking, and no overall pressure. "A little less realistic here in the name of game mechanics."

Today: O2 and CO2 are plain pooled resources (`data/config.json`: start o2 120; people need o2 1 and make co2 1 a day; `co2DangerLevel` 100; `co2ScrubFloor`). Life support turns water 6 + power 5 into O2 30; farms take CO2 2 and make O2 2; parks make O2 1. There's also a separate, local **air quality** neighbor effect (ventilation hubs, ring baseline, dust, crowding; DECISIONS.md) which this doesn't replace. DECISIONS.md says "Air is an internal loop... nothing vents to the planet". The vent event is a deliberate exception.

## Approach
XL: a plan of its own first (the next free `docs/PLAN-M*.md`). Pieces: a living-volume measure from the layout; O2 and CO2 as amounts over that volume, shown as %; health bands; life support split into making O2 from water (only to reach the target) and scrubbing CO2 → O2 + soil; gas tanks with a chosen gas; overflow into the air; the vent event; the 0%-condition storage rule (water tanks too); charts and the resource bar showing %; save migration; bots rebalanced. Done: a colony at steady size uses almost no water for air, and growing the hole costs water for its new air.

**Becomes a feature (T-012).** Bryon wants this planned as a feature (an epic): the plan, details and how to break the work into tasks live in the feature, and task tickets are written only once the feature is agreed. Until T-012 lands, this ticket stands in for the feature.

## Docs to update
- DECISIONS.md (air mix; the vent exception to "nothing vents"), DESIGN.md, PATHWAYS.md (Air), ROOMS.md (life support, scrubber, gas tank), EVENTS.md (vent excess air), GUIDE.md: Air.

## Open questions
- [x] Two rooms: an **electrolyzer** (water → O2) and a **CO2 scrubber** (CO2 → O2 + soil); today's life support becomes the scrubber. (Bryon, Oct 4)
- [x] Target 21%; comfortable 19.5–23.5%; below 19.5% health falls, below 16% fast; above 23.5% a fire-risk warning (later a hazard); CO2 above 1% hurts health, replacing `co2DangerLevel`. (Bryon, Oct 4)
- [x] O2 tanks release into the air automatically when O2 is below target: ballast both ways. (Bryon, Oct 4)
- [x] "O2 %" for the hole-wide mix (HUD: "Air 21% O2"); "air quality" stays the local ventilation effect. (Bryon, Oct 4)

## History
- 2026-10-04 18:56 opened from N-0005 (Bryon's answer about life support on T-005)
- 2026-10-04 19:05 questions answered
- 2026-10-04 19:13 dropped: folded into F-002 (T-012)
