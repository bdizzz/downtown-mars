# Downtown Mars — project guide

*Hole sweet hole.*

A real-time city builder on Mars. Each city is a **borehole**: you dig a shaft down, carve rooms into its walls in rings and floors, and grow a network of holes across the planet whose cultures drift apart. Two layers, one idea: proximity creates effects. Rooms affect neighboring rooms inside a hole; holes affect each other across the map.

Vibe: SimCity, SimTower and Terraforming Mars, with some of Frostpunk's social tension but chill rather than crushing. Sandbox mode; total supported population is the high score.

## Design documents (in `docs/`)

| File | What it holds |
| --- | --- |
| `DECISIONS.md` | Condensed decision log: key decisions, reversals not to revive, stale sections, open questions. Read this first. |
| `DESIGN.md` | Main design doc: borehole, rings, corridors, shapes, frontage, economy, culture, network, ordinances, story, tech plan. |
| `ROOMS.md` | Room catalog: every room's size, staff, inputs, outputs, effects, cost and unlock; size ladders; crops; material substitution. |
| `PATHWAYS.md` | Each resource family traced from source to users, with the rooms involved. |
| `EVENTS.md` | Event catalog: citizen visits, strike chain, hazards, discoveries, network, Earth and belt, story and notable events. |

**When documents disagree:** `DECISIONS.md` wins, then the catalogs (`ROOMS.md`, `EVENTS.md`, `PATHWAYS.md`), then `DESIGN.md`. A few early sections of `DESIGN.md` are stale; `DECISIONS.md` lists them.

## Working with Bryon

- Friendly, brief, conversational. Explain technical ideas concisely, ideally with an analogy.
- Ask 1–2 focused questions up front rather than long back-and-forth.
- When a design question comes up that the docs don't answer, propose a sensible default and ask, rather than inventing silently. Several areas are deliberately undecided (simulation tick model, build-mode UI, art and audio, mid- and late-game balance, roadmap); see "Still open" in `docs/DECISIONS.md`.

## Tech stack

| Layer | Choice |
| --- | --- |
| Language | TypeScript (strict) |
| 2D view | PixiJS (the "unrolled" view of each floor ring) |
| 3D view | Three.js, later; reads the same data |
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

Suggested layout:

```
src/
  sim/        # pure TypeScript simulation; runs in the worker
  worker/     # worker entry point and message protocol
  render2d/   # PixiJS unrolled view
  ui/         # React panels and overlays
data/         # rooms.json, crops.json, resources.json, events.json ...
docs/         # DESIGN.md and other design exports
tests/
```

## Core spatial model

- A hole has a **diameter** and a stack of **floors**. Each floor has up to 6 **rings** of room slots around the shaft; ring 1 faces the shaft.
- A room's position is **(floor, ring, slot)**. Rings are loops with no edges, so slot indices wrap.
- **Slots per ring** grow with radius. Starting formula (room depth d = slot width w = 10 m, shaft radius R):
  `slots(n) = round(2π · (R + (n − 0.5) · d) / w)`
  Narrow hole (R = 10 m): ring 1 ≈ 9, ring 3 ≈ 22, ring 6 ≈ 40. Wide hole (R = 40 m): 28, 41, 60.
  Because outer rings have more slots, slot indices in different rings don't line up one-to-one; adjacency across rings is by angular overlap.
- **Room footprints** have width (slots), depth (rings) and height (floors). Sizes: S = 1 slot, M = 2, L = 4, H = 8. Most L/H rooms choose their shape; a few have fixed minimums (see DESIGN.md, Room shapes).
- **Access:** a walkway gallery rings the shaft on every floor. Every room needs one side touching the gallery, a corridor or a plaza. Corridors are 1-slot rooms (spokes run outward, ring segments run around).
- **Neighbor effects** (noise, smell, health, comfort, air quality, heat, safety) radiate from rooms with a strength (−3 to +3) and radius in slots, falling off with distance, along the ring, across rings and between floors. Corridors block noise and smell.

## Milestone 1: first playable version

Goal: prove the adjacency puzzle is fun inside one hole.

- One hole, one diameter, 2D unrolled view only, real time with pause.
- Resources: water, food, electricity, rock (plus oxygen, since life support is in scope).
- Happiness from three factors: noise, health, comfort.
- Office visits from notables (simple version).
- Starts with 20 colonists and a landing pod (temporary housing for 20).

Starter rooms (★ rooms from the catalog; numbers are per game day):

| Room | Size | Staff | Uses | Makes | Neighbor effects | Build cost |
| --- | --- | --- | --- | --- | --- | --- |
| Bunk dorm | M | 0 | Power 1 | Houses 16 | Comfort −1 (own residents) | Rock 20 |
| Galley | S | 2 | Raw food or rations 25, water 2, power 2 | Cooks and serves 25; organic waste 2 | Smell −1 r1 | Rock 10, metal 5 |
| Farm | L | 6 | Water 4, soil 2, power 3, CO2 2 | Raw food 12 (potatoes) or 8 (soybeans), O2 2 | Smell −1 r1 | Rock 30, metal 10, machinery 2 |
| Water tank | S | 0 | — | Stores 200 water | — | Rock 10, metal 5 |
| Water recycler | L | 3 | Gray water 40, power 3 | Clean water 36, solid waste 1 | Noise −1 r1, smell −1 r1 | Metal 20, machinery 4 |
| Restroom | S | 1 | Users' water | Sanitation for 25; returns used water as 75% gray, 25% black | Smell −1 r1 | Rock 8, metal 2 |
| Life support | L | 4 | Water 6, power 5 | O2 30, removes CO2 30 | Noise −2 r2 | Metal 25, machinery 5, electronics 2 |
| Clinic | S | 2 | Power 1, water 1 | Care for 50 | Health +2 r2 | Brick 10, metal 5, electronics 1 |
| Admin office | M | 2 | Power 1 | Citizen visits, ordinances | — | Rock 10, brick 5 |
| Solar array | Surface | 1 | — | Power 10 (less in dust storms) | — | Metal 10, electronics 4 |
| Battery bank | S | 0 | — | Stores 50 power | — | Metal 5, electronics 5 |

Per colonist per day: 1 cooked food, 2 clean water, 1 oxygen; produces 1 CO2 and 1 solid waste.

Early game, Earth supply drops cover food rations, water, spare oxygen and materials the hole can't make yet (metal, machinery, electronics). The starter budget is designed so 20 colonists survive on the critical set (dorm, life support, water tank, restroom, galley) while power runs nearly full and water leans on Earth until the recycler is built.

## Suggested first steps

1. Scaffold the Vite + TypeScript + React + Pixi project and the worker message protocol.
2. Build the sim core: hole geometry, slot math, room placement with footprint and access checks.
3. Load starter rooms from `data/rooms.json` and run resource flows per tick.
4. Add neighbor effects and a noise/health/comfort overlay in the 2D view.
5. Unit-test the sim (placement rules, slot math, resource balance for the 20-colonist start).
