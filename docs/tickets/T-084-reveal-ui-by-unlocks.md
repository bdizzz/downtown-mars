---
id: T-084
title: Hide the interface until the guided tutorial reveals it
status: open
size: M
area: ui
feature: F-007
touches: [src/ui/Hud.tsx, src/ui/Dock.tsx, src/ui/BuildPalette.tsx, src/ui/App.tsx, src/ui/styles.css]
blocked_by: [T-083, T-089]
notes: [N-0046]
created: 2026-10-07 18:44
---
## Problem
F-007: in guided mode, interface elements stay hidden until a step introduces them (the speed buttons first, on their own).

## Context
See F-007's Design. Give HUD, dock and build-palette elements stable ids (the tutorial's `highlight` ids are a start, e.g. `hud:office`).

## Approach
A small `useUnlocked(id)` gate: in guided mode, elements not yet unlocked aren't rendered (hidden, not dimmed); newly unlocked ones appear with a gentle highlight. Their keyboard shortcuts are off until then too. A "Show everything" button on the card ends guided mode and reveals all. Done: a guided game starts with almost nothing on screen and gains elements step by step; "Show everything" restores the full interface at once.

## History
- 2026-10-07 18:44 opened from F-007's breakdown
- 2026-10-07 18:58 waits on T-089 (top bar ids)
