---
id: T-103
title: "Web: a ghost ledge along the shaft wall on floors not yet excavated"
status: open
size: S
area: render3d
touches: [src/render3d/rooms3d.ts, src/render3d/cylinder.ts, src/render3d/stage3d.ts]
blocked_by: []
notes: [N-0057]
created: 2026-10-09 01:58
---
## Problem
"There is a ghost 'ledge' shape along the inner wall of the hole on floors that haven't been excavated yet. This might be related to the inner walkway that can be built, but these floors haven't had any construction yet so nothing should be visible."

## Context
Floor 1 starts with a gallery tube all the way round; deeper floors only get what the player builds (CLAUDE.md, M11). The ledge is likely gallery/walkway floor geometry (or a shaft-wall collar) drawn for every dug floor regardless of whether a tube exists there. Look at where galleries and the shaft wall are built in `src/render3d/`.

## Approach
Draw walkway/ledge geometry only where a gallery segment is built (or under construction). Done: a freshly dug floor with nothing built shows bare shaft wall.

## History
- 2026-10-09 01:58 opened from N-0057
