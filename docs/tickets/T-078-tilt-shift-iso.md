---
id: T-078
title: A tilt-shift (miniature) look for the Free view camera
status: open
size: M
area: render3d, godot
touches: [src/render3d/stage3d.ts, src/ui/settings.ts, src/ui/SettingsView.tsx, godot/src/]
blocked_by: [T-088]
notes: [N-0042]
created: 2026-10-06 19:31
---
## Problem
"Is it possible to apply a tilt shift photography perspective to the cameras in iso view?"

## Context
Yes: a tilt-shift look is a depth-of-field blur that keeps a band in focus and blurs above and below it (or by distance from the focus point), often with a touch more saturation, making the colony look like a miniature, which suits the cozy art. T-052 renamed Iso to "Free view" (its id is still `iso`). The web renders with Three.js in `src/render3d/stage3d.ts` (check for an existing post-processing chain); Godot has depth of field on `CameraAttributesPractical`.

## Approach
A post-process pass in the Free view camera: focus on what the camera orbits (the floor in view), blur growing with distance from it (depth-based, so it's right as you tilt), cheap enough for phones (half-resolution blur, off on the lowest graphics level). A **slider** in Settings for its intensity, from off to strong (Bryon, Oct 7); it defaults to a gentle setting. Done: the colony reads as a miniature, the focused floor stays crisp, frame rate holds; Godot matches.

## Docs to update
ART.md: the camera look. GUIDE.md: Settings.

## Open questions
- [x] On by default (proposed: yes, gently), or off until turned on?
- [x] Strength: subtle (proposed), or the strong, obvious miniature look?

## History
- 2026-10-06 19:31 opened from N-0042
- 2026-10-07 18:43 questions answered
- 2026-10-07 18:58 waits on T-088 (settings layout)
- 2026-10-09 00:04 building on t-078-tilt-shift-iso
