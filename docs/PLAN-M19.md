# Milestone 19 plan: equal-area rings

Goal: every slot on every ring is the same area, so a room is the same size wherever it's built, and each room is sized to what it actually holds. Feature #545 ([#545](https://github.com/bdizzz/downtown-mars/issues/545)), which replaces #109 (rooms by area, PR #95). The numbers behind it are in `docs/ROOM-AREAS.md`.

## Why

A slot is an equal share of a ring, and every ring is 10 m deep, so a slot's area grows with its ring: about 105, 175 and 122 m² on rings 1–3 (9, 9 and 18 slots). A room keeps its slot count on every ring, so it's 1.67× bigger on ring 2 than on ring 1, and its furniture doesn't grow to match. On top of that, many rooms are too big for their job on any ring: the bunk dorm sleeps 16 in 193–321 m², where about 95 would do.

PR #95 fixed the ring difference by dropping slots for free angles. That cost the shared grid: room ends stopped lining up across rings, gaps between rooms needed fill rooms to close, and placing took several steps. Every S room also stayed at 100 m², so most of the emptiness remained (`ROOM-AREAS.md`, section 2). This plan keeps the grid and changes the rings instead.

## Decided (Bryon, Nov 19)

- **Keep slots.** Rooms take whole slots, and the grid's crossings stay.
- **Change ring depth, not slot shape:** each ring is as deep as it needs to be for its slots to match a ring-1 slot's area.
- **Rings 1–3 at 9, 18 and 18 slots** (option C in `ROOM-AREAS.md`, section 5).
- **Rooms are sized from an ideal area:** what the room does and the furniture it shows, rounded to whole slots.
- **Rooms smaller than a slot get busier templates**, not split slots or plant rooms.

## Design

### Rings

Each ring's slot count comes from data, and its depth from the slot area. With a shaft of radius R and a ring-1 slot area A = π((R + d₁)² − R²) / n₁, ring k's outer radius is r_k = √(r_{k−1}² + n_k · A / π).

| Ring | Slots | Radii (m) | Depth (m) | Slot area (m²) | Slot width × depth (m) |
| --- | --- | --- | --- | --- | --- |
| 1 | 9 | 10–20 | 10.0 | 105 | 10.5 × 10.0 |
| 2 | 18 | 20–31.6 | 11.6 | 105 | 9.0 × 11.6 |
| 3 | 18 | 31.6–40 | 8.4 | 105 | 12.5 × 8.4 |
| 4 | 36 | 40–52.9 | 12.9 | 105 | 8.1 × 12.9 |
| 5 | 36 | 52.9–63.2 | 10.3 | 105 | 10.1 × 10.3 |
| 6 | 36 | 63.2–72.1 | 8.9 | 105 | 11.8 × 8.9 |

- **Config:** `geometry.ringSlots` (`[9, 18, 18, 36, 36, 36]`) and `geometry.equalAreaRings: true` replace `pairedRings` and `nestedPairs`. `roomDepthM` stays as ring 1's depth, which sets A. Rings 4–6 are just data for now; they stay locked.
- **The hole carries its radii:** `hole.ringRadiiM[k]` is circle k's radius (circle 0 is the shaft wall), built in `createHole` alongside `ringSlots`. `ringRadii(hole, ring)` in `render3d/cylinder.ts` already exists. It moves to `sim/geometry.ts` and reads the hole, and every use of `roomDepthM` / `RING_D` (about 70 across 25 files: `edges.ts`, `deadEnds.ts`, `air.ts`, `paths.ts`, `windows.ts`, `corridors.ts`, the 3D and 2D views, `walk.ts`, `doors.ts`, `furnish.ts`, the bridge) goes through it. Godot gets its geometry from the bridge, except `Scenery.cs`.
- **What follows from it:**
  - Neighbour effects keep their radius in slots. Along ring 2, a slot step is now 9 m rather than 17.5 m, closer to ring 1's 10.5 m.
  - Digging yields stay per slot. All slots are now the same area, so yields come out fair per m² (ring 2 used to yield less than its share).
  - The air volume (`air.ts`) comes from the real radii.
  - The unrolled 2D view keeps equal angle per ring and draws each ring at its own depth.

### Rooms

- **Footprint per room:** `rooms.json` gets each room's width in slots (`w`: 1, 2, 3 or 4). The size class (`S`/`M`/`L`/`H`) stays as the tier for build hours, repairs and so on (`construction.hoursBySize`, `condition.repairHoursBySize`). It's re-picked from the new width (1 → S, 2–3 → M, 4 → L). Deep shapes stay as data in `config.shapes`.
- **Output scales by the room's own footprint:** `economy.ts` and `temperature.ts` divide a room's cells by its own standard footprint (its `w` × depth), not by `nominalSlots` per size. A standard room always does exactly what `rooms.json` says.
- **The new widths** come from the ring-1 column of the table in `ROOM-AREAS.md`, section 4, rounded and reviewed by Bryon in the task's PR. In short:
  - **Down a size:** bunk dorm, kitchen, canteen, electrolyzer, deep-well pump, heating plant, admin office, composter, crypt, maintenance, cleaning service, construction office.
  - **Up to 3 slots:** park, water recycler, CO2 scrubber, recycling centre, excavator bay.
  - Most other rooms stay as they are.
