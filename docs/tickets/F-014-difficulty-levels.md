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
- **All the knobs above** scale with difficulty, including deadlines like F-011's move-out.
- Chosen **only at the start**; not changeable mid-game.
- **Easy turns on the guided tutorial by default** (F-007), which the player can still switch off.
- Picked on the new-game screen (the welcome card, `src/ui/`; F-007 adds the guided-tutorial choice there too) and saved with the game; Godot's new-game flow likewise.
- Tests: the scripted playthroughs in `tests/` run on normal; maybe a smoke run on easy and hard.

## Breakdown
Proposed; becomes tickets once this feature is agreed.
- Difficulty in the sim: the data file of multipliers, applied where the knobs live, saved with the game.
- The picker on the web's new-game screen, with a line on what each level means.
- The picker in Godot.
- Tuning pass: easy and hard played through and adjusted.

## Open questions
- [x] What changes? All of the above.
- [x] Mid-game? Only at the start.
- [x] Easy and the tutorial? Easy turns the guided tutorial on by default.

## History
- 2026-10-10 00:18 opened from N-0066
- 2026-10-10 questions answered: all knobs, start only, easy turns on the tutorial
- 2026-10-10 00:35 questions answered
