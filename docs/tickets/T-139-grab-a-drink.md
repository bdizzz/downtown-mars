---
id: T-139
title: "Easter egg: grab a hot drink in first person and carry the mug around"
status: open
size: M
area: render3d
touches: [src/render3d/stage3d.ts, data/furniture.json, src/ui/Help.tsx]
blocked_by: []
notes: [N-0070]
created: 2026-10-11 15:52
---
## Problem
In first person, near furniture that can serve drinks in a room that serves meals (a canteen, galley, maybe the nicer homes), a prompt: "press <key> to grab a drink". Doing it shows a first-person arm holding a mug of steaming dark brown liquid as you walk, like holding a gun or tool in other first-person games. It lasts until you leave first person; next time you're back to normal and have to visit a meal room again.

## Context
First person lives in `src/render3d/stage3d.ts`. Furniture models are in `data/furniture.json` (`kitchenette` in homes, `canteen_table`; a counter or urn in the galley would read best). Purely a view thing: nothing goes to the sim.

## Approach
Mark drink-serving furniture with a flag in `furniture.json`. In first person, when the camera is within reach of one and facing it, show the prompt; on the key (and a tap on touch), attach a small arm-and-mug model to the camera, low right, with a gentle bob as you walk and a few rising steam particles. Clear it on leaving first person. Done: walk into a galley, grab a drink, walk around holding it.

## Open questions
- [ ] Which key? (Claude's default: F, since E and Q already turn.)
- [ ] Which rooms: galley and canteen only, or homes with a kitchenette too (flat, family apartment, suite)?
- [ ] Web only, or Godot too?

## History
- 2026-10-11 15:52 opened from N-0070
