# Milestone 11 plan: a sealed city in an open hole

Goal: make the hole's physical logic hold together. The shaft is open to Mars; people live in a sealed network of rooms, corridors, stairs and glass gallery tubes. Air and smell move through that network, what people use counts by how far they'd walk to it, and noise still carries through the rock. A hole's end goal is a dome that seals the shaft itself.

Decided Sep 30, 2026 (Bryon), in conversation, before any code:

- **The shaft is outside.** It's Mars air (thin, cold, dusty). Nothing about it is breathable or walkable until the dome.
- **Air is an internal loop.** Life support is the lungs; ventilation hubs are air handlers that scrub and circulate. Nothing vents to the planet or draws air from it. Poor air quality means contamination (fumes, dust, CO2 pooling) and distance from the main air trunk, which runs in risers down the shaft wall. The per-ring baseline (`effects.airQualityByRing`) stays, reframed as distance from the trunk.
- **The gallery becomes buildable corridor:** glass-walled, pressurized tubes along the shaft wall. Floor 1 starts with its gallery built; on other floors the player lays gallery segments where they want them. A ring-1 room can face the shaft directly through its own windows (the full view bonus, but it needs access from a corridor behind or beside it), or open onto a gallery tube (easy access, a filtered view: half the bonus).
- **Three ways effects travel.** What you *sense* goes by nearness (through rock and walls), what you *breathe* goes through the air network, and what you *use* goes by walking distance.

  | Effect or bonus | Nearness | Air network | Walking |
  | --- | --- | --- | --- |
  | Noise, heat | ✓ | | |
  | Shaft view; finer homes cheering neighbours | ✓ | | |
  | Air quality | | ✓ | |
  | Smell | Only to the next room (walls leak) | ✓ | |
  | Park, plaza | A small comfort nearby (greenery, light) | Park also freshens air | ✓ The main bonus: somewhere to go |
  | Canteen | A small ambience bonus | | ✓ Seats count only within reach |
  | Gym | | | ✓ |
  | Clinic, hospital, school, elder care | | | ✓ Coverage per home by distance (no longer hole-wide) |

- **Noise stays nearness-based,** and corridors keep soaking it up, so "a corridor between you and the life support" is still a tactic. Smell no longer stops at a corridor: it rides the air through it, fading.
- **Steps.** Distance on the network counts one step per room, corridor segment or gallery segment passed through; stairs count as a step between floors. Reach is data: about 6 steps for a plaza or park, about 10 for a clinic (to tune).
- **Stairs carry air and people; elevators carry people only.**
- **Services fill nearest first:** homes use the nearest clinic, school or elder care in reach; when it's full, the next homes go to the next one in reach.
- **The dome** is a hole's late, expensive end goal (a later milestone; sketched below).

## What this changes, in the code as it is

