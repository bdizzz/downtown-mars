# Furniture

What's in each room type in the 3D view (docs/PLAN-M10.md). The models are built in `scripts/furniture.mjs`, which writes `data/furniture.json` (run `node scripts/furniture.mjs` after editing it): each item is a few boxes, cylinders and spheres, with named colours and "accent" for the room's category colour. Sizes are width × depth × height in metres. The back of an item goes against its wall. Wall hangings (pictures, lamps, charts, readouts, signs) hang at a height and go flat on a solid wall; with walls down they vanish with their wall. Where things go in each room is in `data/layouts.json`, edited with the dev tool (`?furnish` in the dev build). Stairwells and elevators are furnished on every floor they span, with their own templates for the top or bottom floor where those differ.

## By room

| Room | Size | Items |
| --- | --- | --- |
| Bunk dorm | M | Bunk bed, Locker, Footlocker, Privacy screen, Table, Stool, Rug, Floor lamp, Coat rack, Shelving, Poster, Wall lamp, Wall shelf, Clock, Family photos, Woven hanging, Picture of Earth, Coat hooks, Intercom, Air vent |
| Studio | S | Bed, Side table, Wardrobe, Privacy screen, Kitchenette, Bathroom, Table, Stool, Rug, Floor lamp, Potted plant, Coat rack, Painting, Poster, Wall lamp, Wall shelf, Mirror, Family photos, Woven hanging, Picture of Earth, Coat hooks, Intercom, Air vent |
| Apartment | M | Bed, Side table, Wardrobe, Privacy screen, Kitchenette, Bathroom, Dining table, Sofa, Media wall, Rug, Floor lamp, Potted plant, Coat rack, Painting, Wide painting, Wall lamp, Wall shelf, Mirror, Clock, Family photos, Woven hanging, Picture of Earth, Coat hooks, Intercom, Air vent |
| Flat | S | Double bed, Side table, Wardrobe, Dresser, Privacy screen, Kitchenette, Bathroom, Table, Chair, Sofa, Coffee table, Media wall, Rug, Floor lamp, Potted plant, Bookshelf, Painting, Wide painting, Wall lamp, Wall shelf, Mirror, Clock, Hanging planter, Family photos, Woven hanging, Picture of Earth, Coat hooks, Intercom, Air vent |
| Family apartment | M | Double bed, Bed, Side table, Wardrobe, Dresser, Privacy screen, Kitchenette, Bathroom, Dining table, Sofa, Coffee table, Media wall, Desk, Office chair, Rug, Floor lamp, Potted plant, Bookshelf, Painting, Wide painting, Poster, Wall lamp, Wall shelf, Mirror, Clock, Hanging planter, Family photos, Woven hanging, Picture of Earth, Coat hooks, Intercom, Air vent |
| Suite | S | Double bed, Side table, Wardrobe, Dresser, Bathroom, Bathtub, Kitchenette, Table, Chair, Sofa, Armchair, Coffee table, Fireplace, Bookshelf, Media wall, Rug, Floor lamp, Potted plant, Tree planter, Painting, Wide painting, Wall lamp, Wall shelf, Mirror, Clock, Hanging planter, Family photos, Woven hanging, Picture of Earth, Coat hooks, Intercom, Air vent |
| Residence | M | Double bed, Bed, Side table, Wardrobe, Dresser, Privacy screen, Bathroom, Bathtub, Kitchenette, Dining table, Sofa, Armchair, Coffee table, Fireplace, Piano, Bookshelf, Desk, Office chair, Media wall, Rug, Floor lamp, Potted plant, Tree planter, Painting, Wide painting, Wall lamp, Wall shelf, Mirror, Clock, Hanging planter, Family photos, Woven hanging, Picture of Earth, Coat hooks, Intercom, Air vent |
| Galley | S | Stove counter, Prep counter, Fridge, Serving counter, Dining table, Shelving, Water dispenser, Bin, Notice board, Clock, Wall shelf, Safety sign, Menu board, Utensil rack, Fire extinguisher, First-aid box, Air vent |
| Farm | L | Planter bed, Hydroponic rack, Planter bed (potatoes), Hydroponic rack (potatoes), Planter bed (soybeans), Hydroponic rack (soybeans), Planter bed (wheat), Hydroponic rack (wheat), Planter bed (barley), Hydroponic rack (barley), Planter bed (mushrooms), Hydroponic rack (mushrooms), Planter bed (algae), Hydroponic rack (algae), Seedling bench, Storage tank, Tool cart, Shelving, Pipe run, Gauges, Chart board, Hanging planter, Readout panel, Grow light, Pipe manifold, Tool pegboard, Fire extinguisher, Air vent |
| Water tank | S | Storage tank, Pipe run, Valve panel, Pump, Gauges, Safety sign, Pipe manifold, Cable tray, Work light, Fire extinguisher, First-aid box, Air vent |
| Water recycler | L | Filter column, Storage tank, Pump, Pipe run, Control console, Valve panel, Gauges, Readout panel, Safety sign, Chart board, Pipe manifold, Cable tray, Work light, Fire extinguisher, First-aid box, Air vent |
| Restroom | S | Toilet stall, Washbasins, Shower, Washer, Bench, Bin, Mirror, Poster, Wall lamp, Air vent, First-aid box, Intercom |
| Life support | L | CO2 scrubber, Air handler, Gas bottles, Control console, Pipe run, Air duct, Gauges, Readout panel, Safety sign, Pipe manifold, Cable tray, Work light, Fire extinguisher, First-aid box, Air vent |
| Clinic | S | Medical bed, Medicine cabinet, Monitor, Privacy screen, Body scanner, Desk, Office chair, Chair, Potted plant, Water cooler, Chart board, Poster, Clock, Readout panel, Painting, Whiteboard, Picture of Earth, Family photos, Intercom, Fire extinguisher, Air vent |
| Admin office | M | Reception desk, Desk, Office chair, Filing cabinet, Meeting table, Wall screen, Potted plant, Water cooler, Bookshelf, Sofa, Map of Mars, Painting, Clock, Notice board, Wide painting, Whiteboard, Picture of Earth, Family photos, Intercom, Fire extinguisher, Air vent |
| Battery bank | S | Battery rack, Inverter cabinet, Control console, Air duct, Gauges, Readout panel, Safety sign, Pipe manifold, Cable tray, Work light, Fire extinguisher, First-aid box, Air vent |
| Deep well pump | M | Wellhead, Pump, Pipe run, Valve panel, Control console, Storage tank, Gauges, Readout panel, Safety sign, Pipe manifold, Cable tray, Work light, Fire extinguisher, First-aid box, Air vent |
| Smelter | L | Furnace, Ore bin, Ingot rack, Control console, Tool cart, Conveyor, Barrels, Safety sign, Readout panel, Gauges, Chart board, Pipe manifold, Cable tray, Work light, Fire extinguisher, First-aid box, Air vent |
| Machine shop | M | Lathe, Workbench, Drill press, Welding bay, 3D printer, Tool wall, Shelving, Tool cart, Safety sign, Chart board, Wall shelf, Clock, Tool pegboard, Whiteboard, Cable tray, Work light, Fire extinguisher, First-aid box, Air vent |
| Silicon refinery | L | Reactor vessel, Crystal puller, Clean hood, Control console, Gas bottles, Shelving, Safety sign, Readout panel, Gauges, Chart board, Pipe manifold, Cable tray, Work light, Fire extinguisher, First-aid box, Air vent |
| Electronics fab | M | Fab bench, Clean hood, Parts cabinet, 3D printer, Stool, Shelving, Control console, Readout panel, Chart board, Safety sign, Clock, Tool pegboard, Whiteboard, Cable tray, Work light, Fire extinguisher, First-aid box, Air vent |
| Staging bay | L | Kit container, Crate stack, Cargo crate, Cargo cart, Pallet jack, Barrels, Control console, Safety sign, Notice board, Map of Mars, Readout panel, Cable tray, Work light, Fire extinguisher, First-aid box, Air vent |
| School | M | School desk, Board, Desk, Office chair, Bookshelf, Cubbies, Rug, Potted plant, Notice board, Map of Mars, Poster, Clock, Painting, Whiteboard, Picture of Earth, Family photos, Intercom, Fire extinguisher, Air vent |
| Elder care | M | Bed, Armchair, Side table, Sofa, Potted plant, Medicine cabinet, Rug, Media wall, Floor lamp, Privacy screen, Dining table, Water cooler, Painting, Wide painting, Clock, Hanging planter, Wall lamp, Family photos, Woven hanging, Picture of Earth, Coat hooks, Intercom, Air vent |
| Composter | M | Compost bin, Compost drum, Soil sacks, Tool cart, Barrels, Gauges, Safety sign, Chart board, Pipe manifold, Cable tray, Work light, Fire extinguisher, First-aid box, Air vent |
| Crypt | M | Memorial niches, Memorial stone, Bench, Potted plant, Candle stand, Plaque, Wall lamp, Painting, Woven hanging, Air vent |
| Concrete plant | M | Mixer, Hopper, Cement bags, Mould forms, Conveyor, Pallet jack, Safety sign, Gauges, Chart board, Pipe manifold, Cable tray, Work light, Fire extinguisher, First-aid box, Air vent |
| Tiny plaza | S | Bench, Tree planter, Lamp post, Potted plant, Bin, Hanging planter, Wall lamp, Banner, Picture of Earth, Intercom, Fire extinguisher, First-aid box, Air vent |
| Small plaza | M | Fountain, Bench, Tree planter, Lamp post, Vending machine, Info kiosk, Bin, Potted plant, Banner, Hanging planter, Wall lamp, Map of Mars, Picture of Earth, Intercom, Fire extinguisher, First-aid box, Air vent |
| Entrance | S | Suit locker, Decontamination arch, Bench, Control console, Info kiosk, Cargo crate, Map of Mars, Safety sign, Notice board, Clock, Coat hooks, Picture of Earth, Fire extinguisher, First-aid box, Intercom, Air vent |
| Cargo elevator | S | Cargo crate, Cargo cart, Pallet jack, Control console, Barrels, Safety sign, Notice board, Cable tray, Work light, Fire extinguisher, First-aid box, Air vent |
| Site office | S | Desk, Office chair, Plan table, Locker, Shelving, Water cooler, Chart board, Notice board, Clock, Whiteboard, Picture of Earth, Family photos, Intercom, Fire extinguisher, Air vent |
| Construction office | M | Plan table, Desk, Office chair, Tool wall, Cargo crate, Shelving, Water cooler, Chart board, Notice board, Clock, Map of Mars, Whiteboard, Picture of Earth, Family photos, Intercom, Fire extinguisher, Air vent |
| Construction yard | L | Girder stack, Crate stack, Scaffolding, Cargo cart, Pallet jack, Tool wall, Plan table, Barrels, Safety sign, Chart board, Notice board, Tool pegboard, Whiteboard, Cable tray, Work light, Fire extinguisher, First-aid box, Air vent |
| Storeroom | S | Shelving, Cargo crate, Barrels, Safety sign, Notice board, Cable tray, Work light, Fire extinguisher, First-aid box, Air vent |
| Warehouse | M | Pallet rack, Crate stack, Cargo cart, Pallet jack, Barrels, Safety sign, Notice board, Wall lamp, Cable tray, Work light, Fire extinguisher, First-aid box, Air vent |
| Depot | L | Pallet rack, Crate stack, Cargo cart, Pallet jack, Control console, Barrels, Safety sign, Notice board, Readout panel, Cable tray, Work light, Fire extinguisher, First-aid box, Air vent |
| Stairwell | S | Stair flight, Stair well, Bench, Potted plant, Poster, Wall lamp, Safety sign, Picture of Earth, Intercom, Fire extinguisher, First-aid box, Hanging planter, Air vent |
| Maintenance | M | Workbench, Repair stand, Parts rack, Tool wall, Tool cart, Control console, Shelving, Safety sign, Chart board, Clock, Notice board, Tool pegboard, Whiteboard, Cable tray, Work light, Fire extinguisher, First-aid box, Air vent |
| Cleaning service | M | Washer, Cleaning cart, Mop rack, Drying rack, Washbasins, Shelving, Locker, Notice board, Clock, Mirror, Poster, Wall lamp, Air vent, First-aid box, Intercom |
| Elevator | S | Elevator shaft, Elevator (car waiting), Call panel, Bench, Potted plant, Poster, Wall lamp, Safety sign, Picture of Earth, Intercom, Fire extinguisher, First-aid box, Hanging planter, Air vent |

