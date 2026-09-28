# Storage (Sep 27, 2026)

Decided (Bryon):
- **Storage rooms:** a set of them, each configured with the goods it stores (none by default), and each holding so many items in total, so it can fill up.
- **Capacity:** a hole's capacity for every good is the sum of the space allocated to it across the hole's storage rooms.
- **Rock corridors cost a little more,** to account for the digging.

## As built

- **What goes in storage:** the dry goods, food and materials (`data/storage.json`): rations, raw food, meals, soil, rock, ore, silica, brick, marscrete, metal, machinery, wafers, electronics. Water, air, waste and power keep their own storage (tanks, batteries and base capacity), as ROOMS.md and PATHWAYS.md describe. Dry goods' base capacity in `data/resources.json` is now 0.
- **Rooms**, following ROOMS.md's storage ladder, in a new Storage group with a crates glyph:

  | Room | Size | Holds | Staff | Cost | Work |
  | --- | --- | --- | --- | --- | --- |
  | Storeroom | S | 90 | 0 | rock 8, metal 2 | 5 h |
  | Warehouse | M | 200 (from the catalog) | 1 | rock 15, metal 5 | 10 h |
  | Depot | L | 440 (+10% per slot for L) | 2 | rock 30, metal 10, machinery 1 | 20 h |

  The depot also uses power 1 and has noise −1 r1.
- **Allocation:** each storage room shares its space among goods by allocation (`setAllocation`: units per good, totalling no more than it holds; none to start). A hole's capacity for a good is the sum of its built storage rooms' allocations. Rooms under construction don't count. What doesn't fit is lost as overflow, and Earth drops only unload what fits.
- **Landing pod:** 400 units, preset to hold the starting stock with some room: rations 120, meals 30, raw food 20, soil 50, rock 80, metal 60, brick 20, machinery 10, electronics 10. Ore, silica and the rest get nothing until the player sets space aside.
- **Inspector:** for any room with storage, "625 stored · 2330 of 2330 set aside", then a row per good with a tick box, the units (editable), and a fill bar showing that room's share of the hole's stock.
  - Ticking a good gives it the free space, or an even share of everything if none is free.
  - "Share evenly" splits the space among the goods chosen.
- **Resource bar:** a dry good turns amber when its storage is full and more is coming in, or when it has no storage at all. The tooltip says why.
- **Sandbox switch:** `storage.unlimited` lifts all limits (the unit tests use it; the storage tests and playthroughs don't).
- **Save version 14:** old saves' landing pod takes over what the hole could hold before (rock 400, metal 200 and so on, 2,330 units).
- **Rock corridors** cost 5 rock per 10 m (was 3).
- **Scripted players:** once a day, they give free storage to any good that's three-quarters full with more coming in, or that a seed kit being gathered needs. With nothing free, they build a warehouse out of the way (ring 3, then ring 2) and carve a corridor to it.
- **Playthroughs** (seed 42, with construction time and storage limits):
  - Founding comes at day 46.5.
  - At one hour the network has 109 against the solo player's 104; at 90 days 182 against 132, with 21 births.
  - Bradbury builds 7 warehouses and Gale 4.

Tests (`tests/storage.test.ts`): which goods need storage; the pod holds the starting stock; allocations add up; limits on allocation; overflow is lost; per-room fill; old saves.
