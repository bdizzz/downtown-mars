---
id: T-082
title: Room hotkeys only work in build mode
status: open
size: S
area: ui, godot
touches: [src/ui/App.tsx, src/ui/Help.tsx, godot/src/Live.cs]
blocked_by: []
notes: [N-0047]
created: 2026-10-06 19:31
---
## Problem
"When not in build mode, none of the keyboard commands should bind to building a room. The only way to enable a hotkey for a specific room is to enter build mode."

## Context
At a glance both viewers already gate room keys on build mode: the web's `onKey` in `src/ui/App.tsx` returns before the room and tool keys unless `mode === "build"`, and Godot's `Live.cs` only calls `_build.PickByKey` when `_build.Active`. But Godot's **X** toggles Demolish outside build mode, and other single-letter keys there (L labels, O office, C charts) may collide with room letters in ways that look like building. Help may also list room keys as if they were global.

## Approach
Reproduce what Bryon saw, then make sure no build tool (rooms, corridor, demolish) can be picked by a key outside build mode in either viewer, and that Help lists room keys under Build. Done: outside build mode, pressing any room's letter never starts placing a room.

## Open questions
- [ ] Where did you see it: the web game or Godot, and which key?

## History
- 2026-10-06 19:31 opened from N-0047
