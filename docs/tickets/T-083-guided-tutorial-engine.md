---
id: T-083
title: Guided tutorial mode: chosen on the welcome card, steps with unlocks, a calm start
status: open
size: L
area: ui, sim
touches: [data/tutorial.json, src/ui/Tutorial.tsx, src/ui/tutorialGoals.ts, src/ui/App.tsx, src/sim/commands.ts, src/sim/weather.ts, src/sim/events.ts]
blocked_by: []
feature: F-007
notes: [N-0046]
created: 2026-10-07 18:44
---
## Problem
F-007's foundation: a second, guided tutorial a new player picks on the welcome card ("I'm new to games like this").

## Context
See F-007's Design. The welcome card is T-053's; the current tutorial is `data/tutorial.json` with goals checked in `src/ui/tutorialGoals.ts`. Storms (`src/sim/weather.ts`) and events (`src/sim/events.ts`) must hold off during the guided start: that's sim state, so it comes from a command (say `calmStart` on/off), saved with the game.

## Approach
A `guided` track in the tutorial data: steps with goal, hint, highlight, optional clip name, `unlocks` (UI element ids) and `pace` (slow, or pause for reading). The welcome card offers both tutorials; the choice is saved. The card runs the guided track; the game runs at a slow speed and pauses on reading steps; storms and events wait until the guided track's basics are done (or the player leaves guided mode). A couple of placeholder steps prove it; T-085 writes the real ones. Done: picking "new" runs the guided card with unlocks recorded, no storm or event fires during it, and the regular tutorial is unchanged.

## Docs to update
DECISIONS.md: the guided tutorial and the calm start.

## History
- 2026-10-07 18:44 opened from F-007's breakdown
