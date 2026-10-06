# Resource pathways

Each pathway follows one resource family from its source to the rooms that use it. In the original design doc each section had a diagram; here each diagram is written out as a text flow.

**As built (Sep 30, 2026):** each section ends with what's in the game today. In short:

| Pathway | In the game |
| --- | --- |
| Water | Complete loop: deep well pump, tanks, recycler, restrooms, composter |
| Air | Complete: life support and farms |
| Food | Farms (crops) → galley, or kitchen plus canteen → colonists; Earth rations fill gaps. No cultured meat |
| Construction materials | Rock from every dig; concrete plant (marscrete); brickworks (rock to brick); recycling center |
| Metals and machinery | Smelter (ore sites) and machine shop |
| Silicon and electronics | Silicon refinery (silica sites) and electronics fab |
| Plastics, consumer goods, beer | Not yet |
| Waste | Organic and black water to soil (composter); gray water recycled; solid waste to metal and brick (recycling center); waste storage |
| Upkeep (new) | Maintenance uses machinery; cleaning services turn clean water into gray water |

## Water

**Flow:** a closed loop (F-001). Clean water (one shared pool, like power) → colonists (2 a day), farms, galleys and kitchens, clinics, gyms, parks, industry → **gray water**, one for one, as it's used → water recycler (about 97% back to clean, the rest as sludge soil) → clean water. Two leaks: **life support** splits water into oxygen for good, and some **industry** sends part of its water to **tailings**. Wells bring in gray water (brine); drops and trade top up the rest.

- **Made by:** water recycler (from gray water); deep well pump (gray water, at aquifer or ice sites); digging through ice; imports.
- **Processed by:** water recycler (gray to clean, plus soil), life support (splits clean water into oxygen).
- **Used by:** colonists (2 a day), farms, kitchens, life support, clinics, hospitals, bars, hotels, gyms and parks, brickworks, concrete plant, chemical plant, mycelium vat, silicon refinery, electronics fab, geothermal plant and reactor.
- **Tailings:** the silicon refinery, concrete plant and electronics fab send half their water to tailings, the brickworks a quarter. They can only be stored for now; with nowhere to keep them they're lost (the tailings reclaimer, T-007, turns them back into gray).
- **Storage:** each tank holds one kind (clean, gray or tailings), chosen by the player. When gray water has nowhere to go, the rooms that use water stall.
- **Lost to:** life support, tailings, the recycler's few percent, and overflow, all in the water ledger.

**As built (T-005):** the loop above, with a room's split in `rooms.json` (`returnsWater`, default `economy.waterReturns` in `config.json`: all gray). The recycler runs before water users each tick, so they drain into the room it frees. The pod holds 250 gray water to ride out the first days. The Flows panel shows each user's clean water out and gray water back, and says how much gray water is overflowing. Restrooms still give sanitation but no longer handle water (T-006 makes them an amenity).

## Air

**Flow:** clean water + power → life support (water to O2); farms and algae (CO2 to O2) → oxygen → colonists (breathe 1 a day) → CO2 → back to farms, and to the chemical plant (CO2 to plastics and fuel). Plants and chemistry turn exhaled CO2 back into value.

- **Oxygen made by:** life support, farms (especially algae).
- **CO2 made by:** colonists and some industry.
- **CO2 used by:** farms, life support scrubbers, chemical plant.
- **Air quality:** ventilation hubs raise it; smelters, brickworks, concrete and chemical plants lower it.

**As built:** life support (30 O2 a day) and farms (2 O2, using CO2). Life support scrubs CO2 above a small reserve that farms draw on. Air quality is a neighbor effect: a baseline by ring (0, 0, −1, then −1.5, −2, −2.5), ventilation hubs +2 r2, parks +1 r2, smelters −1 r2, brickworks and concrete plants −1 r1; at home it adds to health. No algae or chemical plant yet.

## Food

**Flow:** water, soil, CO2 and power → farms (12+ crops); organic waste → mushroom crops (grow in the dark); soy or algae feedstock → cultured meat lab → raw food (three food groups) → kitchen (or galley) → cooked food → canteens, bars, hotels → colonists (want variety).

- **Grown by:** farms (crops including mushrooms, which are a crop choice rather than a separate room) and the cultured meat lab.
- **Processed by:** kitchens and galleys (raw to cooked).
- **Served by:** canteens, galleys, bars, hotels.
- **Eaten by:** colonists (1 a day) and tourists. Kitchen scraps return to composters, mycelium vats and mushroom crops.

