---
id: T-111
title: "The move-out mission: the pod's checklist, the radiation deadline and deconstructing the pod"
status: open
size: L
area: sim, events
touches: [data/missions.json, src/sim/, data/rooms.json, data/config.json]
blocked_by: [T-110]
feature: F-011
notes: [N-0061]
created: 2026-10-10 00:40
---
## Problem
The first mission: move everything the landing pod provides underground, then deconstruct it for resources.

## Context
Read F-011 first: its Design holds the decisions this task builds on.

## Approach
Find everything `landing_pod` provides in the sim (housing, meals, services…) and make a checklist item for each that ticks only when spare capacity elsewhere covers it. Start at month 12 or when the tutorial ends, whichever is first; deadline 24 months later (normal). Past the deadline everyone takes a small health penalty ramping in over about 6 months. When all items tick, offer "Deconstruct the landing pod for resources" (an event-style choice) paying out metal, glass, electronics, machinery; numbers in data. Scripted playthrough in `tests/` covering the whole mission.

## History
- 2026-10-10 00:40 opened from F-011 (agreed)
