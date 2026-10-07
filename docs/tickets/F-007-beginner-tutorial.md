---
id: F-007
title: A hand-holding tutorial for newcomers to city builders
status: draft
plan:
notes: [N-0046]
created: 2026-10-06 19:31
---
## Goal
A version of the tutorial for people unfamiliar with city builders or colony sims, "that holds their hand much more through the first stages of the game." The interface is revealed a piece at a time: the speed buttons introduced on their own, and other elements hidden until the tutorial has covered them. Optionally, short auto-playing clips of tasks and actions "that can show in a popup if the player wants to see that for a step."

## Design
- **What exists:** the deputy's card (`src/ui/Tutorial.tsx`, `data/tutorial.json`, goals checked in `src/ui/tutorialGoals.ts`; Godot via `src/bridge/tutorial.ts` and `Tutorial.cs`) shows one goal at a time with a hint and highlights what it points at (`highlight`, e.g. `hud:office`). T-053's welcome card opens new games; T-080 and T-081 improve the current tutorial.
- **Two tutorials:** the current one stays for people who know the genre; the new **guided** one is picked on the welcome card ("I'm new to games like this").
- **Revealing the interface:** each guided step names the UI elements it unlocks; everything not yet unlocked is hidden (not just dimmed) in the HUD, dock and build palette. A "Show everything" escape hatch ends the guided mode. The game may pause or run slow between steps so nothing goes wrong while the player reads.
- **Clips:** short, silent, looping videos per step (placing a room, drawing a corridor, reading the flows), shown in a popup on request ("Show me"). Recorded with a scripted browser run against a fixed save so they can be remade when the UI changes; WebM/MP4, small. Godot would show the same files.
- Steps, hidden elements and clip names in data, so Godot reads the same.

## Breakdown
Proposed; becomes tickets once this feature is agreed.
- Guided steps in data and the choice on the welcome card; the step engine extended with "unlocks" per step.
- Hiding and revealing the HUD, dock and build palette by what's unlocked, with the escape hatch.
- Writing the guided steps: the speed controls, the drill, the first rooms, corridors, food and air, people and the office, in small pieces.
- The "Show me" popup and a script that records the clips from a fixed save.
- The guided tutorial in Godot.

## Open questions
- [ ] Clips: recorded videos (proposed; a script remakes them), or live animated demonstrations in the game itself (always current, more work)?
- [ ] Does the game pause between guided steps (proposed: run at a slow speed, pausing on steps that need reading), or run normally?
- [ ] Should the new player's colony be made safer during the guided start (no storms or events until the basics are covered)? Proposed: yes.

## History
- 2026-10-06 19:31 opened from N-0046
