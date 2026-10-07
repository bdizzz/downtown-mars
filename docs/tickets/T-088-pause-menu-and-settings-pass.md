---
id: T-088
title: A layout pass on the pause menu and settings: easy to use, dense, mobile and keyboard friendly
status: open
size: M
area: ui, godot
touches: [src/ui/Menu.tsx, src/ui/SettingsView.tsx, src/ui/settings.ts, src/ui/styles.css, godot/src/]
blocked_by: []
notes: [N-0048]
created: 2026-10-07 18:51
---
## Problem
"A pass at the layout and presentation of the pause menu and settings, for ease of use and information density. Should be usable on mobile and keyboard accessible."

## Context
The menu is `src/ui/Menu.tsx` (128 lines) and settings `src/ui/SettingsView.tsx` (133 lines), backed by `src/ui/settings.ts`. T-025 made the game work on phones. Several tickets are about to add settings: T-066 (four volume sliders), T-072 (Android system bar), T-078 (tilt-shift slider), T-064 (update banner), so the new layout should make adding a setting easy. Godot has its own menu and settings (`PLAN-GODOT.md`: autosave, colour-blind overlays, interface size, graphics level).

## Approach
Settings grouped into a few sections (Game, Display, Sound, Controls, Accessibility), as tabs on wide screens and stacked sections on narrow ones; each setting one compact row: name, control, a one-line hint. Settings described in one table so the menu, sections and Godot can read the same list. Menu: clear primary actions (Resume, Save, Load, Settings, Help, Quit to title) with the version and branch out of the way. Keyboard: Esc opens and closes, Tab and arrows move through everything with a visible focus ring, Enter and Space act, sliders take arrows. Touch targets at least 44 px on phones. Done: every setting reachable and changeable by keyboard alone and on a phone without zooming; more fits on screen than now. Godot follows the same grouping.

## Docs to update
GUIDE.md: Settings.

## Open questions
- [ ] Godot in this ticket (proposed: same grouping, as its settings are few), or a follow-up?

## History
- 2026-10-07 18:51 opened from N-0048
