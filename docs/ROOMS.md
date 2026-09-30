# Room catalog

Every room with its footprint, staff, inputs, outputs, neighbor effects, build cost and unlock. All numbers are first-pass starting points for balancing; ★ marks rooms in the first playable version.

**Legend**

- **Size:** S = 1 slot, M = 2 slots, L = 4 slots, H = 8 slots (usually 2+ floors); L and H rooms can be laid out wide, deep or tall; Surface and Shaft rooms sit outside the ring.
- **Amounts** are per game day. Effects run from −3 to +3, with radius r in slots (r0 = the room itself).
- **Build cost:** R = rock, B = brick, M = metal, Mc = machinery, E = electronics.
- **Per colonist per day:** 1 cooked food, 2 clean water, 1 oxygen; produces 1 CO2 and 1 solid waste. Housing rooms don't list these; residents carry them.

## Size ladders

Most room families come in several sizes. The category tables below list each family's default size; this ladder shows the alternatives.

- **Scaling:** L gives about 10% more output per slot and H about 25%. Staff scale with output.
- **Effects grow with size:** at L and H, a room's neighbor effects gain +1 strength and +1 radius, so a big factory is much louder and a big park much nicer.
- **Unlocks:** L at pop 300 and H at pop 2,000 unless a room's own unlock is later.
- **Upgrading in place:** a room can grow to the next size if the neighboring slots are free.
- **Shape:** most L and H rooms can be laid out wide, deep or tall; a few, like the grand plaza, stadium and reactor, have fixed minimum shapes (see Room shapes in the main doc).

| Family | S (1 slot) | M (2 slots) | L (4 slots) | H (8 slots, 2+ floors) |
| --- | --- | --- | --- | --- |
| Farming | Grow room | Garden | Farm | Farm atrium |
| Dining | Snack bar | Canteen | Dining hall | Food court |
| Water storage | Tank | Cistern | Reservoir | Deep reservoir |
| Life support | Air unit | Life support | Life support plant | Atmosphere works |
| Restrooms | Restroom | Washroom | Bathhouse | — |
| Manufacturing | Workshop | Machine shop | Factory | Industrial complex |
| Health | Clinic | Medical center | Hospital | Medical campus |
| Education | Classroom | School | Academy | Campus |
| Research | Lab bench | Research lab | Institute | Science campus |
| Parks | Planter | Garden | Park | Commons |
| Nightlife | Bar | Lounge | Theater | Arena |
| Shops | Kiosk | Shop | Store | Market hall |
| Offices | Desk suite | Office | Office floor | Office tower |
| Administration | Admin desk | Admin office | Town hall | Council chamber |
| Storage | Storeroom | Warehouse | Depot | Distribution hub |
| Glassmaking | Kiln | Glassworks | Glass factory | Float glass plant |
| Fitness | Fitness nook | Gym | Sports hall | Stadium |
| Brewing | Microbrewery | Brewery | Brewing hall | Brewing works |

Rooms with one fixed size: geothermal plant, reactor, reinforcement frame, staging bay, and all surface and shaft rooms.

## Housing

Every housing tier comes in four sizes. Bigger buildings fit more residents per slot but feel more crowded, while small units fill awkward gaps and feel cozy.

**Residents by tier and size**

| Tier | S (1 slot) | M (2 slots) | L (4 slots) | H (8 slots, 2+ floors) |
| --- | --- | --- | --- | --- |
| Bunk dorm ★ | Bunk pod: 8 | Bunk dorm: 16 | Barracks: 36 | Hive block: 80 |
| Basic apartment | Studio: 5 | Apartment: 10 | Apartment block: 22 | Residential tower: 50 |
| Standard apartment | Flat: 4 | Apartment: 8 | Courtyard block: 18 | Terrace tower: 40 |
| Luxury apartment | Suite: 2 | Residence: 4 | Villa: 9 | Penthouse tower: 20 |

