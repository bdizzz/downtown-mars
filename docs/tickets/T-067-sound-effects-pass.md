---
id: T-067
title: The sound-effects pass: more effects, from a catalogue in data
status: open
size: M
area: audio, data
touches: [data/sounds.json, src/audio/sound.ts, src/ui/useSounds.ts]
blocked_by: [T-066]
feature: F-006
notes: [N-0032]
created: 2026-10-06 02:20
---
## Problem
F-006's "more sound effects".

## Context
See F-006's Design for the list (placing and cancelling, construction done, drill start/strike/find, elevators, doors and airlocks, supply drop, event cards, celebrations, alerts, UI clicks). All synthesized (Bryon, Oct 6): extend the `tone()`/`noise()` helpers with envelopes, filters and plucks. Triggers come from snapshot changes and messages on the main thread; the sim stays silent.

## Approach
`data/sounds.json`: each effect as synth parameters (so Godot, T-071, can read the same), plus which happening triggers it and a cooldown so busy moments don't stack. Done: the listed happenings each have a warm, distinct sound; nothing machine-gun repeats.

## Docs to update
DECISIONS.md: audio direction settled (fully synthesized, cozy, shared palette); move it out of "Still open".

## History
- 2026-10-06 02:20 opened from F-006's breakdown
