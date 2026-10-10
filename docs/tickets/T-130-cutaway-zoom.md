---
id: T-130
title: A clear way to zoom in and out in Cutaway, alongside scrolling up and down the hole
status: open
size: S
area: render3d, godot
touches: [src/render3d/stage3d.ts, godot/src/CameraRig.cs, src/ui/Help.tsx]
blocked_by: []
notes: [N-0067]
created: 2026-10-10 01:41
---
## Problem
"I like the scroll action moving up and down a hole in cutaway view, but we should also figure out a way to zoom in and out in that view."

## Context
The web's cutaway (`onWheel` in `src/render3d/stage3d.ts`) already zooms on Ctrl+wheel, which is also what a trackpad pinch sends; Shift+wheel turns, a plain wheel moves up and down. Godot (`godot/src/CameraRig.cs`) zooms the cutaway on a pinch. So zoom exists but is hidden from mouse users and isn't in the controls help. Touch already pinch-zooms (DECISIONS: gestures).

## Approach
Keep the plain wheel for up and down. Add zoom that a mouse user can find: Ctrl/Cmd+wheel (already there), plus + and − keys, plus small on-screen zoom buttons in Cutaway; list them in Help. Same in Godot. Done: with only a mouse wheel and keyboard, you can zoom the cutaway in and out, and Help says how.

## Open questions
- [ ] Which zoom controls besides the pinch and Ctrl+wheel that already work: + and − keys, on-screen zoom buttons, or both?

## Docs to update
GUIDE.md: camera controls.

## History
- 2026-10-10 01:41 opened from N-0067
