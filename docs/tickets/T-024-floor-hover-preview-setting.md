---
id: T-024
title: A setting to turn off previewing floors on hover
status: open
size: S
area: ui
touches: [src/ui/FloorPicker.tsx, src/ui/settings.ts, src/ui/SettingsView.tsx, src/ui/App.tsx]
blocked_by: []
notes: [N-0020]
created: 2026-10-05 02:54
---
## Problem
Hovering over another floor's button shows that floor, which "sometimes is jarring." Bryon wants a game setting, toggled in the settings menu, for whether floors preview on hover.

## Context
- `src/ui/FloorPicker.tsx`: "Pointing at a floor previews it; clicking keeps it"; `onMouseEnter` calls `onPreview(f)`, and leaving the strip ends it. The highlighted `preview` button style goes with it.
- Settings live in `src/ui/settings.ts` (`Settings`, `DEFAULT_SETTINGS`, saved per browser) and show in `src/ui/SettingsView.tsx`; older saved settings need the new key's default filled in.
- Godot's floor picker doesn't seem to preview on hover, so nothing to do there (worth a quick check).

## Approach
Add `floorHoverPreview: boolean` to the settings with a checkbox (e.g. under View: "Preview floors on hover"), default **off**, and skip `onPreview` when it's off. Existing players' saved settings also get it off (it's the new default, not a migration of the old behaviour). Done: with it off, hovering the floor buttons changes nothing until you click.

## Docs to update
- GUIDE.md: Settings (and where it describes the floor picker).

## Open questions
- [x] **Off by default**: floors change only on a click unless the player turns previewing on. (Bryon, Oct 5)

## History
- 2026-10-05 02:54 opened from N-0020
- 2026-10-05 02:55 questions answered: off by default
