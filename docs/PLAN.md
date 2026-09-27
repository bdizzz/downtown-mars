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
- A room's anchor is its innermost ring and lowest slot. Deep rooms take every outer-ring slot whose centre falls in their angle range (the wedge), so a 2×2 farm in rings 1–2 uses 2 + 3 or 4 slots.
- Access: ring 1 opens onto the gallery; elsewhere a room must touch a corridor that chains back to the gallery. Demolishing a corridor flags stranded rooms instead of deleting them.
- Surface: 12 slots of 30°. Pod and pad take 2, solar takes 1.
- Build costs aren't charged yet; that comes with resources in step 5.

**Digging (step 4, Sep 27):**
- Start with 1 floor dug; the drill immediately works on the next one and keeps going until paused.
- Floor 2 takes 360 ticks (1.5 days, 90 s at 1x); each deeper floor takes 15% longer. Max 40 floors.
- Rock comes out gradually: 1 per unlocked ring slot per floor (47 for the starter hole).
- The floor being dug can hold blueprints, which switch on when it's done.

**Resources and colonists (step 5, Sep 27):**
- One pool per resource with a capacity: the pod's base storage (`data/resources.json`) plus tanks and batteries. Overflow is lost at the end of each tick.
- Each tick: staff rooms by priority → run pure producers (solar) → run other rooms by priority at `staffing × scarcest input`, throttled when a non-waste output is full → colonists eat, drink, breathe → cap storage.
- Power is a flow; only batteries carry it between ticks. No day/night solar curve yet.
- Galley turns raw food, or Earth rations when there is none, into meals. Colonists eat meals.
- Life support scrubs CO2 only above a reserve of 10, which farms draw on.
- Restrooms return drunk water as 75% gray, 25% black, for up to 25 users each.
- Health (0–100, hole-wide) falls with unmet oxygen, water, meals, sanitation or CO2 over 100, and recovers when all is well. No deaths in milestone 1.
- Deep rooms scale staff, inputs and outputs by slots covered ÷ nominal slots.
- Farms pick a crop (`data/crops.json`); switching is instant for now (no grow cycle).
- Build costs are charged on placement; demolish refunds 50%, blueprints 100%.
- Starting stock (5 days for 20): rations 100, water 240, O2 120, soil 40, rock 60, brick 20, metal 60, machinery 10, electronics 10. The critical set is affordable on day 1; tier 2 needs Earth drops and digging.
- Gray and black water use the pod's small built-in tanks; choosing a water tank's type is deferred.

**Earth supply drops (step 6, Sep 27):**
- First drop on day 3, then every 4 days. Needs a staffed, powered landing pad; otherwise it holds in orbit and retries every quarter day.
- Contents: colonists first (up to 8, limited by free beds), then food, water and O2 topped up to cover the hole's daily shortfall for 5 days (interval + 1), then a fixed bundle: metal 25, brick 10, machinery 3, electronics 3, soil 15.
- Drops shrink on their own as farms, the recycler and life support close the gaps.
- 15% chance a drop is delayed a day ("Delayed supply drop" from EVENTS.md), at most once per drop, using the seeded RNG.
- Per-day rates are measured before drops land, so they show the hole's own balance.
- Messages (landings, delays, waiting) show over the view and fade after a game day.

**Neighbor effects (step 7, Sep 27):**
- Built rooms (not blueprints) radiate each effect from their own cells. One step = along the ring, across rings by angle, or straight up/down a floor.
- Falloff: strength × (1 − distance / (radius + 1)), zero past the radius. Sources add.
- Corridors take noise and smell but don't pass them on; other effects go through.
- Effects marked residentsOnly (the dorm's comfort −1) are for the room's own residents, handled with happiness in step 8.
- Surface rooms don't radiate into the hole.
- The field is recomputed only when the layout changes; the worker sends layout and field only when they change.
- Overlays: noise, smell, health, comfort. Red hurts, green helps, full colour at ±3.

**Happiness (step 8, Sep 27):**
- Each housing room (pod, dorms) is a pool. Colonists fill the homes with the best target first; anyone without a bed is homeless (comfort −3).
- Three factors, each clamped to −3..+3, averaged over the home's cells:
  - Noise: the noise field.
  - Comfort: the room's own residents-only comfort (dorm −1) + shaft view (+1 in ring 1) + comfort field + smell field.
  - Health: health field + needs (0 at full health, −3 at none) + clinic coverage (−1 when no clinic covers anyone).
- Target = 60 + 8 × (noise + comfort + health), clamped 0–100. Updated every game hour, easing toward the target over about a day.
- Productivity: below 50 average happiness, staffed rooms slow linearly, to 75% at 0.
- The starting pod sits at about 52, so a noisy or unserved hole tips below 50 quickly.

**Office visits (step 9, Sep 27):**
- Notables: 6 at the start and 1 more with each drop that brings colonists (max 20), from `data/notables.json`. Each has a role, two different traits and loyalty 0–100 (start 50). Traits and roles are flavour for now, except that clinic demands come from a doctor when there is one.
- Visits live in `data/visits.json` (text, choices, outcomes); triggers live in `src/sim/visits.ts`. Checked every game hour, one of each kind waiting at a time, with cooldowns and a 3-person waiting room.
  - Noise complaint: a lived-in home with noise at −1 or worse. Promise a fix within 3 days, enact Quiet hours, or refuse.
  - Clinic demand: from day 4 if there's no clinic. Promise one within 5 days, or refuse.
- Promises are checked every hour and settle early when kept. Kept or broken changes loyalty and happiness.
- Unanswered visitors leave after 2 days with a loyalty and happiness penalty.
- Ordinances (`data/ordinances.json`): Quiet hours, Water rationing, Ration cards. Slots from the biggest working admin room: the pod's desk 1, admin office 2. Effects apply at once (no settling-in period yet) and repealing has no penalty yet.

**Balance pass (step 10, Sep 27):**
- `tests/playthrough.test.ts` scripts a first month: the critical set on day 1, tier 2 as drops and digging pay for it, then homes, galleys, restrooms, tanks, solar and life support as people arrive, answering visits along the way. `npm run playtest` prints a daily table.
- Result: critical set day 0, tier 2 done by day 7, 50 colonists on day 19, health 95–100 all month, happiness 50–61, CO2 steady.
- Fixes it found: farms stopped when oxygen was full (a full byproduct no longer stops a room; only all main outputs being full does), and life support stopped scrubbing CO2 when oxygen was full (it now runs for scrubbing alone and vents the oxygen).
- Tuned: colonists per drop 8 → 6, so 50 arrives around day 19–23 (the docs' "minutes 20–30" at 1x).
- Learned: metal from Earth (25 per drop) paces tier 2; every ~25 colonists need another galley and restroom; one life support carries about 30; a hole past 50 needs 2–3 water tanks to bridge the 4 days between drops; tier 2 plus growth needs a third solar array.

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