- **Templates** for every new shape (`bunk_dorm:1x1`, `park:3x1`, …), made in the furnishing tool (`?furnish`) from the nearest existing one.

### Busier templates

Rooms whose job is smaller than a slot keep one slot and get templates that fill it believably:
- **A core:** the furniture that does the job, the same on every ring.
- **Fillers:** furniture that fits the job and repeats with a high or no `max`, until about 25% of the floor is covered. Open rooms (plazas, the park) aim for 15–20%.

`ROOM-AREAS.md` lists each room's shortfall and filler ideas. New furniture models go through `scripts/furniture.mjs`.

### Saves

One migration, in step 2, with a version bump:
- **Ring 2's slots double:** a room at slot s, width w becomes slot 2s, width 2w (same angles, same place). Radial edge ids on ring 2 double their index (`R{floor}.2.{i}` → `.{2i}`). Arc pieces on circle 1 (between rings 1 and 2) are cut at the new ring-2 boundaries, so a corridor on one old piece becomes two with the same finish and jobs. Circle 2's cuts don't change. Bulkheads, windows, doors and construction jobs follow their edges.
- **Rooms bigger than their standard footprint shrink in place** to it, keeping the end with their door. The freed slots stay dug as empty space. (Open question 1.) Step 3 reuses the same rule when room widths change.
- **The ring-2/3 boundary moves out** from 30 m to 31.6 m. Ring 3's rooms get shallower and refit their furniture by themselves.
- The dev saves in `public/` are migrated and re-saved at the new version in step 2, then regrown from scratch in step 4.

## Steps

Each is one PR and leaves the game working.

1. **Per-ring radii on the hole** (M). `hole.ringRadiiM` and `ringRadii` in `sim/geometry.ts`, with every fixed-depth use moved over: sim, 3D, 2D, bridge, Godot's scenery. Still 10 m each, so nothing changes on screen. Tests check that each ring's radii match today's.
2. **Equal-area rings at 9-18-18** (L, breaking save). `geometry.ringSlots` and `equalAreaRings` in data; the migration above; dev saves re-saved; the landing kits re-placed (ring 2 slot numbers double); playthrough bars checked. Docs: `CLAUDE.md` core spatial model, `DESIGN.md`, `DECISIONS.md`, `GUIDE.md`.
3. **Rooms sized by ideal area** (L). Widths in `rooms.json`, 3-slot rooms, output by own footprint, size classes re-picked, templates for the new shapes, existing rooms shrunk, `ROOMS.md` updated, playthroughs and balance checked.
4. **Rebuild the dev saves** (M). Steps 2 and 3 only migrate the dev saves, so they're old layouts squeezed onto the new grid. This step regrows them:
   - Lay out the network bot's opening plans and the landing kits for 9-18-18 and the new room sizes. They still name grid slots (`tests/adaptive.ts`, `tests/netbot.ts`, `config.landingKits`).
   - Rerun `npm run saves`, and check with `--probe` that the moments in `src/ui/devGames.ts` (early, mid, network, late) still land on healthy, interesting games, moving the days if not.
   - Keep one save at the old version as a fixture, so the migration stays tested (`tests/devSaves.test.ts`).
   - Retake any README or GUIDE screenshots taken from them.

   It comes before the template passes so those can be checked on grown games.
5. **Busier templates, utilities and services** (M). Heater, radiator, ventilation hub, gas tank, battery bank, storeroom, waste storage, site office, cleaning service, maintenance.
6. **Busier templates, the rest** (M). Kitchen, hospital, gym, machine shop, brickworks, glassworks, crypt, restroom, stairs and elevators, plazas and the park.

## Open questions

1. **Old rooms bigger than their new footprint** (any ring-2 room, since its slots doubled; a dorm going from 2 to 1). My default: shrink in place and leave the freed slots as dug empty space, a small gift of room to build. The alternative: keep them as they are, roomier, working as their standard size.
2. **Density.** Smaller rooms fit more per floor (16 in one dorm slot), so a floor supports more people. My default: accept it and retune the playthrough bars. The alternative: raise those rooms' costs.
3. **Deep shapes (2×2).** A deep room over rings 1–2 now covers 6 slots (2 + 4) and makes 1.5×, as a 2×2 over rings 2–3 already does. Keep it as today?
4. **PR #95 and #109.** Once this is agreed: close PR #95, and drop #109 and its tasks (#164–#175) as not planned?

## Notes as built

(None yet.)
