---
id: T-015
title: A kitchen plus a canteen satisfies the tutorial's galley step
status: open
size: S
area: ui
touches: [src/ui/tutorialGoals.ts, data/tutorial.json]
blocked_by: []
notes: [N-0010]
created: 2026-10-05 00:52
---
## Problem
"If someone builds a kitchen and a canteen instead of a galley, that should satisfy the tutorial step asking you to make a galley."

## Context
- The check is `galley: (s) => has(s, "galley")` in `src/ui/tutorialGoals.ts`; the step's text and hint are in `data/tutorial.json` (`"id": "galley"`).
- Kitchens cook but seat no one, and canteens seat 60 (DECISIONS.md, "More rooms"), so it takes both to replace a galley. A kitchen alone shouldn't count.

## Approach
Make the check `has(galley) || (has(kitchen) && has(canteen))`. Maybe mention the alternative in the hint. Done: a game with a kitchen and a canteen but no galley ticks the step; a kitchen alone doesn't.

## History
- 2026-10-05 00:52 opened from N-0010
