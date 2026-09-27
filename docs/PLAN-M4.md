# Milestone 4 plan: two holes

Goal: prove the second layer of the design, "holes affect each other across the map". Found a second hole from the first, run both at once, move goods between them, and watch them start to feel differently about each other.

Decided Sep 27, 2026 (Bryon): milestone 4 is the network (two holes). The map uses NASA MOLA elevation data, downloaded once and downsampled into `data/`.

## Shape of the change

- **World above holes.** Today's per-hole state stays as it is and every existing system keeps running on one hole. A new world state holds shared time, the list of holes and what happens between them (convoys, rovers, opinion). Each hole keeps its own random stream, so the whole game stays deterministic.
- **Commands name a hole.** The worker simulates every hole each tick and sends the views a snapshot of the hole you're looking at, plus a summary of the rest.
- **Saves** move to version 3; a version-2 save becomes a world with one hole.

## Defaults (chosen, not yet confirmed)

- **Map:** MOLA elevation at 1° (360 × 180), shaded as relief with real names for major features. Resource deposits are placed with the game seed, so every game differs, but they follow the terrain: ice toward the poles and in lowlands, aquifers in basins, ore and silica in volcanic and highland regions.
- **Deposits:** ore, silica, aquifer and ice. The first hole starts at a seeded site with ice and one of ore or silica, so it can survive alone but not grow alone, as the docs say.
- **Map unlock:** at 50 colonists, matching "minutes 20–30: map mode unlocks and a second site is scouted".
- **Regional industry** from ROOMS.md, gated by what's under the hole: deep well pump (aquifer), smelter (ore), machine shop, silicon refinery (silica), electronics fab. Digging at an ore or silica site yields ore or silica alongside rock.
- **Founding:** a staging bay (L) fills with a seed kit from `data/`: machinery, electronics, metal, food, water, and volunteers who leave the parent. The convoy's travel time follows distance on the map. The new hole starts with the kit, a small pod, and the volunteers' average happiness.
- **Two holes at once:** both simulate every tick. You switch holes from the HUD, and messages say which hole they're from. Visitors queue in each hole. Earth drops go to any hole with a working pad.
- **Rovers:** a rover depot (surface) holds 2 rovers. A route moves one resource from one hole to another, a fixed amount per trip, with travel time from distance. Trips are logged in the flow diagram as "Rover from ⟨hole⟩".
- **Culture and opinion, kept simple:** four sliders per hole (Work–Leisure, Order–Freedom, Earth–Mars, Open–Insular) drifting toward a target set by the room mix and ordinances. Opinion between holes runs from −100 to +100, moved by fairness (value sent vs received), similarity, and decay toward neutral. Opinion shows in a Network panel and nudges rover trips: friendly holes load a little more, wary ones a little less.

## Steps

1. **World and multi-hole core.** World state above holes, commands with a hole id, snapshots of the active hole plus a summary, save v3 with migration, a hole picker in the HUD. *See:* the game plays exactly as before, with one hole named.
2. **The Mars map.** Download and downsample MOLA; named features; seeded deposits; a Map screen with shaded relief, deposits and hole markers. *See:* a real map of Mars with your hole on it.
3. **Sites and regional digging.** The first hole's seeded site; map unlocks at 50 colonists; site details (elevation, deposits, distance); digging yields ore or silica where there is some. *See:* scout a second site.
4. **Regional industry.** Deep well pump, smelter, machine shop, silicon refinery, electronics fab, gated by site. *See:* a hole making its own metal.
5. **Founding a hole.** Staging bay, seed kit, volunteers, convoy travel, the new hole created on arrival. *See:* a second hole founded.
6. **Two holes at once.** Both simulated, switching, per-hole messages and visitors, Earth drops per hole. *See:* run both, jump between them.
7. **Rovers and trade routes.** Rover depot, routes, trips, ledger entries, a Network panel to set routes. *See:* metal flowing from the ore hole to the other.
8. **Culture and opinion.** Sliders, drift, opinion from fairness, similarity and decay, shown in the Network panel; opinion nudges trade. *See:* two holes starting to feel differently.
9. **Balance and tests.** A scripted two-hole playthrough, tuning, and tests for everything that crosses holes. *See:* the network pays off within the first hour.
