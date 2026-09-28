# Furniture

What's in each room type in the 3D view (docs/PLAN-M10.md). The models are in `data/furniture.json`: each item is a few boxes, cylinders and spheres, with named colours and "accent" for the room's category colour. Sizes are width × depth × height in metres. The back of an item goes against its wall. Where things go in each room is in `data/layouts.json`, edited with the dev tool (`?furnish` in the dev build). Stairwells and elevators are furnished on every floor they span, with their own templates for the top or bottom floor where those differ.

## By room

| Room | Size | Items |
| --- | --- | --- |
| Stairwell | S | Stair flight, Stair landing, Bench, Potted plant |
| Elevator | S | Elevator shaft, Elevator (car waiting), Call panel, Bench, Potted plant |
| Bunk dorm | M | Bunk bed, Locker, Footlocker, Table, Stool, Rug |
| Galley | S | Stove counter, Prep counter, Fridge, Dining table, Shelving |
| Farm | L | Planter bed, Tool cart, Shelving, Storage tank |
| Water tank | S | Storage tank, Pipe run, Valve panel |
| Water recycler | L | Filter column, Storage tank, Pump, Pipe run, Control console |
| Restroom | S | Toilet stall, Washbasins, Shower |
| Life support | L | CO2 scrubber, Air handler, Gas bottles, Control console, Pipe run |
| Clinic | S | Medical bed, Medicine cabinet, Monitor, Desk, Chair |
| Admin office | M | Desk, Office chair, Filing cabinet, Meeting table, Wall screen, Potted plant |
| Battery bank | S | Battery rack, Inverter cabinet, Control console |
| Deep well pump | M | Wellhead, Pump, Pipe run, Valve panel, Control console |
| Smelter | L | Furnace, Ore bin, Ingot rack, Control console, Tool cart |
| Machine shop | M | Lathe, Workbench, Drill press, Tool wall, Shelving |
| Silicon refinery | L | Reactor vessel, Clean hood, Control console, Gas bottles, Shelving |
| Electronics fab | M | Fab bench, Clean hood, Stool, Shelving, Control console |
| Staging bay | L | Kit container, Crate stack, Cargo crate, Cargo cart, Control console |
| School | M | School desk, Board, Desk, Office chair, Bookshelf, Rug |
| Elder care | M | Bed, Armchair, Side table, Sofa, Potted plant, Medicine cabinet, Rug |
| Composter | M | Compost bin, Compost drum, Soil sacks, Tool cart |
| Crypt | M | Memorial niches, Memorial stone, Bench, Potted plant |
| Concrete plant | M | Mixer, Hopper, Cement bags, Mould forms |
| Tiny plaza | S | Bench, Tree planter, Lamp post, Potted plant |
| Small plaza | M | Fountain, Bench, Tree planter, Lamp post |
| Entrance | S | Suit locker, Bench, Control console |
| Cargo elevator | S | Cargo crate, Cargo cart, Control console |
| Site office | S | Desk, Office chair, Plan table, Locker |
| Construction office | M | Plan table, Desk, Office chair, Tool wall, Cargo crate |
| Construction yard | L | Girder stack, Crate stack, Cargo cart, Tool wall, Plan table |
| Storeroom | S | Shelving, Cargo crate |
| Warehouse | M | Pallet rack, Crate stack, Cargo cart |
| Depot | L | Pallet rack, Crate stack, Cargo cart, Control console |

## Items

