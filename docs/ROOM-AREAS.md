# Room areas: why PR #95 didn't land, and statement 5 (draft)

*Draft for discussion, Nov 19, 2026. Not a decision yet.*

## 1. What PR #95 was fixing

On the 9-9-18 grid a slot's area depends on its ring: about 105, 175 and 122 m² on rings 1–3 (96, 161 and 112 m² of usable floor once walls and corridors are taken off). A room keeps the same slot count on every ring, so the same room is 1.67× larger on ring 2 than on ring 1. Its furniture doesn't grow to match, so the room looks empty.

## 2. Why PR #95 didn't work

It swapped the slot grid for free angles (1,440 notches a turn), with S/M/L fixed at 100/200/400 m² and a ±15% leeway. Measured against the layout goals (statements 1–2):

1. **It gave up the grid, and with it the 4-way crossings.** An S room spans 153, 92 or 65 notches on rings 1–3. Those spans share no common boundaries, so room ends stopped lining up between rings. Snapping (to neighbours, then to room ends on nearby rings, then a 10° grid) tried to rebuild the alignment one placement at a time. Alignment went from free to something the player has to work at.
2. **It created slivers, then a tool to clean them up.** Fixed areas rarely divide a ring evenly. The leeway, fill rooms that stretch from 50% to 300%, and double-click-to-fill all exist to close gaps the old grid never made. That cleanup is tedium, and it's charged to the player (axiom 0).
3. **Each room took more steps to build.** Before: click to place. After: click to propose, maybe drag handles, maybe toggle snap, then click again or press Enter. Small per room, but layout is the game's most repeated action, so it adds up.
4. **It was harder to read.** Edges get cut wherever any room ends, corridors split into pieces, and T-junctions replace crossings.
5. **The payoff was cosmetic.** By design, a room does the same thing at 88 m² as at 115 m². Every cost above bought a visual fix only.
6. **It didn't fix the emptiness either.** No room set its own area: every S room stayed at 100 m², every M at 200. Measured (see the table): a heater covers 8% of its floor at about 100 m², a kitchen 6% at about 200, the bunk dorm 16% at about 200. PR #95 evened out the ring differences, but most of the emptiness comes from the size classes being too big for many rooms. It paid every cost and kept most of the problem.

**In short:** PR #95 treated "same size on every ring" as the goal. The real goal was "each room near its own right size". It traded away the grid's structural wins for the first goal, and the second stayed out of reach.

## 3. Statement 5: what the numbers say

**Method.** Each room's ideal area is an informed estimate from what it does and the furniture it shows. It is checked against its fitted furniture: how many m² it would need for that furniture to cover a comfortable 30% of the floor. The fitter stops placing furniture at 35%. Each ring then gets the whole number of slots, from 1 to 4, closest to the ideal on a log scale. The percentage shows how much bigger (+) or smaller (−) than ideal the room then ends up.

### Worked examples

- **Galley, serves 25.** 4 dining tables (2.4 × 1.95 m with chairs) seat 24–32. Each needs about 1.2 m of aisle around it: about 11 m² each, 45 m² in all. A cook's line along one wall (stove, two prep counters, fridge, shelving, a 5 m serving counter) is about 11 m long and 2 m deep with its working aisle, plus a queue: about 30 m². **About 75 m².** That's a fair fit on ring 1 (96), but more than double on ring 2 (161).
- **Bunk dorm, sleeps 16.** 8 bunks (2 × 1 m) with footlockers, at the template's 2.5 m spacing and about 3.2 m deep including the aisle: about 64 m². Lockers, a table and stools, and an entry: about 30 m². **About 95 m².** Today it's an M, 193–321 m²: the empty room in the screenshot. *As built:* one slot in #549, then back to two (about 210 m²) in #555, at Bryon's call: eight bunks with privacy screens rather than packed in.
- **Restroom.** 6 toilet stalls in a row (about 7 × 3 m with the aisle), 3 showers, 2 sinks, 3 washing machines, a bench. **About 45 m².** A slot is 2–3.5× that on every ring.
- **Clinic.** 4 beds behind partitions (about 36 m²), a scanner with clearance (about 17 m²), a desk and waiting area (about 12 m²). **About 70 m².**
- **Heater.** A 2.7 × 2.5 m furnace with 1 m of service space round it, plus a duct riser. **About 25 m²**, a quarter of the smallest slot.
- **Kitchen, 4 cooks.** The template shows 2 stoves, 2 prep counters, 2 fridges, a dishwasher and 2 stock kettles: about 12 m² of equipment, which fits in about 45 m². A production kitchen for 4 cooks is more like 120 m². **This is a template problem, not a room-size problem:** the room has the right job but too little furniture.

