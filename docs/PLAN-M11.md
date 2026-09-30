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
7. **Services by distance.** Clinic, hospital, school and elder-care coverage per home, from the services in reach with room to spare (nearest first). Homes out of reach feel it as the hole-wide shortfall does today, but locally. The People panel and home cards say what's in reach and what isn't.
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
- Services: step 7 proposes nearest-first with capacity (a full clinic sends the next homes to the next clinic in reach); the simpler alternative is in or out of reach, with capacity hole-wide as today. To confirm before step 7.
- How the half view bonus shows in 3D (the glass tube in front of the window).

## Notes as built
