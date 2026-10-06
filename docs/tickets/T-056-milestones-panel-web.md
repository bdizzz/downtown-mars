---
id: T-056
title: The milestones panel on the web
status: open
size: M
area: ui
touches: [src/ui/MilestonesPanel.tsx, src/ui/Dock.tsx, src/view/, src/ui/styles.css]
blocked_by: [T-055]
feature: F-005
notes: [N-0025]
created: 2026-10-06 01:40
---
## Problem
F-005's panel: what the hole has achieved and what's ahead.

## Context
See F-005's Design. Put the panel's text in `src/view/` (like `roomPanel.ts`) so T-061 can reuse it for Godot.

## Approach
A dock button opens a panel grouped (Survival, Life, Growth, Network): earned ones with their date, the rest ahead, with progress where it's a number (population 73/100). A network section lists the other holes' milestones. Done: panel shows the T-055 milestones, updates live.

## Docs to update
GUIDE.md: a Milestones section. README: the short overview.

## History
- 2026-10-06 01:40 opened from F-005's breakdown
