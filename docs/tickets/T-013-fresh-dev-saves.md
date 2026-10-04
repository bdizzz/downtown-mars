---
id: T-013
title: Fresh dev saves in public/, made by a script so they stay current
status: open
size: M
area: sim, docs
touches: [public/, scripts/, tests/bot.ts, src/sim/save.ts, .gitignore]
blocked_by: []
notes: [N-0009]
created: 2026-10-04 19:23
---
## Problem
"We should build some new saves for the public folder, since a lot has changed since they were made."

## Context
- `public/` holds five hand-made saves from Sep 27, all far behind the current format (`SAVE_VERSION` is 18): `dev-save.json` (v2, day 15, 44 people), `dev-save-40.json` (v2, 20 people), `dev-save-found.json` (v6, day 19, one hole), `dev-save-two.json` (v6, day 22, two holes), `dev-save-rovers.json` (v7, day 22, two holes). They load through migrations, so they predate corridors on edges, construction time, excavation, furnishing, the sealed network, bulkheads, windows and events: little of today's game shows in them.
- They're git-ignored (`.gitignore`: `public/dev-save*.json`), so each machine has its own (or none). PLAN-M3 says the first one came from the scripted player (the bots, `tests/bot.ts`, `tests/adaptive.ts`); nothing regenerates them now, and nothing in `src/` loads them by name (they're opened with the save menu's import).
- The Godot viewer's testing (PLAN-GODOT.md, "Testing the viewer") and `src/bridge/saves.ts` may want the same saves.

## Approach
A script (e.g. `npm run saves`, running the bots headless with fixed seeds) that plays to a few useful moments and writes current-version saves to `public/`, so they can be rebuilt whenever the game moves on. Done: fresh saves covering early, mid and network game, each opening cleanly in the browser (at [::1]:5173) and in Godot, and a line in the README or GUIDE on rebuilding them.

## Docs to update
- README.md or PLAN-GODOT.md (Testing the viewer): the dev saves and how to rebuild them.

## Open questions
- [x] Four moments: **early** (day 5, the first rooms and corridors), **mid** (about day 30, around 100 people, furnished, windows, a few events seen), **network** (two holes linked by a gallery tube), and **late** (as big as the bots get, with the dome if they reach it). (Bryon, Oct 4)
- [x] Check them in: drop `public/dev-save*.json` from `.gitignore` and replace the five old saves. (Bryon, Oct 4)

## History
- 2026-10-04 19:23 opened from N-0009
- 2026-10-04 19:25 questions answered