### Findings

1. **Statement 5 works for rooms of a slot or more.** For about 40 of 61 rooms, the nearest slot count lands within about ±30% of ideal on every ring. Ring 2 is where the mapping changes most: many M rooms become 1 slot there.
2. **About a quarter of rooms want less than one slot.** 17 of 61 want under 75% of a ring-1 slot: heater, radiator, ventilation hub, gas tank, restroom, storeroom, waste storage, site office, the stairs and elevators, and others. Statement 5 can't shrink a room below one slot, so these stay 2–15× too big, worst on ring 2. **This is the biggest gap left in the plan.**
3. **3-slot rooms fit the grid.** Several rooms land on 3 slots (park, water recycler, CO2 scrubber, farm on ring 2), and 3 divides both 9 and 18. Allowing 3 alongside 1, 2 and 4 costs no crossings.
4. **Some templates are thin.** Furniture implies far less area than the job does for the kitchen (40 vs 120 m²), hospital (123 vs 600), gym (53 vs 200), machine shop (46 vs 150), brickworks, maintenance and plazas. Enrich these templates rather than shrink the rooms.
5. **Rings gain a character.** A room taking fewer slots on ring 2 (an M room as 1 × 161 m² rather than 2 × 96 m² on ring 1) costs less digging and frees slots. Choosing a ring becomes a real decision. That's probably good, but it's a balance question to watch.

### Sub-slot rooms: busier templates (Bryon, Nov 19)

A room never takes less than one slot. Rooms whose job is smaller than a slot get templates that fill the slot believably instead. We considered split slots (half-slots along the arc) and plant rooms (one utility room holding modules) and set both aside.

**How a template should fill.** Each template has two parts:
- **A core:** the furniture that does the job (the furnace, the toilet stalls, the stair). Same on every ring.
- **Fillers:** furniture that belongs there and can grow (pipe racks, parts shelving, workbenches, spare tanks, lockers, planters). Fillers repeat with a high or no `max`, so the fitter keeps adding them until the room reaches the crowding cap.

With that split, one template covers a 96 m² ring-1 slot and a 161 m² ring-2 slot alike. Today most repeats stop at a fixed `max`, so furniture stays the same size as the room grows. That's why every room's coverage drops on ring 2.

**Target:** about 25% of the floor covered on every ring. That's under the fitter's 35% cap and above the 10–15% where rooms start to read as empty. Open rooms (plazas, the park) may sit lower, around 15–20%, since openness is the point, but they need more on the floor (trees, planters, benches). Wall hangings don't count toward coverage, but they add busyness too.

### The template pass

The shortfall is how many m² of standing furniture each room would need added to reach 25% under today's slot counts. Under statement 5, many M rooms become 1 slot on rings 2 and 3, which cuts their shortfall a lot.

