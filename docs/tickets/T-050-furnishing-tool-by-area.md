---
id: T-050
title: The furnishing tool by area
status: open
size: M
area: devtools, data
touches: [src/devtools/, src/view/furnish.ts, data/layouts.json, data/rooms.json]
blocked_by: [T-046]
feature: F-004
notes: [N-0008]
created: 2026-10-06 00:32
---
## Problem
The furnishing tool (`?furnish`) works by area: templates keyed by size and depth, previews at any ring and area, and a room type's target area set there (Bryon, Oct 4).

## Context
Read F-004 (`docs/tickets/F-004-rooms-by-area.md`) and its plan, `docs/PLAN-M17.md`, first; this is step 12 of its Steps. Built on F-004's own branch: the PR goes into `feature/f-004-rooms-by-area`, not main.

## Approach
Template keys `galley:M`, `farm:L2` instead of `galley:2x1` (layouts.json migrated); preview a template on any ring at any area in the leeway (a slider); set a type's target area, written to `rooms.json` as `area`. Done: the tool previews and saves; furnished rooms look the same as before in the game.

## Docs to update
PLAN-M17.md Notes as built; FURNITURE.md.

## History
- 2026-10-06 00:32 opened from F-004 (agreed)
