---
id: T-086
title: "Show me" clips: the popup, and a script to record them by hand
status: open
size: M
area: ui, devtools
touches: [src/ui/Tutorial.tsx, scripts/clips.mjs, public/clips/, package.json]
blocked_by: [T-085]
feature: F-007
notes: [N-0046]
created: 2026-10-07 18:44
---
## Problem
F-007: short looping videos of a step's action, shown in a popup when the player asks ("Show me").

## Context
See F-007's Design. Recorded by a scripted browser run (e.g. Playwright) against a fixed save; **run by hand occasionally** (`npm run clips`), never in CI or on every PR (Bryon, Oct 7). Keep files small (silent, short, modest resolution, WebM or MP4).

## Approach
`scripts/clips.mjs`: load the fixed save, perform each step's action, record it, write `public/clips/<name>.webm`. The card shows "Show me" when its step names a clip that exists; the popup loops it muted, with a close button. Done: running the script makes the clips; the guided steps that name one show it; a missing clip just hides the button.

## Docs to update
README: Developing (how and when to remake the clips).

## History
- 2026-10-07 18:44 opened from F-007's breakdown
