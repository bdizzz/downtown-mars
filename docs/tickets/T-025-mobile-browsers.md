---
id: T-025
title: Work on mobile browsers (viewport, touch gestures and controls)
status: done
size: L
area: ui, render3d
touches: [index.html, src/ui/styles.css, src/render3d/stage3d.ts, src/render2d/stage.ts, src/render2d/plan.ts, src/ui/App.tsx, src/ui/Dock.tsx, src/ui/BuildPalette.tsx, src/ui/FloorPicker.tsx]
blocked_by: []
notes: [N-0021]
created: 2026-10-05 23:55
---
## Problem
"We should care a little about loading the web version on mobile browsers": getting the viewport right, gestures and controls, and so on.

## Context
- `index.html` has a basic viewport meta (`width=device-width, initial-scale=1.0`), but nothing stops the page itself from zooming or scrolling under a gesture (no `touch-action`, no `maximum-scale`/`viewport-fit`, no handling of the mobile address bar's changing height, e.g. `100dvh`).
- Input is mouse-and-trackpad: the 3D view listens for `pointerdown` and `wheel` (`src/render3d/stage3d.ts` around line 1378); "pinch" today means a trackpad's ctrl+wheel (2D `src/render2d/stage.ts` line ~978, the Globe, the Help and StatusBar text). Real two-finger touch (pinch-zoom, two-finger rotate or pan) isn't handled.
- Much of the UI leans on hover (floor preview, tooltips, build hover ghosts, corridor proposals) and keyboard shortcuts (B for Build, WASD pan in Iso, F1…), neither of which exist on a phone.
- The CSS has almost no narrow-screen rules (one `@media (max-width: 560px)` in Help).
- The furnishing tool and Godot are out of scope.

## Approach
A first pass, honest about "a little": (1) viewport and page: no page zoom/scroll under gestures, safe areas, full-height canvas; (2) touch in 3D, plan and 2D: one finger orbits or pans, two fingers pinch to zoom and twist to turn, tap picks, long-press for what hover shows; (3) building by tap: tap to place a ghost, tap again (or a Confirm button) to build; (4) a narrow layout for the HUD, dock and panels. Could split into those four PRs if it grows. Done: on a phone and a tablet you can start a game, move the camera, build rooms and corridors, and read the panels.

## Docs to update
- GUIDE.md: Controls (touch), README.md (mobile support), DECISIONS.md (what mobile gets).

## Open questions
- [x] Tablets in landscape fully playable; phones playable but cramped (portrait and landscape), with the 3D view as the main one. (Bryon, Oct 5)
- [x] One finger orbits in Cutaway and Iso and pans in Top and Plan; two fingers always pinch-zoom and pan. (Bryon, Oct 5)

## History
- 2026-10-05 23:55 opened from N-0021
- 2026-10-05 23:57 questions answered
- 2026-10-06 01:26 building on t-025-mobile-browsers
- 2026-10-06 01:35 built
