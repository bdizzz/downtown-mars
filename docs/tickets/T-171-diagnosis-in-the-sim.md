---
id: T-171
title: The sim names why health and happiness are falling; the home health factor becomes Wellbeing
status: done
size: L
area: sim, data
feature: F-018
touches: [src/sim/diagnosis.ts, src/sim/happiness.ts, src/sim/economy.ts, src/sim/air.ts, data/diagnosis.json, src/worker/, src/bridge/, src/view/roomPanel.ts, src/ui/, godot/src/Live.cs, tests/]
blocked_by: []
notes: [N-0095]
created: 2026-10-19 21:57
---
## Problem
Health and happiness fall and nothing says why. This is the foundation of F-018: one attribution in the sim that every screen reads. Also, per Bryon, a home's "health" factor is renamed **Wellbeing** so Health means only the hole's meter.

## Context
Read F-018 first. Health drain: `stepColonists` (`src/sim/economy.ts`) and `airHealthLoss` (`src/sim/air.ts`). Happiness parts: `homeFactors` (`src/sim/happiness.ts`). The neighbour effect type `health` (rooms.json, the overlays in web and Godot) is the same idea as the home factor.

As built: the rooms *causing* a neighbour effect (which room makes the noise) aren't named yet, only the homes that feel it; finding the sources needs a field per source room, so it moves to T-174 (the home breakdown names them). Found while checking: a brand-new game's health drains 15 a month from the start (no galley to cook meals, and the landing pod has no restroom), which the Health card now says plainly.

## Approach
- `src/sim/diagnosis.ts` (pure): health drain per cause per month (water, meals, sanitation, O2, CO2) with each need's % met, and the recovery when nothing drains; happiness contributions in points per part (each term in `homeFactors`, the afterglow, event mood), resident-weighted across homes, plus the unhappiest homes and the room ids behind each cause (noisy, smelly neighbours; homes out of reach of a clinic, restroom or galley seat). Refactor `homeFactors` to return its parts rather than duplicate the sums.
- Cause ids map to text and a fix in `data/diagnosis.json` (with placeholders for numbers and room names).
- In the snapshot and over the bridge.
- Rename in player-facing text only: Health → **Wellbeing** for the home factor and the neighbour effect (panels, overlays, legends, GUIDE). Keep the `health` keys in saves and data, so no breaking change.
- Done: unit tests provoke each cause (cut meals, raise CO2, remove the restroom, a noisy neighbour…) and see it ranked first.

## Docs to update
DECISIONS.md: Wellbeing is the home factor; GUIDE.md: Health and happiness.

## History
- 2026-10-19 21:57 opened from F-018
- 2026-10-19 21:59 building on t-171-diagnosis-in-the-sim (with T-172)
- 2026-10-19 22:13 built
