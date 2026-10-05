---
id: T-022
title: A corridor dead-ending on a room's long wall is a valid door spot
status: open
size: M
area: sim, render3d
touches: [src/view/doors.ts, src/sim/paths.ts, src/sim/edges.ts, src/render3d/rooms3d.ts, src/view/walk.ts, tests/]
blocked_by: []
notes: [N-0018]
created: 2026-10-05 02:42
---
## Problem
When a corridor runs perpendicular to a room's multi-segment wall and dead-ends against it (along that side, not at a corner), that's a valid place for a door. Doors should never go at "the absolute corner of a room (less than 1m from the corner)."

## Context
- Doors are chosen in `src/view/doors.ts`: one per floor, on the best wall: a gallery tube first, else the longest corridor along one of its walls, else a walk-through room (DECISIONS.md, "Doors on any wall"). A corridor that only *ends* at a wall (say a radial corridor between two ring-2 rooms, stopping at the inner wall of a wide ring-3 room) shares no edge with that room, so today it doesn't count.
- The sim's walking network (`src/sim/paths.ts`) joins a private room to the walkable pieces along its sides through its doors; it needs the same rule, so such a room is reachable (and amenities by walking distance see it).
- `DOOR = { width: 1.3, height: 2.7 }`; the doorway at a dead end sits centred on the corridor's end (corridors are narrower than a slot), so it lands on a slot boundary of the room's wall, which is fine as long as it's 1 m or more from the room's corner.
- The 3D view cuts the doorway (`rooms3d.ts`), furnishing keeps it clear (`src/view/furnish.ts`), first-person walking goes through it (`src/view/walk.ts`).

## Approach
Treat a corridor end meeting a room's wall (curved inner/outer face, away from the room's corners) as a candidate door, in both the door chooser and the path graph; enforce the 1 m corner clearance for every door. Tests: a room reached only by a dead-end corridor has a door and is reachable. Done: build a corridor straight into the middle of a wide room's wall and it gets a door there, in 3D and when walking.

## Docs to update
- DECISIONS.md ("Doors on any wall"), GUIDE.md: Corridors and doors.

## Open questions
- [x] A dead end ranks like the shortest corridor along a wall: a tube or a real stretch of corridor still wins, and the dead end is used only when it's the room's only way in. (Bryon, Oct 5)
- [x] Any wall, curved or side, as long as the door is 1 m or more from the corners. (Bryon, Oct 5)

## History
- 2026-10-05 02:42 opened from N-0018
- 2026-10-05 02:43 questions answered
