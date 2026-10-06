---
id: T-080
title: The tutorial's office step brings someone to say hello
status: open
size: M
area: sim, ui
touches: [src/sim/visits.ts, data/tutorial.json, data/visits.json, src/ui/tutorialGoals.ts, src/ui/Office.tsx, src/bridge/tutorial.ts, godot/src/]
blocked_by: []
notes: [N-0044]
created: 2026-10-06 19:31
---
## Problem
The tutorial step "Someone's waiting at the office" often has no one waiting. "We should generate a person that is just saying hi when that tutorial step is selected. That person doesn't give up after waiting; but once you dismiss them the tutorial step completes."

## Context
Visits come and go on their own (`src/sim/visits.ts`: `stepVisits`, `answerVisit`, `createOffice`), so whether anyone's there when the step comes up is luck. The step is in `data/tutorial.json` (highlight `hud:office`), checked by `src/ui/tutorialGoals.ts`; Godot's goals are worked out in `src/bridge/tutorial.ts`. The sim is deterministic: the greeter must come from a command (say `tutorialGreeter`), not from UI state inside the sim.

## Approach
A new visit kind in data, "Just saying hi" (one of the notables or a colonist, a friendly line, one choice: "Nice to meet you"), with no patience limit and no effect. When the office step becomes the current one and the office is empty, the UI sends the command; the sim queues the greeter. Answering it (or any visit) completes the step. Done: in a new game the step always has someone waiting, they wait forever, and saying goodbye ticks the step, in web and Godot.

## History
- 2026-10-06 19:31 opened from N-0044
