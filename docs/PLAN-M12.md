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

