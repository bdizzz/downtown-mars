---
id: T-052
title: Drop the Shaft and Top cameras and X-ray; rename Iso to Free view
status: open
size: M
area: render3d, ui
touches: [src/view/cameras.ts, src/render3d/stage3d.ts, src/ui/Dock.tsx, src/ui/settings.ts, src/ui/SettingsView.tsx, src/render3d/look.ts, godot/src/CameraRig.cs, godot/src/ViewSettings.cs, godot/src/]
blocked_by: []
notes: [N-0023, N-0024]
created: 2026-10-06 00:48
---
## Problem
Deprecate the **shaft view**, the **3D top view** and **X-ray mode** (N-0023), and rename the **Iso** view to **"Free view"** (N-0024).

## Context
- Cameras are listed in `src/view/cameras.ts` (`Camera = "iso" | "shaft" | "cutaway" | "top" | "walk"`, with `View3d.xray`); `src/render3d/stage3d.ts` has a branch per mode (`view.mode === "shaft"` around lines 531, 568, 724, 1316, 1334, 1465; Top's `TOP` constants), the X-ray fade, and the headlamp for the shaft view. The Dock's X-ray button is `src/ui/Dock.tsx` (~line 125). Tilt-shift is "Iso only" (`look.ts`, the settings' "Miniature blur" hint).
- Saved settings (`src/ui/settings.ts`) may hold `camera: "shaft"` or `"top"` and `xray: true`; they need a fallback.
- Godot: `Overview { Iso, Cutaway, Top }` in `godot/src/CameraRig.cs`, `ViewSettings.Camera`, the `--view=iso|cutaway|top` test flag (PLAN-GODOT.md, "Testing the viewer"), and Godot's own camera buttons.
- Not the **2D plan view** (`render2d/plan.ts`), which is a different "from above" view and stays.
- Docs mention them: DECISIONS.md ("Cutaway, Top, Iso and first person, X-ray and walls down"; "new games open in 3D Iso"), GUIDE.md (View, X-ray), README, PLAN-GODOT.md, and tickets T-002 and T-051 say "Iso".
- F-004's T-043 (the 3D view on angles) also works in `stage3d.ts`; build this first or rebase around it.

## Approach
Remove the Shaft and Top cameras and X-ray from the web and Godot (code, buttons, keys, settings), leaving **Free view**, Cutaway and First person. Rename Iso's label to "Free view" everywhere the player sees it; keep the internal id `iso` (and `--view=iso`, plus `--view=free` as an alias) to avoid churn. Old settings with a removed camera fall back to Free view, and `xray` is dropped. Done: the camera list reads Free view · Cutaway · First person in both engines, nothing references the removed modes, and `npm test` passes.

## Docs to update
- DECISIONS.md (3D view cameras; a Reversals line for Shaft, Top and X-ray), GUIDE.md (View), README.md, PLAN-GODOT.md (flags), ART.md if it mentions Iso.

## Open questions
- [ ] Remove the code outright, or just hide the cameras behind a dev flag? Proposed: remove outright (git keeps it); less to maintain while F-004 reworks the 3D view.

## History
- 2026-10-06 00:48 opened from N-0023, N-0024