**Tier stats** (cost is per slot; power is per 2 slots)

| Tier | Staff | Power | Base comfort | Neighbor effects | Cost per slot | Unlock |
| --- | --- | --- | --- | --- | --- | --- |
| Bunk dorm ★ | 0 | 1 | −1 | — | R 10 | Start |
| Basic apartment | 0 | 1 | 0 | — | R 8, B 5 | Pop 50 |
| Standard apartment | 0 | 2 | +1 | Comfort +1 r1 | B 8, M 3 | Pop 200 |
| Luxury apartment | 1 per 4 slots | 3 | +2 | Comfort +1 r1 | M 5, E 3 | Pop 1,000 |

**Size rules**

- **S:** cozy, comfort +1 for its residents; highest cost per resident. Good for filling gaps.
- **M:** the baseline.
- **L:** about 10% more residents per slot; crowding gives comfort −1 for bunk and basic tiers. Unlocks at pop 300.
- **H:** about 25% more residents per slot; crowding gives comfort −2 for bunk and basic, −1 for standard, none for luxury. Needs extra metal (M 5 per floor) and puts heavy load on elevators. Unlocks at pop 2,000.
- **Hotels** use the same size ladder and tiers, hosting tourists instead of residents.

## Food

| Room | Size | Staff | Uses | Makes | Neighbor effects | Build cost | Unlock |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Farm ★ | L | 6 | Water 4, soil 2, power 3, CO2 2 | Raw food 12 (potatoes), O2 2 | Smell −1 r1 | R 30, M 10, Mc 2 | Start |
| Farm atrium | H | 20 | Water 12, soil 6, power 8, CO2 6 | Raw food 30, O2 6 | Comfort +2 r2 | B 40, M 30, Mc 6, E 4 | Depth 10 floors |
| Cultured meat lab | S | 2 | Feedstock crops 3 (soy or algae), water 2, power 7 | Raw protein 8 (meat group; comfort bonus in diet) | — (clean and quiet) | M 15, Mc 3, E 5 | Research lab |
| Kitchen | M | 4 | Raw food 40, water 3, power 2 | Cooked food 40, organic waste 3 | Smell −1 r1 | R 15, M 5, Mc 1 | Start |
| Canteen | M | 3 | Cooked food | Seats 60 (a galley seats 25; a kitchen none) | Comfort +1 r2 | R 15, B 5 | Start |
| Galley ★ | S | 2 | Raw food or Earth rations 25, water 2, power 2 | Cooks and serves 25; organic waste 2 | Smell −1 r1 | R 10, M 5 | Start |
| Brewery | M | 3 | Barley 4, water 4, power 2 | Beer 4 | Smell −1 r1 | B 10, M 5, Mc 1 | Pop 150 |

### Crops

Each farm grows one crop at a time, chosen by the player. Some feed people, others feed industry. Switching crops costs one grow cycle.

| Crop | Use | Yield per day (L farm) | Water | Power | Grow time | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Potatoes | Food: staple | 12 | 4 | 3 | Medium | Reliable, high calorie |
| Wheat | Food: staple | 9 | 3 | 3 | Long | Stores well; bread boosts comfort |
| Barley | Food: staple; brewing | 9 | 3 | 3 | Medium | Brews beer; also a staple grain |
| Soybeans | Food: protein | 8 | 4 | 3 | Medium | Also yields some oil |
| Leafy greens | Food: produce | 7 | 3 | 2 | Short | Health +1 for those who eat it |
| Fruit | Food: produce | 5 | 5 | 4 | Long | Comfort bonus; prized export |
| Mushrooms | Food: protein | 8 | 2 | 1 | Short | Needs no light; uses organic waste; ideal for deep floors |
| Algae | Food: staple | 14 | 6 | 2 | Short | Makes extra O2; tastes bland, comfort −1 if a diet relies on it |
| Fiber hemp | Material: fiber | 6 | 4 | 3 | Medium | Feeds textile mills |
| Oilseed | Material: bio-oil | 5 | 3 | 3 | Medium | Feeds chemical plants as a plastics alternative |
| Herbs | Material: medicine | 3 | 2 | 2 | Short | Supplies clinics; raises their effectiveness |
| Coffee and tea | Luxury | 3 | 3 | 3 | Long | Comfort +1 hole-wide when stocked; top belt and tourist export |
| Flowers | Comfort | — | 2 | 2 | Short | No food; comfort +1 r2 around the farm |

