---
id: F-015
title: Build the rest of the room catalog
status: draft
plan:
notes: [N-0068]
created: 2026-10-10 01:41
---
## Goal
"We should make sure we've implemented all the rooms we talked about." Every room in `docs/ROOMS.md` should end up in the game.

## Design
`docs/ROOM-STATUS.md` (regenerated today by `node scripts/room-status.mjs`): 59 room types built; of the catalog's 92 rooms, 53 are built and **39 are described only**. Graded by what each needs first:
- **A, uses what exists (4):** excavator bay (a faster drill), plaza (a bigger small plaza), spiral stair (a stairwell with comfort), escalator (cosmetic until commutes exist).
- **B, one new resource, effect or unlock (5):** brewery (barley → beer), chemical plant (plastics, methane), geothermal plant (a 15-floor depth unlock), grand staircase (placement in plazas), mycelium vat (mycelium composite).
- **C, a new system (30), grouped by the system they wait on:**
  - Consumer goods and colonists' needs for them: textile mill, clothing, furniture, toy and appliance workshops (fiber now exists from T-036, so the textile mill's grade may be stale).
  - Goods and currency: shop, market hall, currency exchange.
  - Entertainment as a happiness factor: bar and lounge (also beer), theater (tall rooms), running track (a full-ring shape), experience venue.
  - Tourism: hotel, tour company, panoramic elevator, experience venue.
  - Safety: security outpost and headquarters.
  - Commutes and shaft transit: elevator upgrade, express and freight elevators, sky lobby.
  - H-size (8-slot, 2-floor) rooms: farm atrium, reactor, grand plaza.
  - One-offs: research lab (milestones it speeds up, so after F-005), office (the coordination penalty), cultured meat lab (food groups), reinforcement frame (cave-ins and rings 4–6, still open in DECISIONS), pipe mill (pipelines between holes), vehicle works (rovers as a made good).
- Some grades look stale (glass exists now, so "glass" is no longer a blocker for the grand staircase or panoramic elevator); the first task refreshes them.
- Each C group is a system in its own right, likely a feature of its own once we get there; this feature covers A and B and decides the order for C.

## Breakdown
Proposed; becomes tickets once this feature is agreed.
- Refresh ROOM-STATUS's grades against what's built now (fiber, glass, materials).
- Grade A rooms: excavator bay, plaza, spiral stair, escalator (one PR, maybe two).
- Brewery and beer.
- Geothermal plant and the depth unlock.
- Chemical plant (plastics, methane) and mycelium vat (mycelium composite).
- Grand staircase.
- Pick the order of the C systems; each becomes its own feature.

## Open questions
- [ ] Should every catalog room really go in, or is it worth trimming the catalog where a room doesn't earn its place (e.g. the escalator while commutes aren't modelled)?
- [ ] Which C systems matter most to you first: consumer goods, entertainment, tourism, safety, commutes, H-size rooms?

## History
- 2026-10-10 01:41 opened from N-0068
