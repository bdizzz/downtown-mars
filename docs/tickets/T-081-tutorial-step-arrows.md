---
id: T-081
title: Step back and forward through the tutorial with arrows
status: open
size: S
area: ui, godot
touches: [src/ui/Tutorial.tsx, src/ui/tutorialGoals.ts, src/bridge/tutorial.ts, godot/src/Tutorial.cs]
blocked_by: []
notes: [N-0045]
created: 2026-10-06 19:31
---
## Problem
"You should be able to move forwards and backwards in the tutorial steps without completing them, with left and right icons. That way some players can complete the tutorial in a different order if they need."

## Context
The deputy's card (`src/ui/Tutorial.tsx`; Godot's `Tutorial.cs`) shows the first unmet goal, its hint and a dot per goal. Goals are checked continuously (`src/ui/tutorialGoals.ts`, the bridge's `tutorial.ts`), so any goal can be met at any time.

## Approach
‹ and › buttons either side of the dots (and clicking a dot) pick which goal the card shows; done goals show ticked. Meeting the shown goal moves on to the next unmet one. Done goals stay done when you browse back. The tutorial ends when every goal is met. Done: you can jump to step 5, do it, and the card moves on to the next unmet step; same in Godot.

## Open questions
- [ ] When you meet a goal you're not looking at, should the card stay on your chosen step (proposed), or jump to the first unmet one?

## History
- 2026-10-06 19:31 opened from N-0045
