---
id: F-014
title: "Difficulty levels: easy, normal and hard, picked for a new game"
status: draft
plan:
notes: [N-0066]
created: 2026-10-10 00:18
---
## Goal
A difficulty picker when creating a new game. Players new to the game or the genre pick easy; experienced players go for a challenge on hard. Today's difficulty becomes "normal".

## Design
- Rule 4 (data in JSON) makes this a set of multipliers in data, e.g. `data/difficulty.json` with easy/normal/hard, read by the sim; normal is all 1×.
- Likely knobs: starting resources, build costs, construction and dig time, upkeep and decay (condition), how fast needs fall (happiness, health), event frequency and severity (`data/events.json`), unlock thresholds (`unlocks` in `data/config.json`), deadlines such as F-011's move-out.
- Picked on the new-game screen (the welcome card, `src/ui/`; F-007 adds the guided-tutorial choice there too) and saved with the game; Godot's new-game flow likewise.
- Tests: the scripted playthroughs in `tests/` run on normal; maybe a smoke run on easy and hard.

## Breakdown
Proposed; becomes tickets once this feature is agreed.
- Difficulty in the sim: the data file of multipliers, applied where the knobs live, saved with the game.
- The picker on the web's new-game screen, with a line on what each level means.
- The picker in Godot.
- Tuning pass: easy and hard played through and adjusted.

## Open questions
- [ ] What should easy and hard change? Pick from: starting resources, costs, build and dig time, decay, needs, events, unlock thresholds, deadlines. Anything that should never change?
- [ ] Can difficulty be changed mid-game (in settings), or only when starting?
- [ ] Should easy go with the guided tutorial by default (F-007)?

## History
- 2026-10-10 00:18 opened from N-0066
