---
id: T-170
title: The floor picker shows the drill's progress on the floor being dug; pause it from the drill
status: open
size: M
area: ui, godot
touches: [src/ui/FloorPicker.tsx, src/ui/Hud.tsx, src/view/hudItems.ts, src/render3d/drillRig.ts, src/render3d/pick3d.ts, godot/src/]
blocked_by: []
notes: [N-0094]
created: 2026-10-13 20:43
---
## Problem
"You shouldn't be able to select a floor on the floor picker bar until the drill is complete with drilling out that floor." The floor being dug shows an overlay with its progress %, so the drill % and drill pause leave the top bar. "Clicking on the drill itself gives you a choice for pausing it."

## Context
The top bar's drill item and pause button: `src/ui/Hud.tsx` (around line 152), its text from `src/view/hudItems.ts` (shared with Godot). Floor picker: `src/ui/FloorPicker.tsx`. The rig is drawn in `src/render3d/drillRig.ts`; picking in `pick3d.ts`. Tutorial steps may point at the drill in the top bar (`data/tutorial.json`, `data-hud="drill"`).

## Approach
The floor picker lists the floor being drilled greyed out, filling with progress and a %; it can't be selected until done. The top bar loses the drill item, on phones too. Clicking the drill rig (or its floor in the picker) opens a small panel: progress, depth, pause/resume. Same in Godot. Update tutorial steps that point at the old item. Done: dig a floor and watch it fill in the picker; pause from the rig.

## Docs to update
GUIDE.md: Drilling; tutorial text.

## Open questions
- [x] On phones, where the picker may be small (T-106), is the progress fill enough, or keep a tiny drill mark in the top bar? (Claude's default: the fill is enough.) → The fill is enough. (Bryon, Oct 13)

## History
- 2026-10-13 20:43 opened from N-0094
- 2026-10-13 20:47 questions answered