**Diet variety:** kitchens combine crops into meals. Colonists want staples, protein and produce; a varied diet gives health and comfort bonuses, and a monotonous one gives penalties.

## Water and air

| Room | Size | Staff | Uses | Makes | Neighbor effects | Build cost | Unlock |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Water tank ★ | S | 0 | — | Stores 200 water | — | R 10, M 5 | Start |
| Deep well pump | M | 2 | Power 4 | Clean water 40 | Noise −1 r1 | M 15, Mc 3 | Aquifer site |
| Water recycler ★ | L | 3 | Gray water 40, power 3 | Clean water 36, solid waste 1 | Noise −1 r1, smell −1 r1 | M 20, Mc 4 | Start |
| Life support ★ | L | 4 | Water 6, power 5 | O2 30, removes CO2 30 | Noise −2 r2 | M 25, Mc 5, E 2 | Start |
| Ventilation hub | S | 1 | Power 2 | — | Air quality +2 r2, noise −1 r1 | M 8, Mc 1 | Pop 100 |

## Waste

| Room | Size | Staff | Uses | Makes | Neighbor effects | Build cost | Unlock |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Restroom ★ | S | 1 | Users' water | Sanitation for 25; returns used water as 75% gray, 25% black | Smell −1 r1 | R 8, M 2 | Start |
| Composter | M | 2 | Organic waste 4, black water 2, power 1 | Soil 3 | Smell −2 r2 | R 15, M 5 | Pop 100 |
| Recycling center | L | 4 | Solid waste 6, power 3 | Metal 1, brick 1 | Noise −1 r1, smell −1 r1 | M 20, Mc 3 | Pop 100 |
| Waste storage | S | 0 | — | Holds 100 solid waste and 50 organic | Smell −1 r1 (worse when full: not built yet) | R 10 | Start |

## Power

| Room | Size | Staff | Uses | Makes | Neighbor effects | Build cost | Unlock |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Solar array | Surface | 1 | — | Power 10, less in storms | — | M 10, E 4 | Start |
| Battery bank | S | 0 | — | Stores 50 power | — | M 5, E 5 | Start |
| Geothermal plant | L | 3 | Water 2 | Power 25 | Noise −1 r1, heat +1 r1 | M 30, Mc 8, E 4 | Depth 15 floors |
| Reactor | H | 8 | Water 4 | Power 100 | Noise −2 r2, comfort −2 r3 | M 60, Mc 15, E 15 | Mid-game milestone |

## Industry and construction

