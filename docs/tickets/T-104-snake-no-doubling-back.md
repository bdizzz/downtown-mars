---
id: T-104
title: Corridor snake never doubles back through a turn, and commits a segment only after 25% of it
status: open
size: M
area: ui, render2d
touches: [src/view/corridorPlan.ts, src/render2d/plan.ts, src/bridge/build.ts]
blocked_by: []
notes: [N-0058]
created: 2026-10-09 01:58
---
## Problem
Snake mode for dragging out corridors "is a little difficult to use. Never allow the snake to go down a path, make a turn, but then double back to the intersection where the turn occurred and then into a different direction. This happens often by mistake and it is very annoying."

Also (answering the open question): "perhaps a player needs to follow a potential corridor route a certain percentage of that path before that route is added to the snake. like 25% of the corridor route. that way it doesn't over-eagerly commit to a segment when it was just mouse noise while dragging through an intersection."

## Context
`extendChain` in `src/view/corridorPlan.ts`: when the pointer passes over an edge already in the chain it trims back to there ("retracing"), and growth then continues from the new tail. So a small wobble back over the turn trims the chain to the turn vertex, and the next move grows it in a fresh direction. Shared by the web plan view and the bridge (`src/bridge/build.ts`), so Godot gets the fix too. Covered by tests around corridor chains, if any (`tests/`).

## Approach
Stop a trim-then-grow from branching at a vertex the chain has already turned at: e.g. once trimmed back to a turn, the chain may only regrow along the direction it originally left in (or not at all until the pointer goes back further). Two parts:
1. **No doubling back.** Retracing still shortens the chain (a deliberate undo). But after trimming back to a vertex where the chain turned, it may only regrow along the direction it originally left in, never a new direction from that vertex.
2. **Commit threshold.** A candidate segment joins the chain only once the pointer has travelled 25% of the way along it from the chain's tail. Before that it can show as a faint preview but isn't added, so jitter while passing through an intersection commits nothing. This means `extendChain` needs the pointer's position along the edge, not just which edge is hovered. Today the plan view and the bridge pass only the edge, so both callers change. Put the 25% in data (`data/config.json`), not code.

Unit tests: the wobble-at-a-turn case, and a pointer that crosses an intersection with a little jitter commits nothing until it's 25% along. Done: dragging through intersections feels steady, and a wobble back over a turn never sends the chain off in a third direction.

## Open questions
- [x] Keep retracing as a deliberate undo, or drop trimming? Keep shortening, and block the new direction.

## History
- 2026-10-09 01:58 opened from N-0058
- 2026-10-09 questions answered: keep shortening, block the new direction; add a 25% commit threshold (size S → M)
- 2026-10-09 12:52 questions answered
