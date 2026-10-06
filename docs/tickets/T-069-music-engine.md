---
id: T-069
title: The music engine: generative cozy Mars music
status: open
size: L
area: audio, data
touches: [src/audio/music.ts, data/music.json]
blocked_by: [T-066]
feature: F-006
notes: [N-0032]
created: 2026-10-06 02:20
---
## Problem
F-006's procedurally generated, cozy, uplifting Mars music.

## Context
See F-006's Design. All synthesized (Bryon, Oct 6). Must be deterministic from a seed and never jarring; on the music bus from T-066.

## Approach
A scheduler a bar or two ahead on the Web Audio clock: a key and mode, chord progressions from a small set, a pad layer, a melody from the scale (step-wise, resolving), optional soft pulse; instruments as synth patches in `data/music.json` (warm pads, bells, Karplus–Strong plucks, a breathy wind) so Godot reads the same. Expose a **mood blend** input (weights like calm, rhythmic, folksy, glassy, bright, tense) that changes instrument choice, density and rhythm; T-070 drives it. Done: it plays for an hour without getting tiresome, and a dev control can slide the mood blend to hear each.

## History
- 2026-10-06 02:20 opened from F-006's breakdown
