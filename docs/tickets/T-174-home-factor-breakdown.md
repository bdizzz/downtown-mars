---
id: T-174
title: A home's panel breaks noise, comfort and wellbeing into their parts; rooms show who they bother
status: done
size: M
area: ui
feature: F-018
touches: [src/view/roomPanel.ts, src/view/roomCard.ts, src/ui/Inspector.tsx]
blocked_by: [T-171]
notes: [N-0095]
created: 2026-10-19 21:57
---
## Problem
The home panel shows only "Noise −1 · Comfort +0.5 · Wellbeing −2", not what makes them up.

## Context
Read F-018. `src/view/roomPanel.ts` (shared with Godot) already lists amenities by steps.

## Approach
Each factor expands into its parts ("Comfort +0.5 = view +1, no galley seat −1, worn −0.5, park +1"), naming the rooms behind neighbour effects. Rooms that bother others show "noise felt in 3 homes", "smell reaches 4 homes". Done: a noisy neighbour shows up by name on the home and the home count on the noisy room.

## History
- 2026-10-19 21:57 opened from F-018
- 2026-10-20 03:04 built on ccr-ae9918df-rbn2zw (with T-173–T-175)
