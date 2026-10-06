---
id: T-070
title: Music that follows the game, and the room make-up of the floor in view
status: open
size: M
area: audio, ui
touches: [src/audio/music.ts, src/ui/, data/rooms.json, data/music.json]
blocked_by: [T-069]
feature: F-006
notes: [N-0032]
created: 2026-10-06 02:20
---
## Problem
F-006's adaptive music: tension and celebrations colour it when they happen; otherwise the mix of rooms on the floor in view slowly sets the mood (industrial → rhythmic and repetitive, farming → folksy).

## Context
See F-006's Design (Bryon's idea, Oct 6). Inputs: time of day, events and celebrations (`src/sim/events.ts` cards in the snapshot), storms, pause, and the floor in view's rooms. Room → mood weights in data (a `music` tag per room category). Transitions never abrupt.

## Approach
Each second compute a target mood blend from those inputs; ease the current blend towards it over many bars (slow for floor make-up, a bit quicker for tension or a celebration), so a quick look at another floor barely moves it. Done: sitting on a farm floor drifts folksy within a minute or two, an industrial floor drifts rhythmic, a festival brightens it, pause quiets it.

## Docs to update
GUIDE.md: Sound and music.

## History
- 2026-10-06 02:20 opened from F-006's breakdown
