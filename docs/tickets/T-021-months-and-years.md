---
id: T-021
title: Call a game day a month, and show long spans as years and months
status: open
size: M
area: ui, data
touches: [src/ui/Hud.tsx, src/ui/TrendChart.tsx, src/ui/saves.ts, src/view/hudItems.ts, src/view/roomPanel.ts, src/view/colony.ts, src/ui/, data/events.json, data/tutorial.json, src/sim/people.ts, godot/src/]
blocked_by: []
notes: [N-0016, N-0017]
created: 2026-10-05 01:11
---
## Problem
Things happen too fast for the number of days: babies arrive the day after happiness turns critical, and by about day 40 the first colonists die of old age. Instead of "day 45", Bryon wants "month 45": **labels only**, nothing else in the sim changes, and each month is one game day long. Then (N-0017) large counts read as years: month 45 is **"year 3, month 9"**.

## Context
- "Day" shows up all over the face: the HUD clock (`src/ui/Hud.tsx`: `Day ${t.day} · hh:mm`), trend charts (`TrendChart.tsx`), save slots (`src/ui/saves.ts`), rates ("+3 a day", "Runs out in 2.5 days" in `src/view/hudItems.ts`; "Uses/day", "Makes/day" in `src/view/roomPanel.ts`), the colony view, Office, messages from the sim (`src/sim/people.ts` and others), event and tutorial text in `data/*.json`, and Godot's own labels where it doesn't reuse `src/view`.
- Ages and life stages are in game days (`data/people.json`: "Days are game days"), so ages would read in months/years too.
- Bryon's example, month 45 = "year 3, month 9", is 45 = 3 × 12 + 9: 12 months a year, read like an age (3 years and 9 months in), not a calendar date (which would make month 45 year 4, month 9).
- The day/night cycle stays as it is: one sol of light and dark per "month", which is a little odd but it's what Bryon asked for.

## Approach
One shared formatter (in `src/view/`, so the bridge and Godot get it) for a game day as "Month 9" / "Year 3, month 9", used everywhere; rates and durations relabelled "a month"; data text reworded. Done: no "day" left in player-facing text except where it means daylight.

## Docs to update
- GUIDE.md and README.md (time and speed), DECISIONS.md (a game day is shown as a month), CLAUDE.md "240 ticks a game day" note if it's worth a line.

## Open questions
- [ ] The HUD clock (`hh:mm`): keep it (the time of day within the month's one sol of light), or drop it? Proposed: drop the hh:mm and show the light as a small sun/moon icon, since a month with a clock reads oddly.
- [ ] Rates: "+3 a month" and "runs out in 2.5 months"? Proposed: yes, everywhere a day was used as the unit.
- [ ] Ages in years and months (a 40-day lifespan stage becomes "3 years 4 months")? Proposed: yes.
- [ ] Read as time elapsed, as in your example (month 45 = "year 3, month 9"; the first year shows plain "month 9"), rather than as a calendar (month 45 = "year 4, month 9")? Proposed: elapsed, as you wrote it.

## History
- 2026-10-05 01:11 opened from N-0016, N-0017
