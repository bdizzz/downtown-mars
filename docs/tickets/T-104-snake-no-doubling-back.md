---
id: T-104
title: Corridor snake never doubles back through a turn into a new direction
status: open
size: S
area: ui, render2d
touches: [src/view/corridorPlan.ts, src/render2d/plan.ts, src/bridge/build.ts]
blocked_by: []
notes: [N-0058]
created: 2026-10-09 01:58
---
## Problem
Snake mode for dragging out corridors "is a little difficult to use. Never allow the snake to go down a path, make a turn, but then double back to the intersection where the turn occurred and then into a different direction. This happens often by mistake and it is very annoying."

## Context
`extendChain` in `src/view/corridorPlan.ts`: when the pointer passes over an edge already in the chain it trims back to there ("retracing"), and growth then continues from the new tail. So a small wobble back over the turn trims the chain to the turn vertex, and the next move grows it in a fresh direction. Shared by the web plan view and the bridge (`src/bridge/build.ts`), so Godot gets the fix too. Covered by tests around corridor chains, if any (`tests/`).

## Approach
Stop a trim-then-grow from branching at a vertex the chain has already turned at: e.g. once trimmed back to a turn, the chain may only regrow along the direction it originally left in (or not at all until the pointer goes back further). Add a unit test for the wobble case. Done: wobbling back over a turn never produces a chain heading off in a third direction.

## Open questions
- [ ] Keep retracing as a deliberate undo (drag back along the chain to shorten it), and only block regrowth in a new direction from a turn you've backed up to? Or drop trimming altogether, so the chain only grows and you cancel to start over? Default: keep retracing, block the new direction.

## History
- 2026-10-09 01:58 opened from N-0058
