---
id: T-099
title: "Godot: panels hug their window edges, a floor picker only as tall as the floors, squarer build buttons"
status: open
size: M
area: godot, ui
touches: [godot/src/Main.cs, godot/src/Live.cs, godot/src/BuildMode.cs, godot/src/HudBar.cs]
blocked_by: []
notes: [N-0054]
created: 2026-10-09 01:58
---
## Problem
In Godot, "the different ui panels should hug their respective sides or corners of the window as it is resized." The floor picker container "should only be shown just as tall as needed to show the current number of floors, not more." And the buttons in places like the build menu should "feel more clickable and 'square-ish' so more can fit side by side."

## Context
Three related layout passes on the Godot viewer's UI. The floor picker lives around `godot/src/Live.cs` / `Main.cs`; the build menu in `BuildMode.cs`. The web's compact top bar (T-089) and pause-menu pass (T-088) set the recent look to match.

## Approach
- Anchor each panel to its side or corner (Godot anchors/presets) so it follows the window on resize; check at a few window sizes.
- Size the floor picker to its content (number of floors dug), capped by the window height with scrolling beyond that.
- Build-menu buttons: closer to square tiles (icon above a short label, clear hover and pressed states), laid out in a flow/grid so more fit per row. Apply the same button style elsewhere it's used.
- Done: resize the window and every panel stays put on its edge; a 3-floor hole shows a 3-row picker; the build menu fits noticeably more buttons per row.

## Docs to update
PLAN-GODOT.md: notes as built.

## History
- 2026-10-09 01:58 opened from N-0054