| Room | Covered now (ring 1 / 2 / 3) | Shortfall m² (ring 1 / 2 / 3) | Fillers that fit the job |
| --- | --- | --- | --- |
| Heater | 8 / 5 / 7% | 17 / 33 / 21 | fuel or coolant tanks, pipe manifolds on stands, a pump skid, a control desk, a tool cart |
| Radiator | 2 / 1 / 2% | 22 / 38 / 26 | radiator panels in rows, a heat-exchanger stack, pipe runs on the floor |
| Ventilation hub | 5 / 3 / 5% | 19 / 35 / 23 | fan units in a row, filter racks, duct trunks, a spare-filter shelf |
| Gas tank | 11 / 6 / 9% | 14 / 30 / 18 | more cylinders in racks, a compressor, gauge panels |
| Restroom | 17 / 12 / 15% | 7 / 22 / 11 | more stalls and showers (repeat to fill), lockers, benches, a towel rack |
| Storeroom | 10 / 10 / 10% | 14 / 25 / 17 | shelving rows to fill, crates, a ladder trolley |
| Waste storage | 11 / 8 / 11% | 14 / 28 / 16 | bins in rows, a compactor, bale stacks |
| Site office | 9 / 5 / 8% | 16 / 32 / 20 | plan tables, a kit rack (helmets, suits), material samples, a whiteboard wall |
| Stairwell | 20 / 12 / 17% | 4 / 21 / 9 | landing benches, a plant, a notice board, an emergency suit locker |
| Spiral stair | 13 / 8 / 11% | 11 / 27 / 15 | as the stairwell |
| Elevator | 8 / 5 / 7% | 17 / 33 / 21 | a waiting lobby: benches, plants, a directory screen, a cargo trolley bay |
| Tiny plaza | 9 / 5 / 7% | 16 / 32 / 20 | planters, benches, a kiosk (open-room target) |
| Battery bank | 14 / 10 / 14% | 10 / 24 / 13 | battery racks repeating to fill, an inverter cabinet |
| Cleaning service | 4 / 2 / 3% | 41 / 73 / 49 | cart bays, chemical shelving, a laundry line, lockers |
| Maintenance | 4 / 3 / 4% | 41 / 72 / 48 | workbenches, parts shelving, a lathe, a tool wall, a spares cage |
| Crypt | 5 / 4 / 5% | 38 / 67 / 46 | columbarium walls as repeating rows, benches, candles, planters |
| Kitchen | 6 / 4 / 5% | 36 / 68 / 44 | more cooking lines, a walk-in cold store, a pot wash, dry-goods shelving |
| Hospital | 10 / 6 / 8% | 60 / 124 / 76 | ward beds repeating, a theatre table, a nurses' station, supply carts |
| Gym | 8 / 5 / 7% | 32 / 64 / 40 | machine rows, weight racks, mats, a centrifuge ring |
| Machine shop | 7 / 5 / 7% | 34 / 66 / 42 | machine tools in rows, workbenches, material racks |
| Brickworks | 9 / 6 / 9% | 30 / 61 / 37 | brick pallets, drying racks, a second press |
| Glassworks | 7 / 5 / 7% | 34 / 65 / 41 | annealing racks, cullet bins, sheet stacks |
| Small plaza | 11 / 6 / 9% | 27 / 60 / 36 | planters, trees, benches, a fountain (open-room target) |
| Plaza | 11 / 7 / 10% | 53 / 118 / 69 | as the small plaza, plus market stalls (open-room target) |
| Park | 11 / 7 / 10% | 26 / 58 / 34 | trees and planters repeating, paths, benches (open-room target) |

**Order:** statement 5 first, since it changes which slot counts each template has to fill. Then the core-and-fillers pass, worst rooms first: the utilities and services, at 2–5% coverage. Done in the furnishing tool (`?furnish`); new furniture models go through `scripts/furniture.mjs`.

## 4. Full table

Columns: the room; its size class today (slots); the ideal area estimate (m²); the area its furniture implies at 30% coverage (m²); the reasoning; then, for rings 1, 2 and 3, the slot count statement 5 picks and how much bigger (+) or smaller (−) than ideal the room ends up.

