---
id: F-006
title: More sound effects, and procedurally generated cozy Mars music
status: draft
plan:
notes: [N-0032]
created: 2026-10-06 02:12
---
## Goal
"Add more sound effects, and procedurally generated cozy uplifting Mars music." The game's sound today is a handful of synthesized placeholder effects and a hum; this gives it a real soundscape and a soundtrack that never repeats exactly, in keeping with the chill tone (SimCity/SimTower vibe, Frostpunk's tension without the crush).

## Design
- **What exists:** `src/audio/sound.ts` (159 lines, Web Audio): a master bus, a noise buffer, `tone()` and `noise()` helpers, `play(sfx)` for a few effects, an ambient life-support hum that grows with machines running (`setHum`). Settings are volume, sfx on/off and ambient on/off (`src/ui/settings.ts`). Godot has no sound yet (`PLAN-GODOT.md`: "Sound settings wait on audio").
- **Audio direction is listed as still open** in `DECISIONS.md` ("Still open"); this feature settles it. Proposed: everything synthesized in Web Audio (no sample files to license or ship), warm and soft (sine/triangle pads, plucks, gentle reverb), so effects and music share one palette.
- **Music, procedural:** a slow generative engine: a pentatonic or modal key, chord progressions from a small set, pads, a plucked or bell melody drawn from the scale with simple rules (step-wise, resolving), sparse percussion at most. Seeded, so it's varied but not random noise. It can follow the game gently: brighter by day and on celebrations, sparser at night or in a storm, a little tension when a strike or emergency looms, quiet when paused. Its own bus and volume.
- **More sound effects:** a pass over what the player does and what happens: placing and cancelling, construction finished, the drill (start, strike, a find), elevators, doors and airlocks, the supply drop landing, event cards arriving, celebrations, alerts and warnings, UI clicks, plus positional ambience in 3D near busy rooms (farm fans, workshops, the canteen's chatter) that fades with distance and the floor in view.
- Event triggers come from the snapshot and messages on the main thread; the sim stays silent (brain and face).
- Godot: Godot can't run Web Audio. Either port the synth to Godot's `AudioStreamGenerator`, or render stems from the web engine. A later task either way.

## Breakdown
Proposed; becomes tickets once this feature is agreed.
- Audio buses and settings: master, music, effects and ambience volumes (sliders, not just on/off); one place mapping game happenings to sounds.
- The sound-effects pass: a catalogue of events → effects in data, the new effects synthesized, wired to the snapshot and UI.
- Positional ambience in the 3D view: rooms that hum, whir or chatter, by distance and floor.
- The music engine: a generative cozy track (key, chords, pads, melody), seeded, with gentle crossfades.
- Music that follows the game: time of day, celebrations, tension, storms, pause.
- Sound and music in Godot.

## Open questions
- [ ] Fully synthesized (proposed), or are sample-based sounds and instruments okay (a small CC0 set, more realistic, more files)?
- [ ] Music always on by default, or off until turned on? Proposed: on, at a low volume.
- [ ] Should the music follow the game (day/night, tension, celebrations), or stay one steady mood? Proposed: follow it gently.
- [ ] Godot: port the synth (proposed, so both match), or leave Godot silent for now?

## History
- 2026-10-06 02:12 opened from N-0032
