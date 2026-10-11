---
id: T-146
title: Loaded games start paused, and pause toggles back to the speed you had
status: open
size: S
area: ui, godot
touches: [src/ui/useSim.ts, src/ui/Hud.tsx, src/worker/, godot/src/]
blocked_by: []
notes: [N-0080, N-0081]
created: 2026-10-11 15:52
---
## Problem
"When loading a game, it should start in paused mode." And: "clicking the pause button while paused should unpause the simulation and return it to the speed before pausing (or 1x as a fallback)."

## Context
Speed lives in `src/ui/useSim.ts` (`setSpeed`, posted to the worker); the controls are in the top bar (`Hud.tsx`). T-106 leaves a single pause/play toggle on phones, which wants exactly this behaviour. Godot has its own speed buttons.

## Approach
Remember the last non-zero speed; pause toggles between 0 and it (1× if there's none). Loading a save sets speed 0; new games start at 1× as now. Same in Godot. Done: load a save, it's paused; press 4×, pause, pause again, it's back at 4×.

## Open questions
- [x] New games too, or only loaded saves? (Claude's default: loaded saves only; new games start at 1× as now.) → Loaded saves only; new games start at 1× as now. (Bryon, Oct 11)

## History
- 2026-10-11 15:52 opened from N-0080, N-0081
- 2026-10-11 16:08 questions answered
