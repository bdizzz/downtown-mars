---
id: T-125
title: "Tune easy and hard by playing them through"
status: open
size: M
area: balance
touches: [data/difficulty.json, tests/]
blocked_by: [T-123]
feature: F-014
notes: [N-0066]
created: 2026-10-10 00:40
---
## Problem
Easy should feel welcoming to newcomers and hard a real challenge.

## Context
Read F-014 first: its Design holds the decisions this task builds on.

## Approach
Play (or run bots) on easy and hard, adjust `data/difficulty.json`, and add a smoke playthrough per level in `tests/`.

## History
- 2026-10-10 00:40 opened from F-014 (agreed)