| Room | Today | Ideal m² | Furniture says m² | Why | Ring 1 | Ring 2 | Ring 3 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Bunk dorm | M (2) | 95 | 105 | 16 in bunks, ~6 m² each like barracks | 1 (+1%) | 1 (+69%) | 1 (+18%) |
| Studio | S (1) | 90 | 74 | 5 people, compact flats ~18 m² each | 1 (+7%) | 1 (+78%) | 1 (+25%) |
| Apartment | M (2) | 170 | 142 | 10 people, ~17 m² each | 2 (+13%) | 1 (-6%) | 2 (+32%) |
| Flat | S (1) | 75 | 75 | 4 people, small two-bed | 1 (+28%) | 1 (+114%) | 1 (+50%) |
| Family apartment | M (2) | 150 | 122 | 8 people, family flat | 2 (+28%) | 1 (+7%) | 1 (-25%) |
| Suite | S (1) | 80 | 64 | 2 people, roomy | 1 (+20%) | 1 (+101%) | 1 (+41%) |
| Residence | M (2) | 180 | 120 | 4 people plus staff, a luxury home | 2 (+7%) | 1 (-11%) | 2 (+25%) |
| Galley | S (1) | 75 | 65 | small kitchen plus ~25 seats | 1 (+28%) | 1 (+114%) | 1 (+50%) |
| Kitchen | M (2) | 120 | 40 | production kitchen, 4 cooks | 1 (-20%) | 1 (+34%) | 1 (-6%) |
| Canteen | M (2) | 150 | 73 | dining hall, ~100 seats | 2 (+28%) | 1 (+7%) | 1 (-25%) |
| Farm | L (4) | 400 | 358 | output-driven; keep L | 4 (-4%) | 3 (+20%) | 4 (+12%) |
| Water tank | S (1) | 60 | 78 | one big tank and pipework | 1 (+61%) | 1 (+168%) | 1 (+87%) |
| Water recycler | L (4) | 250 | 213 | treatment plant, 3 staff | 3 (+16%) | 2 (+28%) | 2 (-10%) |
| Tailings reclaimer | M (2) | 150 | 97 | process plant | 2 (+28%) | 1 (+7%) | 1 (-25%) |
| Restroom | S (1) | 45 | 55 | public toilet block | 1 (+114%) | 1 (+257%) | 1 (+150%) |
| CO2 scrubber | L (4) | 250 | 210 | air plant, 3 staff | 3 (+16%) | 2 (+28%) | 2 (-10%) |
| Electrolyzer | M (2) | 100 | 85 | cell stacks and a desk | 1 (-4%) | 1 (+61%) | 1 (+12%) |
| Gas tank | S (1) | 50 | 34 | a pair of tanks | 1 (+93%) | 1 (+221%) | 1 (+125%) |
| Heater | S (1) | 25 | 25 | boiler cupboard | 1 (+285%) | 1 (+542%) | 1 (+350%) |
| Heating plant | M (2) | 80 | 53 | boiler room | 1 (+20%) | 1 (+101%) | 1 (+41%) |
| Radiator | S (1) | 15 | 8 | a wall unit | 1 (+542%) | 1 (+971%) | 1 (+649%) |
| Ventilation hub | S (1) | 40 | 17 | fans and ducts | 1 (+141%) | 1 (+301%) | 1 (+181%) |
| Clinic | S (1) | 70 | 66 | four beds, a scanner, a desk | 1 (+38%) | 1 (+129%) | 1 (+61%) |
| Hospital | L (4) | 600 | 123 | wards, theatre, 10 staff | 4 (-36%) | 4 (+7%) | 4 (-25%) |
| Gym | M (2) | 200 | 53 | community gym | 2 (-4%) | 1 (-20%) | 2 (+12%) |
| Admin office | M (2) | 80 | 82 | public counter and 2 desks | 1 (+20%) | 1 (+101%) | 1 (+41%) |
| Battery bank | S (1) | 60 | 46 | racks with aisles | 1 (+61%) | 1 (+168%) | 1 (+87%) |
| Deep well pump | M (2) | 100 | 83 | pump hall over a well | 1 (-4%) | 1 (+61%) | 1 (+12%) |
| Smelter | L (4) | 400 | 227 | furnaces; industrial | 4 (-4%) | 3 (+20%) | 4 (+12%) |
| Machine shop | M (2) | 150 | 46 | 4 machinists | 2 (+28%) | 1 (+7%) | 1 (-25%) |
| Silicon refinery | L (4) | 400 | 196 | process line | 4 (-4%) | 3 (+20%) | 4 (+12%) |
| Electronics fab | M (2) | 150 | 69 | clean room, 4 staff | 2 (+28%) | 1 (+7%) | 1 (-25%) |
| Staging bay | L (4) | 400 | 194 | loading floor | 4 (-4%) | 3 (+20%) | 4 (+12%) |
| School | M (2) | 200 | 79 | three classrooms | 2 (-4%) | 1 (-20%) | 2 (+12%) |
| Elder care | M (2) | 200 | 97 | day room and beds | 2 (-4%) | 1 (-20%) | 2 (+12%) |
| Composter | M (2) | 120 | 81 | bins and turning space | 1 (-20%) | 1 (+34%) | 1 (-6%) |
| Crypt | M (2) | 80 | 33 | columbarium | 1 (+20%) | 1 (+101%) | 1 (+41%) |
| Concrete plant | M (2) | 200 | 100 | mixer, silos | 2 (-4%) | 1 (-20%) | 2 (+12%) |
| Brickworks | M (2) | 200 | 60 | press and kiln | 2 (-4%) | 1 (-20%) | 2 (+12%) |
| Glassworks | M (2) | 150 | 47 | furnace and annealing | 2 (+28%) | 1 (+7%) | 1 (-25%) |
| Recycling center | L (4) | 300 | 158 | sorting floor | 3 (-4%) | 2 (+7%) | 3 (+12%) |
| Tiny plaza | S (1) | 60 | 28 | a nook with benches | 1 (+61%) | 1 (+168%) | 1 (+87%) |
| Small plaza | M (2) | 150 | 69 | a square | 2 (+28%) | 1 (+7%) | 1 (-25%) |
| Plaza | L (4) | 400 | 143 | a town square | 4 (-4%) | 3 (+20%) | 4 (+12%) |
| Park | M (2) | 300 | 73 | lawn and trees | 3 (-4%) | 2 (+7%) | 3 (+12%) |
| Lounge | S (1) | 80 | 51 | a bar or café | 1 (+20%) | 1 (+101%) | 1 (+41%) |
| Entrance | S (1) | 80 | 34 | airlock and lobby | 1 (+20%) | 1 (+101%) | 1 (+41%) |
| Stairwell | S (1) | 30 | 65 | one flight and landings | 1 (+221%) | 1 (+435%) | 1 (+275%) |
| Spiral stair | S (1) | 15 | 43 | a spiral | 1 (+542%) | 1 (+971%) | 1 (+649%) |
| Elevator | S (1) | 10 | 24 | a car and lobby | 1 (+863%) | 1 (+1506%) | 1 (+1024%) |
| Cargo elevator | S (1) | 30 | – | a freight car | 1 (+221%) | 1 (+435%) | 1 (+275%) |
| Site office | S (1) | 40 | 28 | a site hut | 1 (+141%) | 1 (+301%) | 1 (+181%) |
| Maintenance | M (2) | 80 | 23 | workbench and spares | 1 (+20%) | 1 (+101%) | 1 (+41%) |
| Cleaning service | M (2) | 60 | 25 | carts and a store | 1 (+61%) | 1 (+168%) | 1 (+87%) |
| Construction office | M (2) | 100 | 66 | 4 desks and plans | 1 (-4%) | 1 (+61%) | 1 (+12%) |
| Construction yard | L (4) | 500 | 230 | machines and stockpile | 4 (-23%) | 3 (-4%) | 4 (-10%) |
| Excavator bay | M (2) | 250 | 74 | vehicle garage | 3 (+16%) | 2 (+28%) | 2 (-10%) |
| Storeroom | S (1) | 40 | 32 | shelving | 1 (+141%) | 1 (+301%) | 1 (+181%) |
| Warehouse | M (2) | 200 | 103 | racks with a forklift aisle | 2 (-4%) | 1 (-20%) | 2 (+12%) |
| Depot | L (4) | 400 | 208 | bulk store | 4 (-4%) | 3 (+20%) | 4 (+12%) |
| Waste storage | S (1) | 50 | 34 | bins | 1 (+93%) | 1 (+221%) | 1 (+125%) |

