---
id: F-012
title: "A 2D isometric sprite edition, in the style of Into the Breach"
status: draft
plan:
notes: [N-0064]
created: 2026-10-10 00:18
---
## Goal
A bigger, long-term idea: a version of the game in 2D sprites rather than 3D. The view is fixed isometric, with an aesthetic like Into the Breach. It skips "all the complicated 3d stuff" and puts more energy into detailed 2D art for furniture, rooms and people. It might be a separate game sharing some resources and logic with the web and Godot versions. Not a view you toggle in the existing game, and saves probably won't port back and forth. "All the concepts and mechanics in this game would be the same as the current game, just a completely different presentation," with some gameplay changes to suit it.

## Design
- The brain-and-face split (CLAUDE.md, architecture rules) is what makes this cheap: the TypeScript sim and `data/*.json` could drive a sprite renderer the way they drive Three.js and Godot today (the bridge, `src/bridge/`).
- The round borehole is the hard part for a fixed isometric grid: rings of curved rooms don't map neatly onto iso tiles. It may want a squarer model (rooms on a grid around a square shaft) or a stylised ring.
- Fixed camera means one or a few view angles per floor; the floor-by-floor model fits iso slices well.
- Art pipeline: sprite sheets for rooms, furniture (`FURNITURE.md`), people and animations; a big asset effort.

## Breakdown
Proposed; too early to cut tasks. Likely first steps:
- A design spike: how the borehole and rings look in fixed iso, and which mechanics change.
- A tech choice: Godot 2D (reusing the bridge) or a web 2D renderer (Pixi, already in the stack).
- A vertical slice: one floor, a few rooms and people, in sprites, driven by the real sim.
- Then a plan of its own.

## Open questions
- [ ] Same repo and sim (a new face on the same brain), or a fork that can change gameplay freely?
- [ ] Keep the round borehole in iso, or switch this edition to a square grid?
- [ ] Engine: Godot 2D (sharing the bridge with the current viewer) or web (Pixi)?
- [ ] When: after the current game reaches some milestone, or as a side track now?

## History
- 2026-10-10 00:18 opened from N-0064
