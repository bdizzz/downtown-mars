---
id: T-066
title: Audio buses and volume sliders for music, effects and ambience
status: open
size: S
area: audio, ui
feature: F-006
touches: [src/audio/sound.ts, src/ui/settings.ts, src/ui/SettingsView.tsx, src/ui/useSounds.ts]
blocked_by: [T-088]
notes: [N-0032]
created: 2026-10-06 02:20
---
## Problem
F-006's groundwork: separate volumes for master, music, effects and ambience, and one place that maps game happenings to sounds.

## Context
See F-006's Design. Today `src/audio/sound.ts` has one master gain and on/off switches for sfx and ambient (`src/ui/settings.ts`, `SettingsView.tsx`); `src/ui/useSounds.ts` decides what plays when.

## Approach
Four gain buses under master; settings become four sliders (old saves of settings map on/off to 0 or the default). Music defaults on at a medium volume (Bryon, Oct 6). Move the happening → sound mapping into one table so T-067 can grow it. Done: sliders work and persist; existing sounds play through the right bus.

## Docs to update
GUIDE.md: Settings.

## History
- 2026-10-06 02:20 opened from F-006's breakdown
- 2026-10-07 18:58 waits on T-088 (settings layout)
