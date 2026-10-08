---
id: T-092
title: The guide's pages: generated from the game's data, plus hand-written ones, links checked
status: open
size: L
area: ui, data
touches: [src/view/wiki/, docs/wiki/, data/*.json, tests/wiki.test.ts]
blocked_by: []
feature: F-010
notes: [N-0050]
created: 2026-10-08 02:14
---
## Problem
F-010's foundation: one set of guide pages, most generated from `data/*.json`, the rest written by hand, all interlinked.

## Context
See F-010's Design. Rooms (`data/rooms.json`), resources, crops, materials (`data/materials.json`, T-032), events (`data/events.json`) have what a page needs: size, staff, inputs, outputs, effects, cost, unlocks. Shared view code lives in `src/view/` so the bridge can reuse it for Godot (T-097).

## Approach
A page model (id, title, kind, body as markdown with `[[links]]`, "made by", "used by", "see also", locked-until), a generator in `src/view/wiki/` that builds pages from the data, and hand-written pages as markdown with front matter in `docs/wiki/`, loaded at build time. Cross-references computed both ways (a room's outputs link to the resource; the resource lists the rooms that make and use it). Unlocks recorded so locked pages can be marked (Bryon, Oct 8). A test fails on any broken link or orphan page. Done: every built room, resource, crop, material and event has a page, all links resolve, and adding a room to the data adds its page.

## Docs to update
DECISIONS.md: the guide is generated from data plus hand-written mechanics pages.

## History
- 2026-10-08 02:14 opened from F-010's breakdown
