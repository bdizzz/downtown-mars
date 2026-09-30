# Downtown Mars — project guide

*Hole sweet hole.*

A real-time city builder on Mars. Each city is a **borehole**: you dig a shaft down, carve rooms into its walls in rings and floors, and grow a network of holes across the planet whose cultures drift apart. Two layers, one idea: proximity creates effects. Rooms affect neighboring rooms inside a hole; holes affect each other across the map.

Vibe: SimCity, SimTower and Terraforming Mars, with some of Frostpunk's social tension but chill rather than crushing. Sandbox mode; total supported population is the high score.

## Design documents (in `docs/`)

| File | What it holds |
| --- | --- |
| `DECISIONS.md` | Condensed decision log: key decisions, what was decided while building, reversals not to revive, open questions. Read this first. |
| `DESIGN.md` | Main design doc (the target): borehole, rings, corridors, shapes, frontage, economy, culture, network, ordinances, story, tech plan. Opens with where the build stands; stale sections carry **As built** notes. |
| `ROOMS.md` | Room catalog: every room's size, staff, inputs, outputs, effects, cost and unlock; size ladders; crops; material substitution. |
| `ROOM-STATUS.md` | Which catalog rooms are built and which are only described, graded by what each needs first. Generated: `node scripts/room-status.mjs` (rerun after adding rooms). |
| `PATHWAYS.md` | Each resource family traced from source to users, with what's built. |
| `EVENTS.md` | Event catalog: citizen visits, strike chain, hazards, discoveries, network, Earth and belt, story and notable events, with what's built. |
| `PLAN.md`, `PLAN-M2.md` … `PLAN-M10.md` | Milestone plans, each with "Notes as built". M1 first playable, M2 polish and saves, M3 3D, M4 two holes, M5 people, M6 corridors on edges, M7 construction time, M8 storage, M9 excavation and the entrance, M10 furnishing (and later work: condition, renaming, fonts). |
| `FURNITURE.md` | Furniture models and room layout templates. |
| `ART.md` | Art direction: the cozy 3D look, palette, readability rules. |

**When documents disagree:** `DECISIONS.md` and the plans' "Notes as built" win, then the catalogs (`ROOMS.md`, `EVENTS.md`, `PATHWAYS.md`), then `DESIGN.md`. The code and `data/*.json` are the truth for what's built.

## Working with Bryon

- Friendly, brief, conversational. Explain technical ideas concisely, ideally with an analogy.
- Ask 1–2 focused questions up front rather than long back-and-forth.
- When a design question comes up that the docs don't answer, propose a sensible default and ask, rather than inventing silently. Some areas are still undecided (audio, mid- and late-game balance, the roadmap past M10, rings 4–6); see "Still open" in `docs/DECISIONS.md`.
- Keep "Notes as built" in the current plan and `README.md` up to date as things are built.

## Tech stack

| Layer | Choice |
| --- | --- |
| Language | TypeScript (strict) |
| 2D view | PixiJS (the "unrolled" view of each floor ring) |
| 3D view | Three.js; the main view, reading the same data |
| UI | React, for menus, office visits, overlays, flow diagrams |
| Build | Vite |
| Tests | Vitest, focused on the simulation |

Web first. A move to Godot may come later, so keep the port cheap (see architecture rules).

## Architecture rules

1. **Brain and face.** The simulation (brain) knows nothing about rendering; the views (face) only read sim state and draw it. No DOM, Pixi or React imports inside the sim.
2. **The sim runs in a Web Worker** and posts state snapshots to the main thread. The main thread sends player commands (build, dig, set ordinance) back as messages.
3. **Deterministic ticks.** The sim advances in fixed ticks with a seeded RNG, so runs are reproducible and testable. Real-time speed controls (pause, 1x, 2x, 4x) just change how many ticks run per second.
4. **Data in JSON, not code.** Rooms, crops, resources, events, traits and ordinances live in `data/*.json`. Balancing means editing numbers, not code, and the files carry over to Godot unchanged. No magic numbers in sim code.
5. **One model, two cameras.** 2D and 3D are two views of the same room coordinates.

Layout:

```
src/
  sim/        # pure TypeScript simulation; runs in the worker
  worker/     # worker entry point and message protocol
  render2d/   # PixiJS unrolled and plan views
  render3d/   # Three.js view: rooms, furniture, lights, sky, effects
  view/       # view helpers shared by 2D and 3D (furnishing, grime, labels, font)
  ui/         # React panels and overlays
  audio/      # synthesized sound
  devtools/   # the furnishing tool (?furnish)
data/         # rooms.json, crops.json, condition.json, furniture.json, layouts.json ...
docs/         # design docs, catalogs and milestone plans
scripts/      # furniture models, room status, elevation data, packaging
tests/        # Vitest: sim units plus scripted playthroughs (bots)
```

## Core spatial model

- A hole has a **diameter** and a stack of **floors**, dug by the drill. Each floor has up to 6 **rings** of room slots around the shaft; ring 1 faces the shaft. Only rings 1–3 are open so far.
- A room's position is **(floor, ring, slot)**. Rings are loops with no edges, so slot indices wrap.
- **Slots per ring** grow with radius (room depth d = slot width w = 10 m, shaft radius R):
  `slots(n) = round(2π · (R + (n − 0.5) · d) / w)`
  The starter hole is R = 10 m: rings 1–3 have 9, 16 and 22 slots. Adjacency across rings is by angular overlap.
- **Room footprints** have width (slots), depth (rings) and height (floors). Sizes: S = 1 slot, M = 2, L = 4, H = 8 (H not built yet).
- **Space is dug:** every slot is rock until a room (or an empty room) is excavated there.
- **Access:** a walkway gallery rings the shaft on every floor. Ring 1 rooms open onto it; other rooms need a corridor back to it. **Corridors run along the edges** between rooms (and between rooms and rock), not in slots. People reach floor 1 through the entrance, and deeper floors by stairs and elevators.
- **Neighbor effects** (noise, smell, health, comfort) radiate from rooms with a strength (−3 to +3) and radius in slots, falling off with distance, along the ring, across rings and between floors. Corridors block noise and smell.

## Where things stand (Sep 30, 2026)

Milestones 1–10 are built: one hole growing into a network of two or more, a 3D view (the main one) with 2D and plan views, people with life stages, corridors on edges, construction time, storage, excavation and the entrance, furnished rooms, and room condition with maintenance and cleaning. 1× is 2 ticks a second, 240 ticks a game day. See the README for how to play, `DECISIONS.md` for what was decided while building, and `ROOM-STATUS.md` for what to build next.

Before committing, run `npm test` (unit tests plus scripted playthroughs) and check the change in the browser at http://localhost:5173.
