---
id: T-158
title: Upgraded rooms swap in their own furniture in the 3D view
status: open
size: M
area: render3d
feature: F-017
touches: [data/layouts.json, data/furniture.json, src/view/, src/render3d/furniture3d.ts]
blocked_by: [T-156]
notes: [N-0075]
created: 2026-10-11 16:09
---
## Problem
"In most cases, performing a room upgrade changes the room visually": some furniture replaced with pieces only upgraded rooms get, or other decoration.

## Context
Read F-017 (`docs/tickets/F-017-room-upgrades.md`) first; it builds on F-003's Upgrade action (T-033). Furniture and layouts: `data/furniture.json`, `data/layouts.json`, FURNITURE.md, furnishing helpers in `src/view/`. Godot reuses scene building through the bridge, so it should follow; check it.

## Approach
Layouts can name pieces that appear (or replace others) when an upgrade is installed; the furnishing picks them by `room.upgrades`. Done: a test upgrade visibly changes its room, web and Godot.

## Docs to update
FURNITURE.md: upgrade pieces.

## History
- 2026-10-11 16:09 opened from F-017 (agreed)
