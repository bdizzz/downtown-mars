---
id: T-172
title: Health and Happiness hover cards list the top causes, with numbers and the fix
status: open
size: S
area: ui
touches: [src/view/hudItems.ts, src/ui/ResourceBar.tsx]
blocked_by: [T-171]
feature: F-018
notes: [N-0095]
created: 2026-10-19 21:57
---
## Problem
Bryon's hole sat at health 3 and the Health card only said "From the air's oxygen and CO2, water, meals and sanitation".

## Context
Read F-018. `barItems` in `src/view/hudItems.ts` builds the notes (shared with Godot, so it gets this free).

## Approach
Health: "−13.5 a month: meals 40% met −6, CO2 1.4% −7.5", then the top fix; or "Recovering +10 a month". Happiness: the biggest pulls down and up in points. Top three causes each. Done: provoke a shortage and read it on the card, web and Godot.

## Docs to update
GUIDE.md: Health and happiness.

## History
- 2026-10-19 21:57 opened from F-018
