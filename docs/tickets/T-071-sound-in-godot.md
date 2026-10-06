---
id: T-071
title: Sound effects, ambience and music in Godot
status: open
size: L
area: godot, audio
touches: [godot/, src/bridge/, data/sounds.json, data/music.json]
blocked_by: [T-067, T-068, T-070]
feature: F-006
notes: [N-0032]
created: 2026-10-06 02:20
---
## Problem
F-006 in the Godot viewer, which has no sound yet.

## Context
See F-006's Design: rebuild the synth in C# on `AudioStreamGenerator` (Bryon, Oct 6), reading the same `data/sounds.json` and `data/music.json`, so both sound alike. The bridge passes the happenings (or the web's happening → sound table output) and the mood blend inputs. `PLAN-GODOT.md` says sound settings wait on audio.

## Approach
A small synth in C# (oscillators, noise, envelopes, filters, plucks), the music scheduler ported, buses and the four sliders in Godot's settings. Done: Godot plays the same effects, ambience and adaptive music, checked with a test run.

## Docs to update
PLAN-GODOT.md: Status and next, and its Sound note.

## History
- 2026-10-06 02:20 opened from F-006's breakdown
