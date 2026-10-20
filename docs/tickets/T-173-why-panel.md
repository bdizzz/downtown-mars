---
id: T-173
title: A "Why?" panel ranks what's hurting health and happiness, with fixes and Show me
status: done
size: M
area: ui
feature: F-018
touches: [src/ui/WhyPanel.tsx, src/ui/Hud.tsx, src/ui/App.tsx, src/view/]
blocked_by: [T-171]
notes: [N-0095]
created: 2026-10-19 21:57
---
## Problem
The hover card says the top causes; the player needs the whole list, the fix for each and where the problem is.

## Context
Read F-018. The tutorial's highlight (`highlight` in `data/tutorial.json`) and room selection can serve Show me. Put the text-building in `src/view/` so Godot (T-178) reuses it.

## Approach
Clicking Health or Happiness opens the panel: causes ranked by size, each with its fix and a Show me that highlights the rooms or homes involved and moves the camera to them; then the five unhappiest homes (click to select). Done: in a hole with a smell problem, Show me lands on the smelly room and the homes it reaches.

## Docs to update
GUIDE.md: Health and happiness.

## History
- 2026-10-19 21:57 opened from F-018
- 2026-10-20 03:04 built on ccr-ae9918df-rbn2zw (with T-173–T-175)
