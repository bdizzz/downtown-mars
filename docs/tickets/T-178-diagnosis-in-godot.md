---
id: T-178
title: The "Why?" panel, home breakdown, visits and tips in Godot
status: open
size: M
area: godot, bridge
touches: [godot/src/, src/bridge/]
blocked_by: [T-173, T-174, T-176, T-177]
feature: F-018
notes: [N-0095]
created: 2026-10-19 21:57
---
## Problem
The Godot viewer should diagnose the same way the web game does.

## Context
Read F-018 and PLAN-GODOT.md. The HUD cards come free through `hudItems.ts`; reuse the shared `src/view/` text for the rest.

## Approach
Port the "Why?" panel with Show me, the home breakdown, the new visits and the tip cards. Done: the same hole reads the same causes in both.

## History
- 2026-10-19 21:57 opened from F-018
