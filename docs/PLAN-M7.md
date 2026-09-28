# Milestone 7 plan: construction time

Goal: building takes time. Every room and corridor goes into a hole's construction queue and is built one job at a time, at a pace set by the hole's construction bandwidth. Construction offices raise that bandwidth, so where and when you invest in them becomes a real decision.

Decided Sep 27, 2026 (Bryon):
- **Queue and bandwidth:** without a construction office, a hole builds one room at a time, slowly. Each room has its own base construction time: larger rooms and mid- and late-game rooms take longer.
- **Offices:** construction offices come in a few sizes, and each adds bandwidth. Jobs are still built one at a time, in the order they were committed, but faster. Offices take staff, and their staffing scales what they add.
- **Priority construction:** moves a queued job to the front.
- **Corridors** sit in the same queue, with a time set by their length, generally less than a room.
- A later milestone speeds construction up for large holes (sketched at the end).

## Shape of the change

- **A queue per hole:** `construction: { queue, nextJobId }` on each hole. A job is a room, or a set of corridor segments committed together (one click or one confirmed chain). Each job has the work it needs, in work-hours, and the work done so far.
- **Bandwidth:** work-hours per game hour. Each tick, the bandwidth goes to the first job in the queue that can be worked, and any left over goes to the next. A blueprint on a floor still being dug can't be worked yet, so it doesn't hold up the jobs behind it.
- **Under construction:** a room holds its slots from the moment it's committed but doesn't run, radiate effects or count as walkable until it's done. A corridor under construction doesn't join the network until done. Stairs and elevator extensions wait as pending pieces, and the new floors link when they're built.
- **Money up front:** paid on commit, as now. Cancelling a queued job (demolish, undo, or erasing a corridor that isn't built yet) refunds it in full.
- **All numbers in `data/construction.json` and `data/rooms.json`.** A sandbox `instant` switch builds everything at once. The unit tests use it; the playthroughs don't.

## Defaults (chosen, not yet confirmed)

- **Work per room, by size:** S 6 hours, M 12, L 24, H 48; surface buildings 12. Mid- and late-game rooms take longer (`buildHours` in `data/rooms.json`), for example:

  | Room | Hours |
  | --- | --- |
  | Life support | 30 |
  | Water recycler | 30 |
  | Smelter | 36 |
  | Silicon refinery | 40 |
  | Electronics fab | 30 |
  | Stairwell piece | 8 |

- **Corridors:** 1.5 work-hours per 10 m.
- **Base bandwidth without an office:** 1 work-hour per hour. A new colony's critical set (galley, restroom, dorm, tank, life support) is 60 work-hours, about 2.5 days. The pod's starting oxygen lasts about 6.
- **Construction offices:**

  | Office | Size | Staff | Bandwidth | Cost |
  | --- | --- | --- | --- | --- |
  | Site office | S | 2 | +1 | rock 10, metal 5 |
  | Construction office | M | 4 | +2.5 | brick 15, metal 10, machinery 1 |
  | Construction yard | L | 8 | +5 | brick 30, metal 20, machinery 3 |

  Each adds its bandwidth scaled by how it's running (staffing × morale).
- **Filling a corridor in stays instant** (it still costs its finish). It could join the queue later if that feels wrong.

## Steps

1. **The queue.**
   - Jobs for rooms, corridors and stair or elevator pieces.
   - Bandwidth and working the queue.
   - Rooms and corridors under construction held but inactive.
   - Cancel with a full refund, and a priority command.
   - The `instant` switch, and save v13 (existing rooms and corridors are built).

   Tests. *See:* the game runs; things take time to build.
2. **Construction offices.** Three sizes and their bandwidth, scaled by staffing. *See:* an office speeds the queue up.
3. **Construction in the UI.**
   - Scaffolding on rooms and corridors under construction in all three views, with progress.
   - The Inspector: progress, place in the queue, time left, Priority construction, Cancel.
   - A Construction panel listing the queue, and a HUD chip ("Building 3 · 5 h").
   - Time estimates on room cards and in the corridor confirm popup.

   *See:* watch a queue work through.
4. **Balance and tests.** The scripted players build a site office early and reorder urgent jobs (life support first). Playthroughs are checked and tuned. *See:* playthroughs pass with construction time.

## Later: construction at scale (a future milestone)

Large holes build a lot, far from the queue's first days. Ideas for speeding construction up as a hole grows, to pick from when we get there:
- **Parallel crews:** the Construction yard, and later a Construction HQ, can work on two or three jobs at once, each crew with its own share of bandwidth. The queue stays in order; crews take the next jobs.
- **Prefab works:** an industry room that turns metal, brick and marscrete into prefab modules. Rooms built with modules take half the work-hours, so the queue trades raw materials for time.
- **Tunnelling machine:** a big surface or shaft purchase that cuts corridor work to a fraction and speeds up digging new floors.
- **Local depots:** a small room per band of floors that shortens work on nearby floors, so deep construction isn't slowed by hauling from the top.
- **Skills:** construction workers get faster with experience (tied to the skills that elders mentor), and apprenticeships speed it up.
- **Network help:** a friendly hole can lend construction crews by rover, and Allied holes do it at cost.
- **Research and ordinances:** "Construction overtime" (already in DESIGN.md: build speed up, crews tire) and research that improves bandwidth per worker.

## Notes as built
**Step 1, the queue:** `src/sim/construction.ts`.
- **Jobs:** each hole has `construction: { queue, nextJobId }`. A job is a room, a set of corridor segments committed together, or a stair or elevator extension, with its work and progress in work-hours.
- **Working the queue:** each tick, bandwidth (work-hours per game hour; base 1) goes to the first workable job and any left over to the next. A blueprint waiting on a floor still being dug is skipped.
- **Work needed:** rooms take their size's hours or `buildHours` from `data/rooms.json`. Corridors take 1.5 h per 10 m.
- **Under construction:**
  - A room is `building`: it holds its slots, isn't active, doesn't radiate, and a public one isn't walkable.
  - Corridors are in `corridorsBuilding` and don't link.
  - A stair or elevator extension's new cells wait in `pendingCells`, and join the stack (and its floors link) when built.
- **Finishing:** a finished room or extension posts "Galley built." (or "extended").
- **Cancelling** refunds in full: demolishing or undoing a room still in the queue, or filling in a corridor not yet built. A stack's pending pieces go with it when demolished.
- **Commands:** `prioritize` moves a job to the front.
- **Sandbox switch:** `data/construction.json` has an `instant` switch. The test setup turns it on for unit tests; `withConstructionTime()` turns it off where construction is under test.
- **Save version 13:** everything already there is built.
- **Tests:** held but inactive, one at a time in order, priority, refunds, blueprints not blocking, corridor jobs by length that link when built, stair extensions, base bandwidth, the queue in saves.

**Step 2, construction offices:** three rooms in a new Construction group, each with a glyph:

| Office | Size | Staff | Power | Bandwidth | Noise | Cost | Work |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Site office | S | 2 | 1 | +1 | — | rock 10, metal 5 | 6 h |
| Construction office | M | 4 | 1 | +2.5 | −1 r1 | brick 15, metal 10, machinery 1 | 12 h |
| Construction yard | L | 8 | 2 | +5 | −2 r1 | brick 30, metal 20, machinery 3 | 30 h |

Each adds `constructionBandwidth` times its running rate (staffing × morale), so a paused or understaffed office adds less or nothing, and one still being built adds nothing. Tested: bandwidth by size and staffing, a paused office, and an office at least doubling progress on the same job.

**Step 3, construction in the UI:**
- **Snapshot:** it carries the queue (`queueView`): bandwidth, then each job's label, progress, work and hours until done, counting the jobs ahead of it (null while it waits for its floor to be dug).
- **Unrolled view:** rooms under construction are faint with scaffolding (poles and planks) and an orange outline, with a progress bar that updates on its own layer. Stairs or elevator floors waiting to be built show as scaffolding too. Corridors under construction are faint with orange tape along their edges, and get no doors yet.
- **Plan view:** the same faint fill with orange outlines, for rooms, waiting stair floors and corridors.
- **3D view:** rooms under construction are see-through like blueprints, and so are corridors being built.
- **Inspector:** "Under construction", with a progress bar, "45% · 2nd in the queue · done in about 3 h" (or "waits for its floor to be dug"), Priority construction when it isn't first, and "Cancel construction (full refund)" instead of Demolish.
- **Construction panel** (HUD): bandwidth, then the queue in order with progress bars, time left and a move-to-front button. Clicking a room selects it. The HUD button reads "🏗 2 · 10.8 h" while there's a queue.
- **Estimates:** room cards show work-hours to build and the bandwidth an office adds. The corridor confirm popup shows the construction work.
- **Browser check:** a site office and a water tank queued in the dev save, with scaffolding, the office's bar filling, and the panel's times.

**Step 4, balance and tests:**
- **Scripted players:** the playthrough tests (first month, first hour with two holes, 90 days of people, tutorial goals) now run with construction time; unit tests stay instant. The scripted players now:
  - build a site office right after the critical set, in both holes;
  - push a queued life support to the front when air is short;
  - put up a construction office when the queue backs up past a day of work;
  - build only essentials (air, crews) past three days of backlog.
- **Results** (seed 42):
  - First month: health stays at 92–100, and oxygen dips to 71 on day 3 while life support is being built, then recovers.
  - 90 days: the network reaches 187 against 132 solo (+42%), with 24 births.
  - The child hole's health dips into the high 50s around days 80–90 as it grows, and recovers.
- **Bounds:** child health above 50 (was 60), and 160+ colonists at day 80 (was 170).

**Follow-ups (Bryon, Sep 27):**
- **Corridors through rock** (reverses "only next to a room"): a corridor may run along any border in a dug floor (or the one being dug) and the unlocked rings, with rock on both sides if need be. Borders touching a locked ring are refused, including the outer edge of the last unlocked ring ("Ring 4+ needs reinforcement frames"). The middle of a room is still off limits. Connect can now dig through rock to reach any room.
- **Filling in takes construction time:** filling a corridor in (paid on commit, as before) is now a queue job ("Filling in corridors (n segments)"), by length like carving. The corridor stays in use, taped in orange, until the job is done. Hovering a corridor already queued to be filled in says so.
- **Cancel from the queue:** a new `cancelJob` command, and a ✕ on every job in the Construction panel, take any job out of the queue with a full refund. A room is removed, corridors not yet carved are dropped, a fill-in leaves the corridor where it was, and a waiting stair floor is let go.
- **Construction look:** rooms under construction, and stair or elevator floors waiting to be built, now show semi-opaque diagonal hazard stripes (orange over dark) over the room's faint colour, with the % done.
  - **Unrolled and plan views:** the stripes are a shared Pixi fill pattern. The % sits on a label layer that updates as the crews work, and the unrolled view keeps its progress bar.
  - **3D:** room geometry now carries texture coordinates taken from position, so a striped material tiles across walls and floors. A "45%" label floats over each room under construction.
  - **Browser check:** a construction office in the dev save at 32% (unrolled) and 33% (3D).
