---
id: T-110
title: "The missions system in the sim: catalogue, triggers, checklist, deadline, reward"
status: open
size: L
area: sim, data
touches: [src/sim/, data/missions.json, src/worker/]
blocked_by: [T-055]
feature: F-011
notes: [N-0061]
created: 2026-10-10 00:40
---
## Problem
Missions as a sim system: a catalogue in data, start triggers, checklist tracking, a deadline and a reward, saved with the game.

## Context
Read F-011 first: its Design holds the decisions this task builds on.

## Approach
Build on T-055's milestone tracking (missions and milestones share tracking and a panel). `data/missions.json` holds each mission's trigger, checklist items, deadline months (scaled by difficulty once F-014 lands), reward (resources and unlocks) and story text. The sim tracks active missions, ticks checklist items, and fires the deadline and reward; state is in the snapshot and saves. Unit tests for start, tick, deadline and completion.

## History
- 2026-10-10 00:40 opened from F-011 (agreed)
