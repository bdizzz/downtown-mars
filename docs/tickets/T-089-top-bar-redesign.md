---
id: T-089
title: A clearer, more compact top bar: icons, a resource grid, what needs you first
status: done
size: L
area: ui, godot
feature: F-009
touches: [src/ui/Hud.tsx, src/ui/ResourceBar.tsx, src/ui/StatusBar.tsx, src/view/hudItems.ts, src/ui/styles.css, src/ui/icons/, src/bridge/, godot/src/]
blocked_by: []
notes: [N-0049]
created: 2026-10-07 18:51
---
## Problem
"Better, more intuitive UI for the top of the screen. There is a lot going on there and hard to tell what you need to know about immediately. Consider ways to make the information more compact, such as icons instead of whole words. Perhaps introduce a grid to put resources in."

## Context
The top bar is `src/ui/Hud.tsx` (speeds, office, storm chip and extras), `ResourceBar.tsx` and `StatusBar.tsx`, fed by `src/view/hudItems.ts` (`barItems()`: resources by name, air and CO2, colonists, happiness, condition, workers, power, each with `warn`, `full`, trend and notes; `topExtras()`), which the bridge also uses for Godot. There's no icon set yet. Coming soon to the bar: T-074's weather chip, T-064's update banner; F-007 (T-084) will hide and reveal its elements one by one, so give each a stable id.

## Approach
Answered (Bryon, Oct 7): one simple icon set drawn for the game; Godot in this ticket.

- **What needs you first:** a slot at the left (or centre) for anything in trouble (running out, power short, air bad, a storm coming, someone waiting), loud and few; everything fine stays quiet.
- **Icons instead of words:** a small, consistent icon per resource and stat (simple SVGs in one set, readable at 16–20 px, colour-blind safe with shape, not just colour), the name in the tooltip or on tap.
- **A resource grid:** resources as compact icon + number cells with a tiny trend arrow, in a grid that wraps on narrow screens; a cell turns amber or red when low, and tapping one opens its flow or trend.
- Keep it in `hudItems.ts` (add an icon id per item) so Godot gets the same layout from the bridge; Godot draws the same SVG icons.
Done: at a glance you can tell what needs attention; the bar takes less room than now; works on a phone; Godot matches.

## Docs to update
GUIDE.md: The top bar. ART.md: the icon set.

## Open questions
- [x] Icons: drawn for the game as one simple set (proposed), or an open-source set (Lucide, Phosphor) plus a few custom ones?
- [x] Godot in this ticket (proposed: yes, since the bar's content already comes through the bridge), or a follow-up?

## History
- 2026-10-07 18:51 opened from N-0049
- 2026-10-07 18:53 questions answered
- 2026-10-07 18:58 moved into F-009
- 2026-10-08 06:33 building on claude/brave-fermat-mmtj7f
- 2026-10-08 06:53 built: icons in src/view/icons.ts (Godot gets them through the bridge), cells with level/dir/stable ids, needs() for the slot; Godot not compiled here (no .NET in the session)
