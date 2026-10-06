---
id: T-074
title: A local weather report for each hole
status: open
size: M
area: sim, ui
touches: [src/sim/weather.ts, src/sim/snapshot.ts, data/config.json, src/ui/Hud.tsx, src/ui/, src/view/, src/bridge/, godot/]
blocked_by: []
notes: [N-0037]
created: 2026-10-06 09:45
---
## Problem
"We should add a local weather report, even though the hole colony is insulated within their habitable space."

## Context
The sim's weather today is only dust storms (`src/sim/weather.ts`: forecast a few days ahead, cutting solar output; deterministic from a hash of the hole and day). The HUD shows a storm chip (`src/ui/Hud.tsx`). Each hole has a latitude, longitude and elevation (the map, `data/mars-elevation.json`); T-020 moves the sun by latitude, and T-021 may call a game day a month.

## Approach
A small report per hole, worked out deterministically from latitude, elevation, time of day and the storm state, with values in believable Martian ranges: air temperature (about −100 to +20 °C, day/night swing, colder high and toward the poles), pressure (lower at altitude, ~4–10 mbar), wind, dust opacity (τ, high in a storm), and sunrise/sunset. Shown as a compact weather card or HUD chip that expands, with the storm forecast folded in; panel text in `src/view/` so Godot shows the same. Flavour only: it doesn't change the sim beyond what storms already do. Done: two sites at different latitudes and heights read clearly differently, and the report changes through the day and in a storm.

## Docs to update
GUIDE.md: Weather. DECISIONS.md: the report is flavour (if agreed).

## Open questions
- [ ] Flavour only (proposed), or should weather start to matter (cold snaps raising power use, wind on the surface works)?
- [ ] Where: a small HUD chip that opens a card (proposed), or a section of an existing panel?
- [ ] Seasons too (Mars's year, so temperatures drift over months), or day/night and latitude only for now (proposed)?

## History
- 2026-10-06 09:45 opened from N-0037