| Room | Size | Staff | Uses | Makes | Neighbor effects | Build cost | Unlock |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Excavator bay | M | 3 | Power 3 | Faster digging, rock | Noise −2 r2 | M 10, Mc 3 | Start |
| Brickworks | M | 3 | Rock 6, water 1, power 2 | Brick 4 | Noise −1 r1, air quality −1 r1 (air quality not built yet) | R 15, M 5, Mc 1 | Pop 50 |
| Smelter | L | 5 | Ore 6, power 6 | Metal 3 | Noise −2 r2, heat +1 r2, air quality −1 r2 | B 20, M 10, Mc 3 | Ore site |
| Machine shop | M | 4 | Metal 3, power 3 | Machinery 1 | Noise −2 r2 | B 15, M 10, Mc 2 | Pop 200 |
| Electronics fab | M | 4 | Metal 1, silicon wafers 1, power 4 | Electronics 1 | — | M 15, Mc 3, E 2 | Pop 500 |
| Reinforcement frame | S | 0 | — | — | Cave-in risk −2 r2 | M 10 | Depth 8 floors |
| Staging bay | L | 2 | Seed kit goods | Founds a new hole | Noise −1 r1 | M 15, Mc 2 | Map mode |
| Site office | S | 2 | Power 1 | Construction bandwidth +1 | — | R 10, M 5 | Start |
| Construction office | M | 4 | Power 1 | Construction bandwidth +2.5 | Noise −1 r1 | B 15, M 10, Mc 1 | Start |
| Construction yard | L | 8 | Power 2 | Construction bandwidth +5 | Noise −2 r1 | B 30, M 20, Mc 3 | Start |
| Empty room | S, M or L | 0 | — | Digs out rock ahead of need; leaves walk-through empty space | — | Free (the digging takes time) | Start |

## Materials, goods and vehicles

These rooms turn raw resources into construction materials, consumer goods, pipelines and vehicles.

| Room | Size | Staff | Uses | Makes | Neighbor effects | Build cost | Unlock |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Concrete plant | M | 3 | Rock 5, water 2, power 2 | Marscrete 4 | Noise −2 r2, air quality −1 r1 | R 15, M 5, Mc 1 | Pop 100 |
| Glassworks | M | 3 | Rock 4, power 4 | Glass 2 | Heat +1 r1 | B 10, M 5, Mc 1 | Pop 200 |
| Chemical plant | L | 5 | CO2 4, water 2, power 5 | Plastics 2, methane 2 | Noise −1 r1, air quality −2 r2 | M 20, Mc 4, E 2 | Pop 300 |
| Mycelium vat | M | 2 | Organic waste 3, water 2, power 1 | Mycelium composite 3 (a wood substitute) | Smell −1 r1 | R 10, M 5 | Pop 150 |
| Textile mill | M | 3 | Fiber 4 or plastics 2, power 2 | Textiles 3 | Noise −1 r1 | B 10, M 5, Mc 2 | Pop 150 |
| Clothing workshop | S | 2 | Textiles 2 | Clothing 2 | — | B 8, Mc 1 | Pop 150 |
| Furniture workshop | M | 3 | Mycelium composite 2, textiles 1, metal 1 | Furniture 2 | Noise −1 r1 | B 10, Mc 2 | Pop 200 |
| Toy workshop | S | 2 | Plastics 1, textiles 1 | Toys 2 | — | B 8, Mc 1 | First births |
| Appliance assembly | M | 4 | Metal 1, plastics 1, electronics 1, power 2 | Appliances 1 | Noise −1 r1 | M 10, Mc 2, E 2 | Pop 500 |
| Pipe mill | M | 4 | Metal 4, power 3 | Pipe segments 2 | Noise −2 r2 | B 15, M 10, Mc 2 | Map mode |
| Vehicle works | L | 8 | Metal 6, machinery 2, electronics 2, power 4 | 1 rover every 3 days | Noise −2 r2 | B 30, M 20, Mc 5, E 3 | Map mode |
| Silicon refinery | L | 5 | Silica 6, water 2, power 6 | Silicon wafers 2 | Heat +1 r2, noise −1 r1 | B 20, M 15, Mc 4 | Silica site or imports |

**How the new outputs are used**

- **Construction materials:** marscrete and glass join rock, brick and metal in build costs. Glass is used for shaft-facing windows, plaza skylights, grand staircases and panoramic elevators, and is a steady export; marscrete is a cheap, strong substitute for brick.
- **Consumer goods** are clothing, furniture, toys and appliances. Colonists need them by stage and housing tier:
  - Clothing: everyone.
  - Furniture: basic apartments and up.
  - Toys: children.
  - Appliances: standard and luxury apartments.
  - Unmet needs lower comfort; shops distribute goods, and goods are strong exports to the belt and tourists.