**As built:** farms (crop chosen per farm, named after it) → raw food → galley → meals. The galley cooks Earth rations when there's no raw food. Diet variety doesn't count yet. Galley and kitchen scraps go to the composter. **Seating:** a galley cooks and seats 25; a kitchen cooks 40 but seats no one, so it pairs with a canteen (seats 60, comfort +1 around it). Diners without a seat cost everyone a little comfort. No cultured meat lab or food groups yet.

## Construction materials

**Flow:** excavator bay digs → regolith (rock and silica) → brickworks (rock to brick), concrete plant (rock to marscrete), glassworks (rock to glass); solid waste → recycling center (scrap to brick) → brick, marscrete, glass → every new room's build cost. Every dig yields rock that becomes the next room.

- **Rock from:** the excavator bay and every dig.
- **Processed by:** brickworks, concrete plant, glassworks, recycling center.
- **Used by:** construction of every room. Glass also goes into windows, skylights, grand staircases and panoramic elevators.

**As built:** the drill sinks the shaft and every room is excavated from rock, which yields rock (and ore or silica on those sites); empty rooms dig ahead. The concrete plant makes marscrete, the brickworks (from 50 colonists) brick from rock, and the recycling center (from 100) metal and brick from solid waste. No glass yet. Rooms can be finished in bare rock, marscrete, brick or metal.

## Metals and machinery

**Flow:** ores (iron and more) → smelter (ore to metal); solid waste → recycling center (scrap to metal) → metal → machine shop (machinery), pipe mill (pipe), vehicle works (rovers, also needing electronics), construction (rooms and goods). Smelting and scrap both feed one metal supply.

- **Metal made by:** smelter (from ore), recycling center (from scrap).
- **Processed by:** machine shop (machinery), pipe mill (pipe), vehicle works (rovers), electronics fab.
- **Used by:** construction, furniture and appliance workshops, reinforcement frames.

**As built:** smelter (ore sites) → metal → machine shop → machinery. Metal and machinery go into construction; maintenance rooms use machinery to repair. Other holes get metal by trade route.

## Silicon and electronics

**Flow:** silica (sand deposits) → silicon refinery (makes wafers) → electronics fab (wafers plus metal) → appliances, vehicle works (rovers), advanced rooms (labs, reactors), solar arrays.

- **Silica from:** silica deposits on the map, or imports.
- **Processed by:** silicon refinery (wafers), electronics fab (wafers plus metal).
- **Electronics used by:** appliance assembly, vehicle works, research labs, reactors, solar arrays, luxury housing and other advanced rooms.

**As built:** silicon refinery (silica sites) → wafers → electronics fab (with metal) → electronics, used in construction.

## Plastics and fuel

**Flow:** CO2 (from colonists) + clean water, or bio-oil (oilseed crop) → chemical plant (power hungry) → plastics → textile mill (synthetic cloth), toy workshop and appliance assembly; → methane → rovers (fuel).

- **Made by:** chemical plant, from CO2 and water, or from oilseed crops.
- **Plastics used by:** textile mill, toy workshop, appliance assembly.
- **Methane used by:** rovers.

**As built:** not yet.

## Consumer goods

**Flow:** fiber hemp (farm crop) or plastics → textile mill (textiles); organic waste → mycelium vat (composite) → clothing workshop, furniture workshop (composite + textiles + metal), toy workshop (plastics + textiles), appliance assembly (metal, plastics, electronics) → shops → colonists.

- **Inputs:** fiber hemp, plastics, mycelium composite, metal, electronics.
- **Processed by:** textile mill, mycelium vat, clothing, furniture and toy workshops, appliance assembly.
- **Sold by:** shops and market halls. Colonists need goods by life stage and housing tier; goods also export to the belt and tourists.

**As built:** not yet.

## Beer

**Flow:** barley (farm crop) + water → brewery → beer → bars and lounges (comfort +1 for regulars) and exports.

**As built:** not yet (barley isn't a crop yet).

## Waste

**Flow:** kitchens → organic waste → mycelium vat (composite for furniture) and composter (soil back to farms); everything that uses water → gray water → water recycler (clean water back to tanks, sludge to soil); homes and factories → solid waste → recycling center (metal and brick back to building). Almost every kind of waste becomes a resource again.

- **Made by:** colonists, kitchens, water users (gray water), factories (tailings).
- **Processed by:** mycelium vat, composter, water recycler, recycling center.
- **Stored in:** waste storage when processing falls behind; smell grows as it fills.

**As built:** the galley's organic waste goes to the composter, which makes soil for farms; gray water goes to the recycler, whose sludge is soil too. Tailings are only stored (T-005). Solid waste (colonists, the recycler) goes to the recycling center, from 100 colonists; waste storage rooms hold more of it (and of organic waste) until it's used.