## Items

| Item | Size (m) | Used in |
| --- | --- | --- |
| Painting (`painting`) | 0.9 × 0.1 × 0.7, hung at 1.5 | Studio, Apartment, Flat, Family apartment, Suite, Residence, Clinic, Admin office, School, Elder care, Crypt |
| Wide painting (`painting_wide`) | 1.8 × 0.1 × 0.9, hung at 1.45 | Apartment, Flat, Family apartment, Suite, Residence, Admin office, Elder care |
| Poster (`poster`) | 0.6 × 0.05 × 0.85, hung at 1.3 | Bunk dorm, Studio, Family apartment, Restroom, Clinic, School, Stairwell, Cleaning service, Elevator |
| Wall lamp (`wall_lamp`) | 0.25 × 0.55 × 0.35, hung at 1.9 | Bunk dorm, Studio, Apartment, Flat, Family apartment, Suite, Residence, Restroom, Elder care, Crypt, Tiny plaza, Small plaza, Warehouse, Stairwell, Cleaning service, Elevator |
| Wall shelf (`wall_shelf`) | 1 × 0.45 × 0.45, hung at 1.45 | Bunk dorm, Studio, Apartment, Flat, Family apartment, Suite, Residence, Galley, Machine shop |
| Mirror (`wall_mirror`) | 0.6 × 0.05 × 1, hung at 1.1 | Studio, Apartment, Flat, Family apartment, Suite, Residence, Restroom, Cleaning service |
| Clock (`wall_clock`) | 0.4 × 0.1 × 0.4, hung at 2.2 | Bunk dorm, Apartment, Flat, Family apartment, Suite, Residence, Galley, Clinic, Admin office, Machine shop, Electronics fab, School, Elder care, Entrance, Site office, Construction office, Maintenance, Cleaning service |
| Chart board (`chart_board`) | 1.4 × 0.15 × 0.9, hung at 1.25 | Farm, Water recycler, Clinic, Smelter, Machine shop, Silicon refinery, Electronics fab, Composter, Concrete plant, Site office, Construction office, Construction yard, Maintenance |
| Readout panel (`readout_panel`) | 1.2 × 0.1 × 0.7, hung at 1.35 | Farm, Water recycler, Life support, Clinic, Battery bank, Deep well pump, Smelter, Silicon refinery, Electronics fab, Staging bay, Depot |
| Gauges (`gauge_panel`) | 0.9 × 0.15 × 0.6, hung at 1.3 | Farm, Water tank, Water recycler, Life support, Battery bank, Deep well pump, Smelter, Silicon refinery, Composter, Concrete plant |
| Map of Mars (`mars_map`) | 2 × 0.1 × 1.1, hung at 1.3 | Admin office, Staging bay, School, Small plaza, Entrance, Construction office |
| Notice board (`notice_board`) | 1.2 × 0.1 × 0.8, hung at 1.3 | Galley, Admin office, Staging bay, School, Entrance, Cargo elevator, Site office, Construction office, Construction yard, Storeroom, Warehouse, Depot, Maintenance, Cleaning service |
| Safety sign (`safety_sign`) | 0.6 × 0.05 × 0.6, hung at 1.75 | Galley, Water tank, Water recycler, Life support, Battery bank, Deep well pump, Smelter, Machine shop, Silicon refinery, Electronics fab, Staging bay, Composter, Concrete plant, Entrance, Cargo elevator, Construction yard, Storeroom, Warehouse, Depot, Stairwell, Maintenance, Elevator |
| Hanging planter (`wall_planter`) | 0.8 × 0.5 × 0.8, hung at 1.35 | Flat, Family apartment, Suite, Residence, Farm, Elder care, Tiny plaza, Small plaza, Stairwell, Elevator |
| Banner (`banner`) | 0.9 × 0.1 × 1.6, hung at 1.6 | Tiny plaza, Small plaza |
| Plaque (`plaque`) | 0.5 × 0.05 × 0.35, hung at 1.4 | Crypt |
| Family photos (`family_photos`) | 1 × 0.05 × 0.7, hung at 1.35 | Bunk dorm, Studio, Apartment, Flat, Family apartment, Suite, Residence, Clinic, Admin office, School, Elder care, Site office, Construction office |
| Woven hanging (`wall_textile`) | 0.9 × 0.1 × 1.25, hung at 1.3 | Bunk dorm, Studio, Apartment, Flat, Family apartment, Suite, Residence, Elder care, Crypt |
| Picture of Earth (`earth_photo`) | 0.7 × 0.1 × 0.7, hung at 1.4 | Bunk dorm, Studio, Apartment, Flat, Family apartment, Suite, Residence, Clinic, Admin office, School, Elder care, Tiny plaza, Small plaza, Entrance, Site office, Construction office, Stairwell, Elevator |
| Coat hooks (`coat_hooks`) | 1.3 × 0.35 × 1, hung at 0.9 | Bunk dorm, Studio, Apartment, Flat, Family apartment, Suite, Residence, Elder care, Entrance |
| Whiteboard (`whiteboard`) | 1.6 × 0.2 × 1, hung at 1 | Clinic, Admin office, Machine shop, Electronics fab, School, Site office, Construction office, Construction yard, Maintenance |
| Pipe manifold (`pipe_manifold`) | 1.6 × 0.5 × 0.7, hung at 1.7 | Farm, Water tank, Water recycler, Life support, Battery bank, Deep well pump, Smelter, Silicon refinery, Composter, Concrete plant |
| Cable tray (`cable_tray`) | 1.8 × 0.6 × 0.15, hung at 2.95 | Water tank, Water recycler, Life support, Battery bank, Deep well pump, Smelter, Machine shop, Silicon refinery, Electronics fab, Staging bay, Composter, Concrete plant, Cargo elevator, Construction yard, Storeroom, Warehouse, Depot, Maintenance |
| Tool pegboard (`tool_board`) | 1.2 × 0.2 × 0.9, hung at 1.1 | Farm, Machine shop, Electronics fab, Construction yard, Maintenance |
| Fire extinguisher (`fire_extinguisher`) | 0.25 × 0.4 × 0.85, hung at 0.8 | Galley, Farm, Water tank, Water recycler, Life support, Clinic, Admin office, Battery bank, Deep well pump, Smelter, Machine shop, Silicon refinery, Electronics fab, Staging bay, School, Composter, Concrete plant, Tiny plaza, Small plaza, Entrance, Cargo elevator, Site office, Construction office, Construction yard, Storeroom, Warehouse, Depot, Stairwell, Maintenance, Elevator |
| First-aid box (`first_aid_kit`) | 0.4 × 0.3 × 0.4, hung at 1.4 | Galley, Water tank, Water recycler, Restroom, Life support, Battery bank, Deep well pump, Smelter, Machine shop, Silicon refinery, Electronics fab, Staging bay, Composter, Concrete plant, Tiny plaza, Small plaza, Entrance, Cargo elevator, Construction yard, Storeroom, Warehouse, Depot, Stairwell, Maintenance, Cleaning service, Elevator |
| Air vent (`air_vent`) | 0.7 × 0.1 × 0.4, hung at 2.7 | Bunk dorm, Studio, Apartment, Flat, Family apartment, Suite, Residence, Galley, Farm, Water tank, Water recycler, Restroom, Life support, Clinic, Admin office, Battery bank, Deep well pump, Smelter, Machine shop, Silicon refinery, Electronics fab, Staging bay, School, Elder care, Composter, Crypt, Concrete plant, Tiny plaza, Small plaza, Entrance, Cargo elevator, Site office, Construction office, Construction yard, Storeroom, Warehouse, Depot, Stairwell, Maintenance, Cleaning service, Elevator |
| Intercom (`intercom`) | 0.2 × 0.1 × 0.3, hung at 1.35 | Bunk dorm, Studio, Apartment, Flat, Family apartment, Suite, Residence, Restroom, Clinic, Admin office, School, Elder care, Tiny plaza, Small plaza, Entrance, Site office, Construction office, Stairwell, Cleaning service, Elevator |
| Menu board (`menu_board`) | 1.3 × 0.1 × 0.6, hung at 1.75 | Galley |
| Utensil rack (`utensil_rack`) | 1.1 × 0.25 × 0.75, hung at 1.3 | Galley |
| Grow light (`grow_light`) | 1.5 × 0.75 × 0.15, hung at 2.5 | Farm |
| Work light (`work_light`) | 0.2 × 0.6 × 0.25, hung at 2.45 | Water tank, Water recycler, Life support, Battery bank, Deep well pump, Smelter, Machine shop, Silicon refinery, Electronics fab, Staging bay, Composter, Concrete plant, Cargo elevator, Construction yard, Storeroom, Warehouse, Depot, Maintenance |
| Parts rack (`parts_rack`) | 1.15 × 0.55 × 2.2 | Maintenance |
| Repair stand (`repair_stand`) | 1.2 × 0.7 × 1.4 | Maintenance |
| Cleaning cart (`cleaning_cart`) | 0.95 × 0.55 × 1.85 | Cleaning service |
| Mop rack (`mop_rack`) | 1.2 × 0.45 × 1.45 | Cleaning service |
| Drying rack (`drying_rack`) | 1.05 × 0.5 × 1.6 | Cleaning service |
| Bunk bed (`bunk_bed`) | 2 × 1 × 1.9 | Bunk dorm |
| Bed (`bed`) | 2.15 × 1.05 × 0.9 | Studio, Apartment, Family apartment, Residence, Elder care |
| Locker (`locker`) | 0.65 × 0.55 × 1.95 | Bunk dorm, Site office, Cleaning service |
| Footlocker (`footlocker`) | 0.95 × 0.55 × 0.45 | Bunk dorm |
| Table (`table`) | 1.2 × 0.8 × 0.85 | Bunk dorm, Studio, Flat, Suite |
| Stool (`stool`) | 0.4 × 0.4 × 0.5 | Bunk dorm, Studio, Electronics fab |
| Chair (`chair`) | 0.5 × 0.5 × 0.95 | Flat, Suite, Clinic |
| Office chair (`office_chair`) | 0.8 × 0.8 × 1.15 | Family apartment, Residence, Clinic, Admin office, School, Site office, Construction office |
| Rug (`rug`) | 2.4 × 1.7 × 0.05 | Bunk dorm, Studio, Apartment, Flat, Family apartment, Suite, Residence, School, Elder care |
| Armchair (`armchair`) | 0.9 × 0.9 × 1.05 | Suite, Residence, Elder care |
| Sofa (`sofa`) | 2 × 0.9 × 1 | Apartment, Flat, Family apartment, Suite, Residence, Admin office, Elder care |
| Side table (`side_table`) | 0.5 × 0.5 × 0.95 | Studio, Apartment, Flat, Family apartment, Suite, Residence, Elder care |
| Potted plant (`plant_pot`) | 0.85 × 0.7 × 1.45 | Studio, Apartment, Flat, Family apartment, Suite, Residence, Clinic, Admin office, School, Elder care, Crypt, Tiny plaza, Small plaza, Stairwell, Elevator |
| Privacy screen (`partition`) | 1.9 × 0.4 × 1.8 | Bunk dorm, Studio, Apartment, Flat, Family apartment, Residence, Clinic, Elder care |
| Floor lamp (`floor_lamp`) | 0.4 × 0.4 × 1.8 | Bunk dorm, Studio, Apartment, Flat, Family apartment, Suite, Residence, Elder care |
| Media wall (`tv_unit`) | 2 × 0.5 × 1.75 | Apartment, Flat, Family apartment, Suite, Residence, Elder care |
| Coat rack (`coat_rack`) | 0.5 × 0.4 × 1.8 | Bunk dorm, Studio, Apartment |
| Double bed (`double_bed`) | 2.2 × 1.75 × 1.2 | Flat, Family apartment, Suite, Residence |
| Wardrobe (`wardrobe`) | 1.25 × 0.65 × 2.05 | Studio, Apartment, Flat, Family apartment, Suite, Residence |
| Dresser (`dresser`) | 1.25 × 0.55 × 1.8 | Flat, Family apartment, Suite, Residence |
| Coffee table (`coffee_table`) | 1.1 × 0.6 × 0.55 | Flat, Family apartment, Suite, Residence |
| Kitchenette (`kitchenette`) | 2.45 × 0.7 × 2.2 | Studio, Apartment, Flat, Family apartment, Suite, Residence |
| Bathroom (`bathroom_pod`) | 2.25 × 1.7 × 2.45 | Studio, Apartment, Flat, Family apartment, Suite, Residence |
| Bathtub (`bathtub`) | 1.75 × 0.85 × 0.9 | Suite, Residence |
| Fireplace (`fireplace`) | 1.5 × 0.5 × 1.35 | Suite, Residence |
| Piano (`piano`) | 1.55 × 1.45 × 1.35 | Residence |
| Washer (`laundry_machine`) | 0.7 × 0.7 × 0.9 | Restroom, Cleaning service |
| Stove counter (`stove_counter`) | 2.05 × 0.75 × 2.25 | Galley |
| Prep counter (`prep_counter`) | 2.05 × 0.75 × 1.75 | Galley |
| Fridge (`fridge`) | 0.9 × 0.85 × 2 | Galley |
| Dining table (`dining_table`) | 2.4 × 1.95 × 0.9 | Apartment, Family apartment, Residence, Galley, Elder care |
| Serving counter (`serving_counter`) | 2.45 × 0.75 × 2.55 | Galley |
| Water dispenser (`water_dispenser`) | 0.4 × 0.45 × 1.45 | Galley |
| Planter bed (potatoes) (`planter_bed_potatoes`) | 2.6 × 1.15 × 2.6 | Farm |
| Hydroponic rack (potatoes) (`hydroponic_rack_potatoes`) | 1.95 × 0.65 × 2.55 | Farm |
| Planter bed (soybeans) (`planter_bed_soybeans`) | 2.6 × 1.15 × 2.6 | Farm |
| Hydroponic rack (soybeans) (`hydroponic_rack_soybeans`) | 1.95 × 0.65 × 2.55 | Farm |
| Planter bed (wheat) (`planter_bed_wheat`) | 2.6 × 1.15 × 2.6 | Farm |
| Hydroponic rack (wheat) (`hydroponic_rack_wheat`) | 1.95 × 0.65 × 2.55 | Farm |
| Planter bed (barley) (`planter_bed_barley`) | 2.6 × 1.15 × 2.6 | Farm |
| Hydroponic rack (barley) (`hydroponic_rack_barley`) | 1.95 × 0.65 × 2.55 | Farm |
| Planter bed (`planter_bed`) | 2.6 × 1.15 × 2.6 | Farm |
| Hydroponic rack (`hydroponic_rack`) | 1.95 × 0.65 × 2.55 | Farm |
| Planter bed (mushrooms) (`planter_bed_mushrooms`) | 2.6 × 1.15 × 2.6 | Farm |
| Hydroponic rack (mushrooms) (`hydroponic_rack_mushrooms`) | 1.95 × 0.65 × 2.5 | Farm |
| Planter bed (algae) (`planter_bed_algae`) | 2.6 × 1.15 × 2.6 | Farm |
| Hydroponic rack (algae) (`hydroponic_rack_algae`) | 1.95 × 0.65 × 2.55 | Farm |
| Seedling bench (`seed_table`) | 2 × 0.8 × 1.05 | Farm |
| Tool cart (`tool_cart`) | 0.9 × 0.55 × 1.05 | Farm, Smelter, Machine shop, Composter, Maintenance |
| Compost bin (`compost_bin`) | 1.35 × 1.35 × 1.35 | Composter |
| Compost drum (`compost_drum`) | 1.8 × 1.05 × 1.45 | Composter |
| Soil sacks (`soil_sacks`) | 1.3 × 0.9 × 0.7 | Composter |
| Storage tank (`big_tank`) | 3 × 3 × 3.45 | Farm, Water tank, Water recycler, Deep well pump |
| Pipe run (`pipe_run`) | 3 × 0.4 × 0.95 | Farm, Water tank, Water recycler, Life support, Deep well pump |
| Valve panel (`valve_panel`) | 1.2 × 0.65 × 1.8 | Water tank, Water recycler, Deep well pump |
| Pump (`pump`) | 1.3 × 0.8 × 1.1 | Water tank, Water recycler, Deep well pump |
| Filter column (`filter_column`) | 1.1 × 1.1 × 3 | Water recycler |
| Control console (`console`) | 1.3 × 0.9 × 1.8 | Water recycler, Life support, Battery bank, Deep well pump, Smelter, Silicon refinery, Electronics fab, Staging bay, Entrance, Cargo elevator, Depot, Maintenance |
| Toilet stall (`toilet_stall`) | 1.1 × 1.55 × 2.1 | Restroom |
| Washbasins (`sink_basin`) | 1.85 × 0.55 × 2 | Restroom, Cleaning service |
| Shower (`shower_stall`) | 1.1 × 1.1 × 2.2 | Restroom |
| CO2 scrubber (`scrubber_unit`) | 2.45 × 1.45 × 3.4 | Life support |
| Gas bottles (`gas_bottles`) | 1.3 × 0.6 × 1.65 | Life support, Silicon refinery |
| Air handler (`big_fan`) | 1.6 × 0.7 × 1.9 | Life support |
| Air duct (`duct_riser`) | 0.95 × 0.8 × 4 | Life support, Battery bank |
| Battery rack (`battery_rack`) | 1.4 × 0.85 × 2.3 | Battery bank |
| Inverter cabinet (`inverter`) | 1 × 0.65 × 2 | Battery bank |
| Wellhead (`well_head`) | 2.4 × 2 × 2.6 | Deep well pump |
| Furnace (`furnace`) | 2.7 × 2.5 × 4 | Smelter |
| Ore bin (`ore_bin`) | 1.6 × 1.3 × 1 | Smelter |
| Ingot rack (`ingot_rack`) | 1.6 × 0.6 × 1.3 | Smelter |
| Lathe (`lathe`) | 2.2 × 0.6 × 1.4 | Machine shop |
| Workbench (`workbench`) | 2 × 0.8 × 2.1 | Machine shop, Maintenance |
| Tool wall (`tool_wall`) | 2 × 0.2 × 1.9 | Machine shop, Construction office, Construction yard, Maintenance |
| Drill press (`drill_press`) | 0.8 × 0.7 × 1.85 | Machine shop |
| Welding bay (`welding_station`) | 1.85 × 1 × 2 | Machine shop |
| 3D printer (`printer_3d`) | 1 × 0.95 × 1.75 | Machine shop, Electronics fab |
| Reactor vessel (`reactor_vessel`) | 2.9 × 2 × 3.6 | Silicon refinery |
| Crystal puller (`crystal_puller`) | 1.85 × 1.2 × 3.9 | Silicon refinery |
| Clean hood (`clean_hood`) | 1.8 × 0.95 × 2.3 | Silicon refinery, Electronics fab |
| Fab bench (`fab_bench`) | 2 × 0.8 × 1.65 | Electronics fab |
| Parts cabinet (`component_cabinet`) | 1.2 × 0.55 × 1.8 | Electronics fab |
| Mixer (`mixer_drum`) | 2.25 × 1.4 × 2.45 | Concrete plant |
| Hopper (`hopper`) | 1.9 × 1.9 × 2.75 | Concrete plant |
| Cement bags (`bag_stack`) | 1.3 × 1 × 0.85 | Concrete plant |
| Mould forms (`mold_forms`) | 2.05 × 1.2 × 0.6 | Concrete plant |
| Conveyor (`conveyor`) | 3 × 0.8 × 1.2 | Smelter, Concrete plant |
| Cargo crate (`cargo_crate`) | 1.25 × 1.25 × 1.2 | Staging bay, Entrance, Cargo elevator, Construction office, Storeroom |
| Crate stack (`crate_stack`) | 2.45 × 1.25 × 2.4 | Staging bay, Construction yard, Warehouse, Depot |
| Pallet rack (`pallet_rack`) | 2.8 × 1.1 × 3.2 | Warehouse, Depot |
| Shelving (`shelf_unit`) | 1.4 × 0.5 × 2 | Bunk dorm, Galley, Farm, Machine shop, Silicon refinery, Electronics fab, Site office, Construction office, Storeroom, Maintenance, Cleaning service |
| Cargo cart (`cart`) | 1.45 × 0.9 × 1.35 | Staging bay, Cargo elevator, Construction yard, Warehouse, Depot |
| Pallet jack (`pallet_jack`) | 1.6 × 0.7 × 1.35 | Staging bay, Concrete plant, Cargo elevator, Construction yard, Warehouse, Depot |
| Barrels (`barrel_group`) | 1.35 × 1.3 × 0.95 | Smelter, Staging bay, Composter, Cargo elevator, Construction yard, Storeroom, Warehouse, Depot |
| Kit container (`kit_container`) | 3.2 × 2.5 × 2.65 | Staging bay |
| Girder stack (`girder_stack`) | 3.2 × 1.1 × 0.7 | Construction yard |
| Scaffolding (`scaffold`) | 2.5 × 1.1 × 3 | Construction yard |
| Plan table (`blueprint_table`) | 2 × 1.3 × 1.15 | Site office, Construction office, Construction yard |
| Suit locker (`suit_locker`) | 1 × 0.8 × 2.2 | Entrance |
| Decontamination arch (`decon_arch`) | 2.3 × 0.85 × 2.65 | Entrance |
| Desk (`desk`) | 1.6 × 0.8 × 1.3 | Family apartment, Residence, Clinic, Admin office, School, Site office, Construction office |
| Reception desk (`reception_desk`) | 2.7 × 1.5 × 1.25 | Admin office |
| School desk (`student_desk`) | 1 × 1.25 × 0.95 | School |
| Filing cabinet (`filing_cabinet`) | 0.5 × 0.7 × 1.3 | Admin office |
| Meeting table (`meeting_table`) | 2.4 × 2.2 × 0.95 | Admin office |
| Wall screen (`wall_screen`) | 2.2 × 0.2 × 2.45 | Admin office |
| Board (`chalkboard`) | 3 × 0.3 × 2.25 | School |
| Bookshelf (`bookshelf`) | 1.4 × 0.4 × 2 | Flat, Family apartment, Suite, Residence, Admin office, School |
| Cubbies (`cubbies`) | 1.6 × 0.5 × 1.2 | School |
| Medical bed (`medical_bed`) | 2.25 × 1.05 × 1.05 | Clinic |
| Medicine cabinet (`med_cabinet`) | 1.2 × 0.55 × 1.9 | Clinic, Elder care |
| Monitor (`monitor_stand`) | 0.55 × 0.55 × 1.7 | Clinic |
| Body scanner (`scanner`) | 1.95 × 2.3 × 2 | Clinic |
| Water cooler (`water_cooler`) | 0.7 × 0.45 × 1.5 | Clinic, Admin office, Elder care, Site office, Construction office |
| Bench (`bench`) | 1.8 × 0.5 × 0.5 | Restroom, Crypt, Tiny plaza, Small plaza, Entrance, Stairwell, Elevator |
| Tree planter (`planter_tree`) | 1.7 × 1.7 × 3.35 | Suite, Residence, Tiny plaza, Small plaza |
| Lamp post (`lamp_post`) | 1.1 × 0.4 × 2.9 | Tiny plaza, Small plaza |
| Fountain (`fountain`) | 2.5 × 2.5 × 1.75 | Small plaza |
| Vending machine (`vending_machine`) | 1 × 0.85 × 2 | Small plaza |
| Bin (`trash_bin`) | 0.55 × 0.55 × 0.85 | Galley, Restroom, Tiny plaza, Small plaza |
| Info kiosk (`kiosk`) | 0.7 × 0.7 × 1.8 | Small plaza, Entrance |
| Memorial niches (`niche_wall`) | 3.1 × 0.5 × 2.6 | Crypt |
| Memorial stone (`memorial`) | 0.9 × 0.65 × 1 | Crypt |
| Candle stand (`candle_stand`) | 0.5 × 0.5 × 1.15 | Crypt |
| Stair flight (`stair_flight`) | 2.8 × 6.45 × 4 | Stairwell |
| Stair well (`stair_landing`) | 2.85 × 6.45 × 1.05 | Stairwell |
| Elevator shaft (`elevator_shaft`) | 2.4 × 2.4 × 4 | Elevator |
| Elevator (car waiting) (`elevator_car`) | 2.4 × 2.4 × 4 | Elevator |
| Call panel (`call_panel`) | 0.35 × 0.2 × 1.6 | Elevator |
