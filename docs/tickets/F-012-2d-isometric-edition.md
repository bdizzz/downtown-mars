---
id: F-012
title: "A 2D isometric sprite edition, in the style of Into the Breach"
status: agreed
plan:
branch: feature/f-012-2d-isometric-edition
notes: [N-0064]
created: 2026-10-10 00:18
---
## Goal
A bigger, long-term idea: a version of the game in 2D sprites rather than 3D. The view is fixed isometric, with an aesthetic like Into the Breach. It skips "all the complicated 3d stuff" and puts more energy into detailed 2D art for furniture, rooms and people. It might be a separate game sharing some resources and logic with the web and Godot versions. Not a view you toggle in the existing game, and saves probably won't port back and forth. "All the concepts and mechanics in this game would be the same as the current game, just a completely different presentation," with some gameplay changes to suit it.

## Design
- **A fork**, so the 3D web and Godot versions don't get more complicated to run it. It starts from this repo's sim and data and is free to diverge, including gameplay changes.
- The round borehole is the hard part for a fixed isometric grid: rings of curved rooms don't map neatly onto iso tiles. Try **both** a stylised round borehole and a square grid as quick tests, and decide from how they feel.
- Fixed camera means one or a few view angles per floor; the floor-by-floor model fits iso slices well.
- Art pipeline: sprite sheets for rooms, furniture (`FURNITURE.md`), people and animations; a big asset effort.
- Engine: **Pixi first**; a Godot 2D version will probably follow at some point.
- Timing: the edition itself waits until the current game reaches some milestone, but **exploring the art style can start in parallel** now.

## Breakdown
Agreed; each line names its ticket. The work before the fork happens on F-012's branch; the vertical slice happens in the fork when Bryon starts it.
- Strategy and art direction (can start now, in this repo): how the edition differs, what it keeps, and the look: mood boards and a few test sprites for rooms, furniture and people, Into the Breach-like. → T-126, T-127
- Layout tests in Pixi: the borehole round and square in fixed iso, compared side by side. → T-128
- A vertical slice in Pixi: one floor, a few rooms and people, in sprites, driven by the forked sim. → T-129
- Then a plan of its own.

## Open questions
- [x] Same repo or a fork? A fork.
- [x] Round or square? Test both and decide from feedback.
- [x] Engine? Pixi first, Godot 2D probably later.
- [x] When? After the current game reaches a milestone; art style exploration in parallel.
- [x] When does the edition start properly? Bryon will call it. Until then, strategy and art direction work happens here (with this repo's context); the fork comes when he says so.

## History
- 2026-10-10 00:18 opened from N-0064
- 2026-10-10 questions answered: fork
- 2026-10-10 00:27 questions answered
- 2026-10-10 questions answered: test both layouts, Pixi first, later with art style in parallel
- 2026-10-10 00:35 questions answered
- 2026-10-10 questions answered: strategy and art direction now, fork when Bryon says
- 2026-10-10 00:38 questions answered
- 2026-10-10 00:47 agreed
- 2026-10-10 00:47 built on feature/f-012-2d-isometric-edition
