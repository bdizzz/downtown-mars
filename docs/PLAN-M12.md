# Milestone 12 plan: finishing the sealed hole, and the dome

Goal: close the loose ends of milestone 11 and build its sequel: sealed bulkheads, Mars dust coming in through the airlock, crowded homes going stuffy, window walls where no tube runs, and the shaft dome, a hole's end goal, with glass to build it from.

Asked for by Bryon, Sep 30, 2026 ("let's do all that", after PLAN-M11's "not built yet" list). The defaults below are Claude's, flagged so they're easy to change; every number is in data.

## Defaults (to confirm or change)

- **Bulkheads:** an upgrade on a built corridor segment (not a gallery tube): a sealed door that people pass through but air and smell don't. A **Bulkhead** button beside the corridor finishes turns the corridor tool into a bulkhead tool: click a corridor to fit one, Shift-click to take it out. Costs 2 metal, fitted at once. Taking it out is free.
- **Dust:** the entrance's airlock (and a cargo elevator's) brings in Mars dust: air quality −1 by the airborne rules (3 steps along the network), twice as bad in a dust storm.
- **Crowding:** people packed into a home foul its air: each resident past 4 per cell costs the home 0.15 air quality (a full bunk dorm, 8 per cell: −0.6). Felt in the home only, as health.
- **Window walls:** a ring-1 room with no tube in front of it gets windows from just above the floor to just below the ceiling, not the usual band. Dug-out space and walk-through rooms on ring 1 with no tube are walled off from the shaft in every view.
- **Glass:** a new dry good. The **glassworks** (catalog: M, 3 staff, rock 4 and power 4 → glass 2, heat +1 r1, from 200 colonists) makes it.
- **The dome:** a one-off project per hole, from Build (Public). Needs 300 colonists. Costs glass 200, metal 120, machinery 20, electronics 10; 240 work-hours. Once built:
  - every floor's gallery is open walkway: every ring-1 room's shaft side counts as a built tube, and nothing needs laying;
  - the shaft is an atrium: +0.5 comfort for every shaft-facing room (on top of its view);
  - the shaft is one big shared air volume: air quality +0.5 everywhere (the baseline), and the airlock's dust no longer gets worse in a storm (the dome's airlock is better sealed);
  - dust storms no longer blow down the shaft (in 3D: no grit below the rim);
  - a glass dome over the shaft in 3D, and the hole's name carries a ◓ in the network panel and hole list.

## Steps

1. **Window walls and walls to the shaft.** Rooms3d, 2D and plan.
2. **Bulkheads.** Sim (air graph), tool, views.
3. **Dust through the airlock.** Effects keyed by storm as well as layout.
4. **Crowding.** Happiness and the home card.
5. **Glass and the glassworks.** Resource, room, furniture, glyph.
6. **The dome.** Construction job, its effects in sim, UI and 3D.
7. **Docs and bots.**

## Notes as built

**Step 1, window walls and walls to the shaft:**
- `tubeAt` / `tubeAtAngle` (`view/gallery.ts`): is a tube (built or being built) along a ring-1 slot.
- 3D: a ring-1 room's shaft face has the usual window band behind a tube, and a window wall (0.35 m to 3.55 m) with none (`WINDOW_WALL`). Dug-out empty space opens onto the shaft only with a tube; otherwise the shaft wall stands. Walk-through rooms were already walled off without one (M11).
- 2D: tall windows where no tube runs; ring-1 walk-through rooms open onto the shaft band only along tubes. Plan: the same for walk-through rooms.

**Step 2, bulkheads:**
- `layout.bulkheads` (edge id → true); `setBulkhead { edges, on }`: fitting one costs `corridors.bulkhead.cost` (2 metal), taking it out is free. Only on a built corridor segment, never a gallery tube (`bulkheadRefusal`). `recomputeAccess` drops any whose corridor is gone, so filling a corridor in takes its bulkhead with it.
- In the network graph a corridor segment with a bulkhead is airtight: air routes skip it, people walk through.
- **Tool:** the corridor tool's **Bulkhead** button (hazard-striped chip) turns it into the bulkhead tool: click a corridor to fit one, Shift-click or Erase to take it out. No dragging. The status line says what a click will do.
- **Views:** a hazard-striped bar across the corridor in 2D and plan; in 3D a door frame with a sealed door and an orange band, at the segment's middle.

**Step 3, dust through the airlock:**
- The entrance and the cargo elevator (rooms that open onto the surface) have air quality −1 r1, spread by the airborne rules: the rooms along the network from them get the dust, fading.
- In a dust storm it's worse: × (1 + (`dust.stormFactor` − 1) × the storm's level), in quarter steps (`dustNow`). `Effects` carries the dust it was built with; `refreshEffects` rebuilds when the layout or the dust changes, and the worker resends the field then too.

**Step 4, crowding:**
- `crowdedAir(state, home)`: each resident past `crowding.perCell` a cell (as of the last update) costs the home `crowding.air` air quality, felt as health. **Changed from the plan:** 5 a cell, not 4, so studios and apartments (5 a cell) aren't crowded and a full bunk dorm (8) is: −0.45.
- A home's card says when it's crowded.
- **Bots:** they count crowding when looking for homes with stale air (a hub nearby fixes it), and build apartments rather than bunks once they're unlocked and affordable. Without that, every bot dorm was stuffy and births stalled.

**Step 5, glass and the glassworks:**
- Glass: a dry good (material), kept in storage like brick. Shown in the top strip once a hole has some; in Trends.
- Glassworks (industry, M, 3 staff): rock 4, power 4 → glass 2 a day; brick 10, metal 5, machinery 1; from 200 colonists (`unlocks.rooms.glassworks`, with word when it opens). Noise −1 r1 and air quality −1 r1 (heat, the catalog's effect, isn't built).
- Furniture (the kiln, a new rack of glass sheets, a hopper), a template, and a pane-of-glass glyph.

**Step 6, the dome:**
- `config.dome`: population 300 (an unlock gate, "dome", with word when it opens), cost glass 200, metal 120, machinery 20, electronics 10, 240 work-hours, atrium +0.5 comfort, air +0.5.
- `buildDome` charges the cost and queues a construction job of its own kind ("Shaft dome"); cancelling it refunds everything. Done, it sets `layout.domed`, with a message.
- **Under the dome:** every floor's gallery is open walkway in the access network and the path graph (as if tubes ran all round); `tubeAt` is true everywhere, so doors, window bands, walking and the walkers follow; shaft-facing rooms get the full view plus the atrium bonus; air quality +0.5 on every cell's baseline; storms no longer worsen the airlock dust (the field's dust stays 1).
- **Views:** 3D: open ledges with railings on every floor (no glass), and a ribbed glass dome over the shaft at the rim; 2D and plan: the shaft band and ledge ring drawn as walkway again.
- **UI:** Build → Public has a **Shaft dome** button (✓ built, … under way) with a card of its cost and what it does; a domed hole's name carries ◓ in the hole list and the Network panel.
- Storm grit already stays above ground in 3D, so nothing more was needed there.

**Step 7, docs:** README, DESIGN, DECISIONS, CLAUDE.md, ART and ROOMS (a Shaft dome row) updated; ROOM-STATUS regenerated. The bots don't build bulkheads, glassworks or the dome (their runs stop before 200 colonists in a hole); nothing in them needed changing.