- **Methane** fuels rovers.
- **Pipe segments** build pipelines between holes.
- **Rovers** carry trade routes, tours and founding convoys.
- Farms can grow fiber hemp, oilseed and herbs as raw materials; see Crops under Food.
- **Beer** stocks bars, gives comfort +1 to their regulars, and is a popular export to the belt and tourists.

### Material substitution

When a material is short, rooms can be built with a substitute. Substitutes cost more of the replacement material and make the room less pleasant.

| Swap | Extra cost | What changes |
| --- | --- | --- |
| No glass: use metal instead | Each glass becomes 2 metal | Solid panels or portholes replace windows. Shaft-facing rooms lose their view bonus, plazas lose skylights and need more power for lighting, and panoramic elevators become enclosed lifts that lose their tourist appeal. |
| No glass: use brick instead | Each glass becomes 3 brick | Same losses as metal, and the room reads heavier and darker: comfort −1 for anyone inside. |
| Marscrete for brick | Each brick becomes 1.5 marscrete | Raw concrete look: comfort −1 inside the room, shops and bars draw fewer customers, and hotels rate lower with tourists. Upside: slightly better cave-in resistance. |

- **Glass is optional** on any room that lists it, and on shaft- or plaza-facing windows. Adding glass later upgrades the room in place and restores its bonuses.
- **Mixing is allowed:** a room can be part brick, part marscrete, with the comfort penalty scaled to the share of marscrete.
- **Refitting:** rooms built with substitutes can be refinished later once the preferred material is available.

## Services

| Room | Size | Staff | Uses | Makes | Neighbor effects | Build cost | Unlock |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Maintenance | M | 2 | Power 1, machinery 0.5 | Repairs rooms back to 100% condition, one at a time, worst first | Noise −1 r1 | R 15, M 10, Mc 2 | Start |
| Cleaning service | M | 3 | Power 1, water 4 | Repairs homes and other people-heavy rooms back to 100%; gray water 4 | — | R 15, B 5, M 8 | Pop 150 |

- **Condition:** every room except the entrance, stairs, elevators and these two starts at 100% when built and wears down about 1.2% a day (30% faster for industry, power, air and water). Breakdowns now and then knock a room down 20–30 points.
- **Worn rooms:** below 50% they upset people (their own residents for homes; everyone, more so for galleys, restrooms and clinics); below 30% they work 30% slower; at 0% they stop.
- **The queue:** rooms at 60% or below wait in a hole-wide queue, worst first. Each maintenance room or cleaning service works one room at a time, at a pace set by its staff; one that stops hands its room back, part-done, to the front.
- Numbers live in `data/condition.json`.

## Health, education and care

| Room | Size | Staff | Uses | Makes | Neighbor effects | Build cost | Unlock |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Clinic ★ | S | 2 | Power 1, water 1 | Care for 50; enables births | Health +2 r2 | B 10, M 5, E 1 | Start |
| Hospital | L | 10 | Power 4, water 3 | Care for 400; allows births | Health +3 r3 | B 30, M 20, E 8 | Pop 300 |
| School | M | 3 | Power 1 | Teaches 40 children | Noise −1 r1 | B 15 | First births |
| Elder care | M | 3 | Power 1 | Care for 30 elders | Health +1 r1 | B 15, M 5 | First elders |
| Gym | M | 1 | Water 1, power 1 | — | Health +2 r2 | B 10 | Pop 50 |
| Park | M | 1 | Water 2, power 1 | O2 1; walk-through | Comfort +2 r2, air quality +1 r2 (air quality not built yet) | R 5, B 10 | Pop 50 |
| Running track | L, or a full floor ring | 0 | Power 1 | Hosts races and festivals; a full-ring loop doubles its effects | Health +2 r2, entertainment +1 r2 | R 20, B 10 | Pop 200 |
| Research lab | M | 4 | Power 3 | Speeds milestones | — | M 15, E 5 | Pop 300 |
| Crypt | M | 0 | Power 1 | Lays 40 dead to rest, for good (without one, grief weighs on comfort) | — | R 10, B 20 | First elders |