## 5. Another lever: ring depth

Every ring is 10 m deep today, so a ring's area grows with its radius, and pairing slot counts (9, 9, 18) leaves slot areas uneven. If each ring's depth is chosen instead, so that every slot is the same area as a ring-1 slot (about 105 m²), slot counts can stay in clean doubling steps.

| Layout | Ring 1 | Ring 2 | Ring 3 | Walls lining up across rings | Slots | Outer radius |
| --- | --- | --- | --- | --- | --- | --- |
| **A. Today:** 9-9-18, all 10 m | 105 m², 10.5 × 10 | **175 m²**, 17.5 × 10 | 122 m², 12.2 × 10 | 18 | 36 | 40 m |
| **B.** 9-9-18, equal area | 105 m², 10 deep | 105 m², **6.5 deep**, 16.2 wide | 105 m², 9.6 deep | 18 | 36 | 36 m |
| **C.** 9-18-18, equal area | 105 m², 10.5 × 10 | 105 m², 9.0 × 11.6 | 105 m², 12.5 × 8.4 | **27** | 45 | **40 m** |
| **D.** 9-18-36, equal area | 105 m² | 105 m² | 105 m², **6.9 × 15.3** | 27 | 63 | 47 m |

(width × depth at the slot's middle, in metres)

**C is the standout.** Ring 2 goes from 9 slots to 18, and rings 2 and 3 become 11.6 and 8.4 m deep.
- **Every slot is the same area.** Statement 3's simple rule, one footprint on every ring, comes back, and statement 5 isn't needed: each room's slot count is just the ring-1 column of the table above.
- **More walls line up, not fewer.** Ring 1 meets ring 2 at every other wall (9 points), and ring 2 meets ring 3 at every wall (18), so 27 lines in all against 18 today. That's more 4-way crossings.
- **Slots are close to square on every ring** (aspect 1.05, 1.3 and 1.5). Option B equalises area too, but turns ring 2 into a long, shallow strip (2.5 : 1).
- **The hole keeps its size.** Its outer wall stays at exactly 40 m: 45 slots × 105 m² is the same floor as today. It just becomes 45 rooms' worth instead of 36 uneven ones.
- **It extends to rings 4–6:** 36, 36 and 36 slots, 12.9, 10.3 and 8.9 m deep, all 105 m², aspect 1.0–1.6. (Rings 4–6 are still undecided.)

**What it costs:**
- **The slots no longer match in shape.** Ring 2's slots are a little narrow and deep, ring 3's a little wide and shallow. Templates are pinned to walls and stretch, so a dorm might get one bunk fewer on ring 2 and one more on ring 3. That's a much smaller difference than today's 1.67× in area.
- **Ring 2 holds smaller rooms.** A 1-slot room there drops from 175 m² to 105 m², and the old big ring-2 slot becomes 2 slots.
- **Old saves:** ring-2 rooms double their slot index and width (same angles, so same place). The ring-2/3 boundary moves out from 30 m to 31.6 m.
- **Code:** a ring's depth is a single constant today (`roomDepthM` / `RING_D`, about 70 uses in about 25 files). Most go through `ringRadii(hole, ring)` already, so the change is to store each ring's radii on the hole, as `ringSlots` already is, and read them everywhere. Godot gets its geometry through the bridge, apart from `Scenery.cs`. That's roughly an M–L ticket, a fraction of PR #95.
- **Rings lose their character.** Statement 5's finding 5 (a ring with cheaper rooms) goes away. That's simpler, and arguably fine.

### If C is chosen, the plan simplifies to

1. **Equal-area rings** at 9-18-18: per-ring depth from the formula, ring 2 at 18 slots, save migration.
2. **Re-pick each room's size** from its ideal area, using the ring-1 column of the table: the bunk dorm becomes S, the kitchen S, the park and water recycler 3 slots, and so on. Allow 3-slot rooms (3 divides 9 and 18).
3. **The template pass** (busier templates), now only against 96 m² of usable floor per slot, so the shortfalls are the ring-1 column above.
