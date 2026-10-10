---
id: T-113
title: "Standard homes, cargo and recycling unlock from the move-out mission instead of at 100 people"
status: open
size: S
area: balance, data
touches: [data/config.json, data/missions.json, src/sim/costs.ts]
blocked_by: [T-111]
feature: F-011
notes: [N-0061]
created: 2026-10-10 00:40
---
## Problem
Standard homes, cargo and recycling become the move-out mission's reward ("we're really home now, there's no going back") rather than unlocking at 100 people.

## Context
Read F-011 first: its Design holds the decisions this task builds on.

## Approach
Let a mission reward unlock rooms; take standard homes, cargo and recycling off their population thresholds (`unlocks` in `data/config.json`; T-100 set standard homes to 100) and onto the move-out reward. Update the locked-room hint text (`src/sim/costs.ts`). Fix any bot in `tests/` that relied on the old unlocks.

## History
- 2026-10-10 00:40 opened from F-011 (agreed)
