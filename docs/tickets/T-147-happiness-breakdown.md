---
id: T-147
title: The happiness tooltip says what's raising and lowering it
status: open
size: M
area: sim, ui
touches: [src/sim/happiness.ts, src/view/hudItems.ts, src/ui/ResourceBar.tsx]
blocked_by: []
notes: [N-0082]
created: 2026-10-11 15:52
---
## Problem
"The happiness metric and tooltip should tell you what is impacting the score."

## Context
The tooltip (`res:happiness` in `src/view/hudItems.ts`, shared with Godot) only says "the average, across every home" plus afterglow and morale. The factors are worked out per home in `sim/happiness.ts` (`homeFactors`: comfort, amenities, crowding, noise, smell, condition…), but only the average reaches the snapshot.

## Approach
Have the sim sum each factor's contribution across homes (weighted by people) into the snapshot, and list the top three pluses and minuses in the tooltip, e.g. "−6 noise, −4 crowding, +5 parks nearby". Done: the tooltip explains a low score well enough to know what to build.

## Open questions
- [x] Tooltip only, or also a fuller breakdown somewhere (the Charts area, or the People panel)? (Claude's default: tooltip with the top three each way.) → The tooltip, top three each way. (Bryon, Oct 11)

## History
- 2026-10-11 15:52 opened from N-0082
- 2026-10-11 16:08 questions answered