| Item | Size (m) | Used in |
| --- | --- | --- |
| Bunk bed (`bunk_bed`) | 2 × 0.95 × 1.9 | Bunk dorm |
| Bed (`bed`) | 2.1 × 1 × 0.8 | Elder care |
| Locker (`locker`) | 0.6 × 0.55 × 1.9 | Bunk dorm, Site office |
| Footlocker (`footlocker`) | 0.95 × 0.55 × 0.45 | Bunk dorm |
| Table (`table`) | 1.2 × 0.8 × 0.75 | Bunk dorm |
| Stool (`stool`) | 0.4 × 0.4 × 0.5 | Bunk dorm, Electronics fab |
| Chair (`chair`) | 0.5 × 0.5 × 0.95 | Clinic |
| Office chair (`office_chair`) | 0.6 × 0.6 × 1.15 | Admin office, School, Site office, Construction office |
| Rug (`rug`) | 2.2 × 1.6 × 0.05 | Bunk dorm, School, Elder care |
| Armchair (`armchair`) | 0.9 × 0.9 × 1 | Elder care |
| Sofa (`sofa`) | 2 × 0.9 × 0.95 | Elder care |
| Side table (`side_table`) | 0.5 × 0.5 × 0.75 | Elder care |
| Potted plant (`plant_pot`) | 0.6 × 0.6 × 1.35 | Stairwell, Elevator, Admin office, Elder care, Crypt, Tiny plaza |
| Stove counter (`stove_counter`) | 2.05 × 0.75 × 2.25 | Galley |
| Prep counter (`prep_counter`) | 2.05 × 0.75 × 1 | Galley |
| Fridge (`fridge`) | 0.9 × 0.85 × 2 | Galley |
| Dining table (`dining_table`) | 2.4 × 2 × 0.75 | Galley |
| Planter bed (`planter_bed`) | 2.6 × 1.1 × 2.6 | Farm |
| Tool cart (`tool_cart`) | 0.9 × 0.55 × 0.95 | Farm, Smelter, Composter |
| Compost bin (`compost_bin`) | 1.35 × 1.35 × 1.35 | Composter |
| Compost drum (`compost_drum`) | 1.6 × 1.1 × 1.5 | Composter |
| Soil sacks (`soil_sacks`) | 1.3 × 0.9 × 0.7 | Composter |
| Storage tank (`big_tank`) | 3 × 3 × 3.45 | Farm, Water tank, Water recycler |
| Pipe run (`pipe_run`) | 3 × 0.5 × 0.9 | Water tank, Water recycler, Life support, Deep well pump |
| Valve panel (`valve_panel`) | 1.2 × 0.45 × 1.8 | Water tank, Deep well pump |
| Pump (`pump`) | 1.3 × 0.8 × 1.1 | Water recycler, Deep well pump |
| Filter column (`filter_column`) | 1.1 × 1.1 × 3 | Water recycler |
| Control console (`console`) | 1.3 × 0.9 × 1.2 | Water recycler, Life support, Battery bank, Deep well pump, Smelter, Silicon refinery, Electronics fab, Staging bay, Entrance, Cargo elevator, Depot |
| Toilet stall (`toilet_stall`) | 1.1 × 1.5 × 2.1 | Restroom |
| Washbasins (`sink_basin`) | 1.85 × 0.55 × 2 | Restroom |
| Shower (`shower_stall`) | 1.1 × 1.1 × 2.2 | Restroom |
| CO2 scrubber (`scrubber_unit`) | 2.4 × 1.4 × 3.25 | Life support |
| Gas bottles (`gas_bottles`) | 1.3 × 0.6 × 1.7 | Life support, Silicon refinery |
| Air handler (`big_fan`) | 1.8 × 0.8 × 2 | Life support |
| Battery rack (`battery_rack`) | 1.4 × 0.85 × 2.2 | Battery bank |
| Inverter cabinet (`inverter`) | 1 × 0.65 × 1.8 | Battery bank |
| Wellhead (`well_head`) | 2.4 × 1.8 × 2.6 | Deep well pump |
| Furnace (`furnace`) | 2.6 × 2.5 × 4 | Smelter |
| Ore bin (`ore_bin`) | 1.6 × 1.3 × 1.1 | Smelter |
| Ingot rack (`ingot_rack`) | 1.6 × 0.6 × 1.3 | Smelter |
| Lathe (`lathe`) | 2.2 × 0.8 × 1.4 | Machine shop |
| Workbench (`workbench`) | 2 × 0.8 × 1.1 | Machine shop |
| Tool wall (`tool_wall`) | 2 × 0.15 × 1.9 | Machine shop, Construction office, Construction yard |
| Drill press (`drill_press`) | 0.7 × 0.7 × 1.9 | Machine shop |
| Reactor vessel (`reactor_vessel`) | 2 × 2 × 3.6 | Silicon refinery |
| Clean hood (`clean_hood`) | 1.8 × 0.9 × 2.3 | Silicon refinery, Electronics fab |
| Fab bench (`fab_bench`) | 2 × 0.8 × 1.35 | Electronics fab |
| Mixer (`mixer_drum`) | 2.4 × 1.6 × 2.4 | Concrete plant |
| Hopper (`hopper`) | 1.9 × 1.9 × 3 | Concrete plant |
| Cement bags (`bag_stack`) | 1.3 × 1 × 0.9 | Concrete plant |
| Mould forms (`mold_forms`) | 2.2 × 1.3 × 0.7 | Concrete plant |
| Cargo crate (`cargo_crate`) | 1.25 × 1.25 × 1.2 | Staging bay, Cargo elevator, Construction office, Storeroom |
| Crate stack (`crate_stack`) | 2.5 × 1.25 × 2.4 | Staging bay, Construction yard, Warehouse, Depot |
| Pallet rack (`pallet_rack`) | 2.8 × 1.1 × 3.2 | Warehouse, Depot |
| Shelving (`shelf_unit`) | 1.4 × 0.5 × 2 | Galley, Farm, Machine shop, Silicon refinery, Electronics fab, Storeroom |
| Cargo cart (`cart`) | 1.45 × 0.9 × 1.3 | Staging bay, Cargo elevator, Construction yard, Warehouse, Depot |
| Kit container (`kit_container`) | 3.2 × 2.45 × 2.65 | Staging bay |
| Girder stack (`girder_stack`) | 3.2 × 1.1 × 0.9 | Construction yard |
| Plan table (`blueprint_table`) | 2 × 1.3 × 1.15 | Site office, Construction office, Construction yard |
| Suit locker (`suit_locker`) | 1 × 0.8 × 2.2 | Entrance |
| Desk (`desk`) | 1.6 × 0.8 × 1.2 | Clinic, Admin office, School, Site office, Construction office |
| School desk (`student_desk`) | 1 × 1.2 × 0.9 | School |
| Filing cabinet (`filing_cabinet`) | 0.5 × 0.7 × 1.3 | Admin office |
| Meeting table (`meeting_table`) | 2.6 × 2.2 × 0.95 | Admin office |
| Wall screen (`wall_screen`) | 2.2 × 0.15 × 2.6 | Admin office |
| Board (`chalkboard`) | 3 × 0.25 × 2.4 | School |
| Bookshelf (`bookshelf`) | 1.4 × 0.4 × 2 | School |
| Medical bed (`medical_bed`) | 2.25 × 1.05 × 1.1 | Clinic |
| Medicine cabinet (`med_cabinet`) | 1.2 × 0.55 × 1.9 | Clinic, Elder care |
| Monitor (`monitor_stand`) | 0.6 × 0.6 × 1.8 | Clinic |
| Bench (`bench`) | 1.8 × 0.5 × 0.5 | Stairwell, Elevator, Crypt, Tiny plaza, Small plaza, Entrance |
| Tree planter (`planter_tree`) | 1.7 × 1.6 × 3.3 | Tiny plaza, Small plaza |
| Lamp post (`lamp_post`) | 0.5 × 0.5 × 3.15 | Tiny plaza, Small plaza |
| Fountain (`fountain`) | 2.4 × 2.4 × 1.3 | Small plaza |
| Memorial niches (`niche_wall`) | 3 × 0.45 × 2.6 | Crypt |
| Memorial stone (`memorial`) | 0.9 × 0.6 × 1.1 | Crypt |
| Stair flight (`stair_flight`) | 4.45 × 1.3 × 4 | Stairwell |
| Stair landing (`stair_landing`) | 4.5 × 1.45 × 1.05 | Stairwell |
| Elevator shaft (`elevator_shaft`) | 2.4 × 2.4 × 4 | Elevator |
| Elevator (car waiting) (`elevator_car`) | 2.4 × 2.4 × 4 | Elevator |
| Call panel (`call_panel`) | 0.35 × 0.2 × 1.6 | Elevator |