## Administration and commerce

| Room | Size | Staff | Uses | Makes | Neighbor effects | Build cost | Unlock |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Administration office ★ | M | 2+ | Power 1 | Citizen visits, ordinances | — | R 10, B 5 | Start |
| Office | M | 12 | Power 2 | Services; cancels coordination penalty | Quiet; workers want comfort nearby | B 15, M 5, E 3 | Pop 1,000 |
| Shop | S | 2 | Goods 1 | Circulates currency | Comfort +1 r2 | B 10 | Earth imports |
| Market hall | L | 8 | Goods 4 | Circulates currency | Comfort +2 r3, noise −1 r2 | B 30, M 10 | Pop 500 |
| Currency exchange | S | 3 | Power 1 | Stabilizes currency | — | M 10, E 3 | Mars currency founded |

## Security

| Room | Size | Staff | Uses | Makes | Neighbor effects | Build cost | Unlock |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Security outpost | S | 3 | Power 1 | Patrols nearby floors | Safety +2 r2 | B 10, M 5 | Pop 100 |
| Security headquarters | L | 12 | Power 3, electronics upkeep | Boosts every outpost in the hole; emergency response | Safety +2 r3 | B 30, M 20, E 5 | Pop 1,000 |

- **Safety** joins health, comfort, noise and entertainment as a happiness factor, and gets its own overlay.
- **Emergency response:** security speeds recovery from cave-ins, outbreaks (quarantines) and equipment failures.
- **Ordinances:** strong security makes enforced ordinances more effective.
- **The catch:** heavy security pushes a hole's culture toward Order, and Freedom-leaning holes feel watched (comfort −1 near outposts). Using security to break a strike ends it faster but badly damages loyalty.

## Circulation and public space

| Room | Size | Staff | Uses | Makes | Neighbor effects | Build cost | Unlock |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Corridor | S | 0 | — | Connects outer rings to the shaft; shortens commutes | Blocks noise and smell passing through | R 5 | Start |
| Entrance | S | 0 | — | Floor 1's way in from the surface: an airlock at the rim, and where people and goods arrive | — | Landing kit | Start |
| Tiny plaza | S | 0 | — | Walk-through gathering corner | Comfort +1 r1 | R 5, B 2 | Start |
| Small plaza | M | 1 | Power 1 | Gathering space | Comfort +1 r2 | R 10, B 5 | Pop 100 |
| Plaza | L | 2 | Power 2 | Transit hub; shortens commutes | Comfort +2 r2, entertainment +1 r2 | B 20, M 5 | Pop 500 |
| Grand plaza | H | 4 | Power 4, glass for skylights | Transit hub; hosts events | Comfort +3 r3, entertainment +2 r3 | B 40, M 15, glass 10 | Pop 2,000 |

- **Corridors** are required to reach rooms beyond the first ring, and double as sound buffers between noisy and quiet rooms.
- **Plazas** give shops, bars and canteens that border them a customer bonus, forming natural town squares.
- **Skylights** in plazas near the surface add comfort; deeper plazas use artificial daylight at higher power cost.
- **Protests** gather in plazas during unrest, so a plaza is also where trouble becomes visible first.

## Leisure and tourism

