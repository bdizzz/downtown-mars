---
id: T-038
title: Pick a building material in build mode (defaults to bare rock)
status: open
size: M
area: ui, sim
feature: F-003
touches: [src/ui/BuildPalette.tsx, src/sim/commands.ts, src/sim/construction.ts, src/view/, godot/src/BuildMode.cs, tests/]
blocked_by: [T-032, T-033]
notes: [N-0006, N-0007]
created: 2026-10-06 00:20
---
## Problem
Refitting every room one by one is tedious in a big hole. Bryon (Oct 6): add a **building material** choice to build mode. It **always defaults to bare rock**, and you can pick a higher step to build the room straight away in that material. The cost is always **bare rock's cost plus the upgrade's**, however the room ends up in that material. But building it outright is **a single construction effort**: the room's own build time, with no refit work on top. That time saving is the benefit of choosing the material up front (Bryon, Oct 6).

## Context
Read F-003 and `docs/PLAN-M15.md` first. This moves "picking the material when building" out of the plan's Later list. Upgrade pricing and work per cell come from `data/materials.json` (T-032) and the both-steps pricing in the Upgrade action (T-033); reuse that rather than a second price table. Build mode: `src/ui/BuildPalette.tsx` (web) and `godot/src/BuildMode.cs` (Godot, which draws its palette from the bridge where it can).

## Approach
A material picker in build mode beside the room choice (the six wall steps, greyed when unaffordable or for exempt rooms like stairs and empty rooms), showing the extra cost. Placing sends the material with the build command; the job costs the room's build cost plus the upgrade's from bare rock (the full resources), and its work is **just the room's build time**, no refit work added. The finished room comes out lined, with no separate refit job. The choice **resets to bare rock** each time build mode opens and stays put while you place several rooms in a row. Done: in a big hole you can place a row of brick dorms in one go, each paying rock + brick but taking only a dorm's build time, and Godot's build mode offers the same.

## Docs to update
- GUIDE.md: Building, DECISIONS.md (build in a material), PLAN-M15.md (no longer Later; Notes as built).

## History
- 2026-10-06 00:20 opened from Bryon's answer on F-003 (rooms start as bare rock unless a material is picked when building)
- 2026-10-06 00:16 built outright: full cost, build time only (Bryon)
