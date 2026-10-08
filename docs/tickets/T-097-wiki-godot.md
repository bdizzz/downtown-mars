---
id: T-097
title: The guide in Godot
status: open
size: L
area: godot, bridge
touches: [godot/src/, src/bridge/]
blocked_by: [T-093]
feature: F-010
notes: [N-0050]
created: 2026-10-08 02:14
---
## Problem
F-010 in the Godot viewer.

## Context
See F-010's Design and `PLAN-GODOT.md`. The bridge reuses web code where it can; the pages come from `src/view/wiki/` (T-092).

## Approach
The bridge serves pages (resolved, with link targets and locked state); Godot draws a Guide panel with RichTextLabel links, search, back and forward, opened from the menu and F1, plus the "?" links T-095 adds. Done: same pages and links as the web reader, checked with a test run.

## Docs to update
PLAN-GODOT.md: Status and next.

## History
- 2026-10-08 02:14 opened from F-010's breakdown