- `sim/corridors.ts` decides *whether* a room is connected (union-find sets); nothing measures *how far*. Each floor's gallery is one implicit node that every ring-1 cell joins.
- `sim/edges.ts` has no edges on circle 0 (ring 1's inner side): the gallery isn't an edge at all.
- `sim/effects.ts` radiates every effect by nearness, cell to cell, with corridors blocking noise and smell.
- Care, school and elder-care coverage (`happiness.ts`, `care.ts`) and dining seats (`economy.ts`) are hole-wide totals.

## Steps

Each step ends with something to see and test, and is committed on its own.

1. **Gallery edges.** Circle-0 edges exist, one per ring-1 slot per floor, drawable with the corridor tool as a "gallery" kind (its own look and cost in `data/corridors.json`). The implicit per-floor gallery node goes: ring-1 rooms connect only through a built gallery segment, a corridor or a public room. New games start with floor 1's gallery built. **Save migration:** every existing floor gets its full gallery, so nothing is cut off. The entrance and stairs sit in ring 1, so they join whatever gallery or corridor touches them. The bots lay gallery segments with their ring-1 rooms.
2. **Gallery in the views.** 2D and plan: gallery segments drawn like corridors along the shaft; a bare stretch shows the room's shaft wall. 3D: a glass tube with a railing and floor, lit at night; without one, the room's shaft wall is a window wall. First person can walk the tubes; the gallery walkway where there's no tube goes.
3. **View bonus.** Direct shaft windows: the full `shaftViewComfort`; a room opening onto a gallery tube: half (`galleryViewComfort`). The room card and placement preview say which.
4. **The network graph.** A graph of the sealed spaces, rebuilt when the layout changes (like the effect field): rooms, corridor and gallery segments, public rooms and empty space, stairs (people and air) and elevators (people only) linking floors. Two distance queries: steps on foot, and steps through the air. Tested on its own.
5. **Air and smell through the network.** Air quality and smell spread from each source along the air graph, fading per step (strength and reach from the room's effect data), on top of the per-ring baseline; smell also leaks to the rooms right next door by nearness. A ventilation hub on a corridor cleans the stretch around it. Noise and heat unchanged. The overlays show the spread along corridors.
6. **Amenities on foot.** Park, plaza, gym and canteen bonuses reach homes within their walking range, fading with steps; park, plaza and canteen keep a small nearness bonus too. Canteen and galley seats count for diners within reach.
7. **Services by distance.** Clinic, hospital, school and elder-care coverage per home, from the services in reach with room to spare, nearest first: each home's people go to the nearest clinic (school, elder care) in reach, and once it's full, the next homes go to the next one in reach (decided, Bryon). Homes out of reach feel it as the hole-wide shortfall does today, but locally. The People panel and home cards say what's in reach and what isn't.
8. **Seeing distances.** Placing a room shows what it would reach (or what reaches it) in steps, e.g. "clinic 4 steps, plaza 9 (out of reach)". Selecting a service shows its reach as an overlay.
9. **Balance, bots and docs.** Tune reach, fades and the gallery's cost so the early game stays gentle (floor 1's free gallery, the afterglow); bots place services within reach of their homes; README, DESIGN, DECISIONS and ROOMS updated.

**Maybe, if it earns its place:** a sealed bulkhead upgrade on a corridor that blocks air and smell but not people; Mars dust tracked in through the entrance airlock as an air-quality source near it, worse in dust storms; crowding (CO2) lowering air quality in packed homes.

## Later: the dome (sketch, its own milestone)

A late, costly project that seals the top of the shaft. It needs glass (bringing the glassworks in) and likely a population or depth threshold. Once built:

- the shaft is pressurized: every floor's gallery becomes open walkway, so every ring-1 room has access;
- the shaft is an atrium: a comfort bonus for shaft-facing rooms, and room for gallery cafés and hanging gardens;
- the shaft joins the air network as one big shared volume, lifting the baseline;
- dust storms no longer reach down the shaft;
- it's a visible spectacle in 3D, and counts toward the hole's standing.

## Still open

- Exact reach and fade numbers, and the gallery segment's cost.
- How the half view bonus shows in 3D (the glass tube in front of the window).

## Notes as built

**Step 1, gallery edges:**
- `edges.ts`: circle 0 (the shaft wall) has arc edges now, one per ring-1 slot: in `cellEdges`, `edgeById`, `arcAt` and `nearestEdge` (which also picks them from just over the wall, on the shaft side). `isGalleryEdge`, `galleryEdges(hole, floor)`.
- `corridors.ts`: a corridor on the shaft wall is always a gallery tube (`corridors.gallery` in `data/corridors.json`, `finishFor`), whatever finish was asked for; it's never refused for its shaft side. The implicit per-floor gallery node is gone: ring-1 rooms connect only through a built tube, corridor, public room or empty space. A floor is linked when anything on it reaches the surface. Connect (`routeToRoom`) routes along the shaft wall too.
- **Cost:** 3 rock per 10 m (about 2 a segment). Metal was tried first: the bots ran short of it for life support, as early players would; glass isn't in the game yet.
- **New games** start with floor 1's gallery built all the way round. **Save v16:** every floor of an old save gets its full gallery.
- Walking ignores gallery edges for now (the ledge is still open everywhere); the tutorial's corridor goal doesn't count the starting gallery.
- **Bots:** their Connect calls lay gallery tubes on new floors. Growth to minute 80 is a little slower (155 colonists, was 160+); the people playthrough's bar is 150 now.

**Step 2, the gallery in the views:**
- **2D unrolled:** each floor's top band is open shaft (dark) now; gallery tubes are drawn in it where built, as a glass band (ribs, the railing edge, a glint; `corridorArt`'s "gallery" look). A ring-1 room's door onto the gallery sits in the middle of the tubes along it; with none, its shaft face is all windows. Pointing at the band with the corridor tool picks the gallery edge there.
- **Plan:** the ledge ring is open shaft; tubes are drawn as arcs on it, with a door dot where they meet a room.
- **3D:** the ledge, railing and lamps that ran all the way round every floor are gone. Each built tube (`galleryTubes` in rooms3d) is a floor slab on the ledge, a curved glass wall with ribs, a railing, and (with every floor showing) a glass roof with a lamp strip that glows at night. A tube still being built is a ghosted slab; an unlinked one is red. Where there's no tube, a nearly invisible ledge is left to point at, so the corridor tool can reach the shaft wall.
- **Doors** (`view/doors.ts`) only where a built tube runs along a ring-1 room; a public room in ring 1 is walled off from the shaft without one.
- **Walking:** the ledge is only walkable inside a built tube. **Walkers** stroll along runs of tube (`view/gallery.ts` `tubeRuns`), turning back at the ends; floors without tubes have none.
- **Not done:** a floor-to-ceiling window where no tube runs (the usual window band stays); the 2D views still draw ring-1 public rooms and dug-out empty space as open to the shaft side.

