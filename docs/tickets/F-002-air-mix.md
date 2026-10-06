---
id: F-002
title: Air as a mix: O2 % of the living volume, O2 ↔ CO2 loop, gas tanks
status: agreed
plan: docs/PLAN-M16.md
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

Planned in `docs/PLAN-M16.md` (Claude's defaults, every number in data):
- **Living volume** = dug cells (400 m³ each) + built corridors and tubes (length × 3 m × 4 m) + the shaft once domed (pressurized before it opens). A starter hole is about 4,750 m³. Digging dilutes the air; that's the growth cost.
- **O2 and CO2 stay resources** (amounts), shown as % of `volume × air.unitsPerM3` (2). New games start at 21%. CO2 bands: harmful above 1%, fast above 3%; scrubbers leave 0.2% for farms.
- **Life support becomes the CO2 scrubber**, keeping its id `life_support` (no migration, no churn in ~25 files) and losing its water. The **electrolyzer** (M, water 10 + power 6 → O2 40) runs below the target after the O2 tanks release, then fills the O2 tanks up to a hole-wide tank fill slider (default off). Parks change to CO2 1 → O2 1 so nothing makes O2 from nothing.
- **Gas tanks** (S, 200): tanks release before rooms run and store after, so they save electrolyzer water; drops and seed kits land in tanks first. Nothing burns yet; rooms can opt in with `uses.o2`/`makes.co2`.
- **Flows in two steps**: water → split into oxygen → air for new space · replacing breathed air · into the O2 reserve (Bryon, Oct 6).
- **Vent event** after half a day above 23.5% with full tanks: vent to 21% (lost for good) or hold.

## Breakdown
Agreed Oct 6. Steps 1–3 and 5 don't need F-001; step 4 builds on T-005's tank "holds" choice.
- Living volume and the mix: `sim/air.ts`, O2/CO2 % with health bands, breathing 1:1, HUD "Air 21% O2" and charts, save migration, new games at target (L) → T-026
- Two-step flows: a use can show where it went next (the ledger's `then`), in the web flow panel and Godot's charts (S) → T-027
- The electrolyzer and the CO2 scrubber: life support renamed and dry, the new room with its flows, furniture, layout and 2D art, parks take CO2, the domed shaft pressurized into the volume, tutorial and landing kit (M) → T-028
- Gas tanks: O2/CO2 choice, ballast both ways and overflow, the electrolyzer's tank fill slider, drops and kits into tanks, the 0%-condition rule for every tank (M, after T-005) → T-029
- Too much oxygen: the fire-risk warning and the "vent excess air" event (S) → T-030
- Rebalance: air per m³, the electrolyzer's ratio, the seed kit, Earth's O2 gap and the bots, with a test that a steady colony uses almost no water for air (M) → T-031

## Open questions
- [x] **The shaft dome** (M12, from 300 colonists) seals the shaft. Does the domed shaft join the living volume? Yes (Bryon, Oct 6): about 1,250 m³ a floor, a big one-off O2 bill. Claude's default: the dome pressurizes first (its air made from the reserve and electrolyzers) and opens once full, so the hole's O2 doesn't crash.
- [x] **Should the electrolyzer ever fill O2 tanks** (a stockpile for growth spurts or a scrubber breakdown)? Yes: once O2 is at the target, it fills the O2 tanks up to a hole-wide **tank fill** slider (0–100%, default off), straight into the tanks so it never pushes the air too high. (Bryon, Oct 6)
- [x] **Scrubber in the landing kit?** A new game's air lasts about 5 days before CO2 passes 1% with 20 people. No: the tutorial asks for one early instead. (Bryon, Oct 6, with the rest of Claude's defaults)

## History
- 2026-10-04 19:12 made from T-011 (T-012 moved the air mix into a feature)
- 2026-10-05 18:57 planning on f-002-air-mix
- 2026-10-06 00:01 electrolyzer stockpile answered: tank fill slider
- 2026-10-06 00:04 flows in two steps for the electrolyzer (Bryon)
- 2026-10-06 00:05 domed shaft counts as living volume (Bryon)
- 2026-10-06 00:06 plan defaults agreed (Bryon); questions answered
- 2026-10-06 00:08 agreed
