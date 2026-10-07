---
id: F-008
title: The site: a hole that feels like its own place on Mars
status: agreed
plan:
notes: [N-0011, N-0035, N-0036, N-0037]
created: 2026-10-07 18:58
---
## Goal
Each hole should feel like a particular place on Mars: its ground the colour the map shows there, its sun crossing the sky for its latitude, its own weather, and a believable horizon. Collected from tickets made separately (Bryon agreed the grouping, Oct 7).

## Design
- **One per-site lookup.** Every task reads the site's latitude, longitude and elevation, and T-073 adds a colour and an ice flag per 1° cell to `data/mars-elevation.json` (from the relief map's palette). Build that lookup once, in T-073, as a small module the others use (sim side for weather; view side for ground colour, sun and horizon; through the bridge for Godot).
- **Shared terrain code.** T-073 tints the ground, near terrain and horizon in `src/render3d/terrain3d.ts` (and `godot/src/Terrain.cs` via `src/bridge/terrain.ts`); T-016 rebuilds the horizon landforms in the same files, so it follows T-073 and keeps the tint.
- **The sun.** T-020 moves sun and stars by latitude; T-074's sunrise and sunset and day/night temperatures should use the same sun model, so T-074 reads T-020's numbers if T-020 is in, or provides them for it.
- Decisions already made in the tickets: soil matches the map as drawn; only the polar caps are ice; weather is flavour only, a HUD chip that opens a card, no seasons yet; horizon gets real 3D landforms at several distances, plus large craters.

## Breakdown
Agreed Oct 7. T-073 first; the rest in any order after it.
- (M) Site colour and ice: the per-site lookup, soil tint, no holes on the polar caps → T-073
- (M) A local weather report from latitude, elevation, time of day and storms → T-074
- (M) Sun and stars move by the site's latitude → T-020
- (L) Believable 3D mesas, mountains and plateaus on the horizon, and big craters → T-016

## History
- 2026-10-07 18:58 made from T-016, T-020, T-073 and T-074 (Bryon agreed the grouping)
- 2026-10-07 18:58 made from T-016, T-020, T-073, T-074
