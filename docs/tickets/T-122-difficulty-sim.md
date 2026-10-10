---
id: T-122
title: "Difficulty in the sim: easy, normal and hard multipliers from data, saved with the game"
status: open
size: L
area: sim, data
touches: [data/difficulty.json, src/sim/]
blocked_by: []
feature: F-014
notes: [N-0066]
created: 2026-10-10 00:40
---
## Problem
Difficulty as data-driven multipliers the sim applies; normal is all 1×.

## Context
Read F-014 first: its Design holds the decisions this task builds on.

## Approach
`data/difficulty.json` with easy/normal/hard values for every knob in F-014's design (starting resources, costs, build and dig time, decay, needs, events, unlock thresholds, deadlines). The sim reads the game's level, set at creation and saved; not changeable later. Tests that normal matches today and easy/hard move each knob.

## History
- 2026-10-10 00:40 opened from F-014 (agreed)
