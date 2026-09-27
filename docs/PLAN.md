# Milestone 1 plan

Goal: prove the adjacency puzzle is fun inside one hole. Each step ends with something you can run and see.

## Settled defaults (confirmed Sep 27, 2026)

**Tick model**
- 1 game day = 240 ticks (1 tick = 6 game minutes). 1x = 4 ticks/s, so a day takes 60 s; 2x and 4x scale the tick rate. All in `data/config.json`.
- Resources live in one pool per hole (no pathing). Each tick: assign staff by priority tier → run rooms in priority order at `staffing × min(input availability)` → colonist needs → clamp to storage.
- Neighbor effects are a cached per-slot field, rebuilt only when the layout changes. Linear falloff over radius; distance counts ring steps, ring crossings (by angle) and floors. Corridors stop noise and smell.
- Happiness updates every game hour and eases toward its target.
- Deterministic: seeded RNG, no `Date` or `Math.random` in `src/sim`.

**2D unrolled view**
- Floors are horizontal bands stacked downward under a surface strip.
- In each band: gallery strip on top, then rings 1–3; rings 4–6 hatched as locked.
- x-axis is angle (0–360°); every ring spans the same width, so outer slots draw narrower and vertical alignment means real adjacency. Horizontal pan wraps.

**Starter hole:** R = 10 m, rings 1–3 = 9, 16, 22 slots.

**Placement (step 3, Sep 27):**
- Shapes: S 1×1, M 2×1 (along the ring), L 4×1 or 2×2 (wide × deep). No multi-floor rooms in milestone 1.
- A room's anchor is its innermost ring and lowest slot. Deep rooms take every outer-ring slot whose centre falls in their angle range (the wedge), so a 2×2 farm in rings 1–2 uses 2 + 4 slots.
- Access: ring 1 opens onto the gallery; elsewhere a room must touch a corridor that chains back to the gallery. Demolishing a corridor flags stranded rooms instead of deleting them.
- Surface: 12 slots of 30°. Pod and pad take 2, solar takes 1.
- Build costs aren't charged yet; that comes with resources in step 5.

**Digging (step 4, Sep 27):**
- Start with 1 floor dug; the drill immediately works on the next one and keeps going until paused.
- Floor 2 takes 360 ticks (1.5 days, 90 s at 1x); each deeper floor takes 15% longer. Max 40 floors.
- Rock comes out gradually: 1 per unlocked ring slot per floor (47 for the starter hole).
- The floor being dug can hold blueprints, which switch on when it's done.

**Gap fills:** Earth supply drops bring colonists and soil; the pod's starter drill digs slowly, costing time and yielding rock.

## Steps

1. **Scaffold.** Vite + TS + React + Pixi; sim ticking in a worker; HUD with game clock and pause/1x/2x/4x; Pixi canvas showing the snapshot. *See:* the clock running at each speed.
2. **Hole geometry and the unrolled view.** Slot math, angular overlap, floors/rings drawn in Pixi with pan and wrap. *See:* an empty hole you can scroll around.
3. **Room data and placement.** `data/rooms.json` for the starter rooms; place/remove commands with footprint, overlap and access checks; ghost preview in the view. *See:* rooms placed and rejected with reasons.
4. **Digging.** Starter drill digs new floors over time, yielding rock. *See:* the hole grow downward.
5. **Resources and colonists.** Resource pools, room production, colonist needs, storage, staffing. HUD resource bar. *See:* the 20-colonist start survive (or not).
6. **Earth supply drops.** Scheduled drops of rations, water, O2, materials, soil and colonists. *See:* the gap-filling and population growth.
7. **Neighbor effects and overlays.** Effect field, noise/health/comfort heat maps. *See:* life support's noise halo.
8. **Happiness.** Per-housing pools easing toward target; productivity penalty. *See:* happiness react to layout.
9. **Office visits.** Notables and a simple visit queue, starting with the noise complaint. *See:* a visit with choices.
10. **Balance pass and tests.** Tune the start so it plays like "First 30 minutes."
