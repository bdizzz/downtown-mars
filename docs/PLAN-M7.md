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