| Room | Size | Staff | Uses | Makes | Neighbor effects | Build cost | Unlock |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Bar and lounge | S | 2 | Beer 2, cooked food 1 | — | Entertainment +2 r2, noise −1 r1 | B 10 | Pop 50 |
| Theater | L | 6 | Power 3 | — | Entertainment +3 r3, noise −1 r1 | B 30, M 10, E 4 | Pop 500 |
| Hotel | M | 3 | Water 3, cooked food 2, power 2 | Hosts 12 tourists; quality tiers like housing | Noise −1 r1 | B 15, M 5 and up by tier | Landing pad |
| Experience venue | L | 6 | Power 4 | Tourist income | Entertainment +2 r2, noise −2 r2 | M 20, E 6 | First hotel |
| Tour company | S | 3 | Power 1 | Surface excursions; bonus near landmarks | — | M 10 | Hotel and rover depot |

## Vertical transport

The main shaft elevator is the spine, but stairs and extra elevators relieve it. Stairs suit short hops of a few floors; elevators handle long trips.

| Room | Size | Staff | Uses | Makes | Neighbor effects | Build cost | Unlock |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Stairwell | S, spans 2–3 floors | 0 | — | Slow, cheap link between nearby floors; health +1 for regular users | — | R 8 | Start |
| Spiral stair | S, spans 2 floors | 0 | — | Compact decorative link | Comfort +1 r1 | B 6, M 4 | Pop 200 |
| Grand staircase | M, spans 2–3 floors | 0 | — | High-capacity link inside plazas | Comfort +1 r2 | B 20, glass 5 | First plaza |
| Escalator | M, spans 1–2 floors | 0 | Power 1 | Fast, high capacity for short trips; boosts shops at both ends | Noise −1 r1 | M 10, Mc 2 | Pop 500 |
| Local elevator | S, spans up to 8 floors | 0 | Power 1 | Serves a band of floors, easing the main shaft | Noise −1 r1 | M 10, Mc 2 | Pop 150 |
| Elevator (as built) | S, spans 2–8 floors | 0 | Power 1 | A lift linking floors; extends a floor at a time | Noise −1 r1 | M 10, Mc 2 | Start |
| Cargo elevator | S | 1 | Power 3 | Straight from the surface to one floor, if its column above is clear; brings drops in there | Noise −1 r1 | M 40, Mc 8, E 4 | Pop 100 |
| Freight elevator | S, any span | 1 | Power 2 | Moves goods only, freeing people elevators | Noise −2 r1 | M 15, Mc 3 | Pop 300 |
| Express elevator | S, any span | 0 | Power 3 | Skips floors; stops only at sky lobbies | — | M 20, Mc 4, E 3 | Pop 2,000 |
| Panoramic elevator | S on the shaft wall | 0 | Power 2 | Glass car riding the shaft wall; slower | Comfort +1 r1; tourist attraction | M 15, glass 8, Mc 2 | First hotel |
| Sky lobby | M | 1 | Power 1 | Transfer floor where express and local elevators meet | Comfort +1 r1 | B 15, M 5 | With express elevator |

- **Commute time** depends on distance plus waiting for crowded lifts, so congestion shows up in the staffing and comfort overlays.
- **Sky lobbies** split a deep hole into zones: express lifts jump between lobbies, and local lifts spread out from each one.

## Surface, shaft and logistics

| Room | Size | Staff | Uses | Makes | Neighbor effects | Build cost | Unlock |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Landing pad | Surface | 3 | Power 1 | Supply drops, belt shipments, tourists | — | R 20, M 10 | Start |
| Rover depot | Surface | 4 | Power 3 | Trade routes between holes | — | M 20, Mc 4 | Map mode |
| Elevator upgrade | Shaft | 1 | Power 2 | More transit capacity | Noise −1 r1 | M 15, Mc 3 | Start |
| Landing pod | Surface | 0 | — | Houses 20; stores 500 goods; temporary homes for the first colonists | — | Landing kit | Start |
| Storeroom | S | 0 | — | Stores 90 goods | — | R 8, M 2 | Start |
| Warehouse | M | 1 | — | Stores 200 goods | — | R 15, M 5 | Start |
| Depot | L | 2 | Power 1 | Stores 440 goods | Noise −1 r1 | R 30, M 10, Mc 1 | Start |
