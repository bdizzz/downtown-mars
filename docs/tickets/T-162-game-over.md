---
id: T-162
title: A "the hole has failed" screen at zero colonists, then back to the start screen
status: open
size: M
area: sim, ui
touches: [src/sim/, src/ui/App.tsx, src/ui/Menu.tsx, src/ui/Welcome.tsx, src/bridge/, godot/src/]
blocked_by: []
notes: [N-0086]
created: 2026-10-12 19:55
---
## Problem
"When you reach zero colonists, we should have some sort of 'the game is over' screen that explains the hole has failed and there's no one to let new colonists in anymore. After that you get sent to the home screen to start a new game."

## Context
Nothing ends the game now; at zero people the economy just stops (`src/sim/economy.ts` returns early at `pop.count <= 0`). With a network (M4) a game has several holes; F-016 says nobody dies on events, but health can still empty a hole. T-161 makes reaching zero rarer.

## Approach
The sim flags a hole as failed when its population reaches zero (and stays there through a check, so a dip during a move doesn't count); the snapshot carries it. When one hole empties, it's lost: a smaller card, and the game goes on with the others. When every hole is empty, the game is over: the web shows a calm full-screen card: the hole's name, how long it lasted, its peak population, why it failed (no one left to open the airlock for newcomers), and one button back to the start screen. The save is kept, marked failed, and can't be loaded to play on. Godot in the same PR.

## Docs to update
GUIDE.md: how a hole fails; DECISIONS.md: game over.

## Open questions
- [x] With several holes, is it game over when **one** hole empties (that hole is lost, the game goes on) or only when **every** hole does? (Claude's default: an empty hole is lost with a smaller card; the game ends when all are.) → An empty hole is lost, with a smaller card; the game ends when every hole is empty. (Bryon, Oct 12)
- [x] Is the save deleted or kept (to look back at)? (Default: kept, marked failed, not loadable to play on.) → Kept, marked failed, not loadable to play on. (Bryon, Oct 12)
- [x] Godot in the same PR, or later? → Same PR. (Bryon, Oct 12)

## History
- 2026-10-12 19:55 opened from N-0086
- 2026-10-12 19:59 questions answered
- 2026-10-12 20:07 building on t-162-game-over
