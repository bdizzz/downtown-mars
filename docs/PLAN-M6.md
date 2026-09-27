# Milestone 6 plan: corridors on the edges

Goal: corridors stop being blocky one-slot rooms. They run along the borders between rooms (and between rooms and rock), are carved out of what they pass, and tie every room back to the shaft.

Decided Sep 27, 2026 (Bryon). This reverses DECISIONS.md "Corridors take slots (spokes and ring segments)"; that file is read-only here, so the reversal is recorded in this plan.
- A **draw corridors** tool turns borders into corridors.
- **Eligible borders:** a border between two rooms, or between a room and rock, is eligible. The middle of a multi-cell room is not, and neither is rock against rock.
- **Cost and finish:** corridors cost materials, and the material sets the look (utilitarian marscrete, fancy metal), with no effect on the surroundings for now. Finishes are rock, marscrete, brick and metal, which means adding marscrete and a concrete plant.
- **Access:** a room needs a corridor on at least one side to be used. Unconnected rooms can still be planned and placed, with a warning. Corridors themselves must link back to the shaft.
- **Public rooms** (plazas) have corridors built into every side, and **stairs and elevators** link the floors they span the way the shaft does.
- **Carving:** corridors are 3 m wide and carved out of the rooms and rock they pass. A room loses a strip on each side that has a corridor, even along part of a side. This is visual only, with no effect on stats.

## Shape of the change

- **The edge grid.** Each floor's cells are bounded by circles (between rings) and radial lines (between slots). Because outer rings have more slots, the circle between ring n and ring n+1 is cut at every slot boundary of either ring, so every arc segment has exactly one cell inside and one outside. An edge is either:
  - a radial line between two slots of one ring, or
  - an arc segment on one circle.

  Edges meet at vertices (a circle and an exact angle), and corridors connect through shared vertices.
- **What counts as the shaft:** the gallery ledge around the shaft. Its circle (circle 0) is the source: a corridor touching it is linked, and ring-1 rooms, which face the gallery, are always connected, as before.
- **Corridors live in the layout** as a map from edge id to finish. Access is a union-find over vertices:
  - Linked corridors are those whose vertices join the shaft.
  - A public room counts all of its outside edges as corridors.
  - A stairwell also joins its edges across the floors it spans.
  - A room is connected if it's in ring 1, or one of its outside edges is a linked corridor or the side of a linked public room.
- **Effects:** corridors soak up noise and smell. A step across a border that's entirely corridor doesn't pass them on; health and comfort pass as before.
- **All numbers in `data/corridors.json`:** width, finishes and costs per 10 m of corridor.

## Defaults (chosen, not yet confirmed)

- **Finishes, per 10 m of corridor:**

  | Finish | Cost | Look |
  | --- | --- | --- |
  | Bare rock | rock 3 | rough, dark |
  | Marscrete | marscrete 2 | flat grey, utilitarian |
  | Brick | brick 2 | warm, laid courses |
  | Metal | metal 2 | light steel with grating, fancy |

  Short arc pieces cost in proportion to their length. Removing a corridor refunds half.
- **Marscrete** is a new construction material, made by the catalog's **concrete plant** (M, 3 staff, rock 5 + water 2 + power 2 → marscrete 4, noise −2 r2, rock 15 + metal 5 + machinery 1). The catalog's "Pop 100" unlock isn't modelled, like the others.
- **Public rooms** from the catalog: the **small plaza** (M, 1 staff, power 1, comfort +1 r2, rock 10 + brick 5).
- **Stairs:** the catalog's **stairwell** (S, spans 2 floors, rock 8, public). Rooms gain a height in floors for it. A stairwell reaching a floor that's linked to the shaft links the floor it reaches.
- **Corridors on the floor being dug** can be drawn, like blueprint rooms, and join the network once the floor is dug.
- **Old saves:** each corridor room becomes corridors on every edge of its cells (except rock against rock with nothing on either side). The cells themselves become empty rock.
- **A "Connect" button** on an unconnected room's Inspector draws the shortest eligible corridor path to the network, in the chosen finish. The scripted players use the same routine.

## Steps

1. **Edge grid.** `src/sim/edges.ts`: edge ids, vertices, sides, a cell's edges, a group's outside edges, eligibility, the nearest edge to a point. Tests. *See:* nothing yet; tests pass.
2. **Corridors in the sim.**
   - Corridors in the layout, with draw and remove commands, finishes and costs.
   - Marscrete and the concrete plant.
   - Access by union-find, and rooms placeable while unconnected.
   - Effects blocking, the corridor room retired, and save v12 with migration.

   Tests. *See:* the game runs; corridors exist in the sim.
3. **Unrolled view.**
   - Corridors drawn as 3 m bands in their finish, and rooms carved around them.
   - Unconnected rooms and corridors marked.
   - Doors where rooms meet corridors.
   - The draw corridors tool: hover the nearest border, drag to paint, and erase.

   *See:* draw a corridor out to ring 2 and connect a room.
4. **Plan view.** The same as step 3, from above. *See:* corridors in the plan.
5. **3D view.** Rooms carved per side, corridor floors in their finish, and the tool through the floor cap and walls. *See:* corridors in 3D.
6. **Public rooms and stairs.** Small plaza, stairwell (rooms two floors tall), their built-in edges, linking across floors. *See:* a stairwell reaching a floor with no corridor to the shaft.
7. **Connect, bots, tutorial, balance.**
   - The Connect button and shortest-path routine.
   - Both scripted players drawing corridors.
   - The tutorial updated.
   - Costs checked against the playthroughs, and docs.

   *See:* playthroughs pass with edge corridors.

## Notes as built
**Step 1, edge grid:** `src/sim/edges.ts`.
- **Edges:** radial edges `R{floor}.{ring}.{i}` (between slot i−1 and slot i), and arc pieces `A{floor}.{circle}.{p}/{q}`, named by their start angle as an exact reduced fraction of a turn. Circle k is cut at the slot boundaries of rings k and k+1, so every arc piece has one cell on each side (the outermost circle has rock beyond it).
- **Vertices** are (floor, circle, exact fraction), so corridors that should meet do meet.
- **Helpers:** a cell's edges (ring 1's inner side is the gallery, not an edge), a group's outside edges, the edges two cells share, lengths in metres, and the nearest edge to a point for the tool.

Tested: cuts, sides, id round-trips, shared borders, shared vertices, picking, lengths.

**Step 2, corridors in the sim:** `src/sim/corridors.ts`.
- **Layout:** the layout holds `corridors` (edge id → finish) and a derived `corridorLinked`.
- **Where they can go** (`corridorRefusal`): a dug floor or the one being dug, a room on at least one side, not the middle of a room, not already a corridor.
- **Commands:**
  - `drawCorridors` pays per edge by length (costs in `data/corridors.json`, per 10 m) and logs "Corridors" in the ledger. It carves what it can.
  - `removeCorridors` refunds half.
  - `connectRoom` runs a shortest path (Dijkstra by metres over the floor's edges, existing corridors and plaza sides free) from anything linked to the shaft to one of the room's sides, and draws it all or nothing.
- **Access:** a union-find over vertices. Spokes between ring-1 cells join the shaft. Public rooms count every outside edge, and ring-1 public rooms open onto the gallery. Corridors on the floor being dug don't link until it's dug. Ring-1 rooms are connected as before.
- **Placement:** placement no longer refuses unconnected rooms; the check reports `unconnected`, and the status bar warns. The Inspector has a "Connect with a corridor" button (bare rock for now) until the views get the tool.
- **Effects:** noise and smell don't cross a border that's all corridor. They may still arrive the long way round; health and comfort pass.
- **New content:**
  - marscrete (a material, capacity 200);
  - the concrete plant (rock 5 + water 2 + power 2 → marscrete 4, noise −2 r2);
  - the small plaza (public, comfort +1 r2), in a new Public category.
- **Retired:** the corridor room is gone. Save version 12 turns each one into bare-rock corridors along its borders with rooms and other old corridor cells, plus a ring-1 cell's spokes to the gallery. The cells become empty (tested with a ring-2 dorm that stays connected).
- **Tutorial:** life support goes in ring 2 first, then "carve a corridor to it" (met when a linked corridor reaches a room past ring 1).
- **Scripted players:** they connect each room they place and retry any that are cut off. The playthroughs pass with bounds eased slightly for the rock corridors cost: the child's critical set is up within 8 days of the convoy leaving, and there are 170+ colonists at day 80 (they reach 179).

**Step 3, unrolled view:**
- **Bands:** corridors are bands 3 m thick at the ring scale (14 px), centred on their border and drawn over the rooms and rock on either side, so a room loses exactly the strip a corridor runs along, even along part of a side. Radial corridors run the full height of their ring, so ring-1 spokes meet the gallery.
- **Finishes** (`src/render2d/corridorArt.ts`): bare rock is speckled (lightened after the first look), marscrete has expansion joints, brick has staggered courses, metal has grating and rails.
- **Doors and warnings:** a linked corridor gets a door notch into each room it runs beside (not public rooms, which are open). An unlinked one gets red hatching and a red outline. Corridors on the floor being dug are faint.
- **Tool:** the palette's Access group has a Corridors entry (C) with the four finishes, each with its cost per 10 m (greyed when short), and an Erase toggle. Shift erases too.
- **Hover:** the border nearest the pointer in the cell under it. A ghost band shows the finish (green when it can go, red with the reason when not), and the status bar gives the cost or the refusal.
- **Drag** draws or erases along every border it crosses.
- The corridor-room drawing and door logic are gone.

Checked in the browser on a migrated v6 save: the migrated bare-rock corridors, a brick corridor dragged between the galley and the life support (doors on both sides), and a Shift-click erase that left the remaining piece hatched as unlinked.

**Step 4, plan view:** corridors are strips of their true 3 m width that follow real geometry: out along a spoke, or around an arc at the ring boundary (`corridorStrip` in `corridorArt.ts`, the general form of the unrolled band). They carry the same finish patterns, doors (dots on each room side of a linked corridor) and red outlines when unlinked. The corridor tool works the same as in the unrolled view: nearest border by true metres from the pointer, ghost strip, Shift or Erase to remove, drag to paint. Room cells now fill edge to edge, so a room reads as one piece and its outline marks where it ends.

**Step 5, 3D view:**
- **Carving:** room solids are carved by the corridors along them (`roomGeometry`).
  - A side with a corridor gives up half its width (1.5 m) instead of the few-centimetre hairline inset.
  - Where the inner or outer side is split into arc pieces and only some carry a corridor, the cell is split at the corridor's ends and gets a small step wall there. Uncarved sides stay one piece, so triangle counts don't grow.
  - The shape cache keys on the corridors along a room's sides.

  Tested: a side corridor pulls the room back by (1.5 − 0.06)/r; a corridor along part of a side carves only that part.
- **Corridor floors:** strips 3 m wide (`corridorStripGeometry`), one mesh per finish. Rock is rough, marscrete and brick matte, metal shiny. Corridors not linked to the shaft are red.
  - They lie just above the floor. With a floor chosen from above, they lie on the cut, over the rock cap.
  - They're pickable: a hit on a floor strip reads the point just above it, so the floor below isn't picked by mistake.
- **Tool:** the raycast remembers the point it read, and the corridor tool takes the nearest border to that point. A ghost strip (green, or red with the reason) shows where it goes, and Shift erases.

**Step 6, public rooms and stairs:**
- **Tall rooms:** rooms can be several floors tall (`floors` in `data/rooms.json`). The footprint repeats on each floor down from the one it's placed on. A tall room is refused if its lowest floor isn't dug ("spans 2 floors: the lower one isn't dug yet") and is a blueprint while it's being dug. The unrolled view draws each floor's part.
- **Stairwell** (from the catalog): S, 2 floors, rock 8, public, in the Access group, with a glyph. Its sides on both floors count as corridors, and its floors join one network, so a corridor reaching it on one floor links the rooms beside it on the other. Tested with a ring-2 stairwell connected on floor 1 and a clinic beside its floor-2 part.
- **Small plaza** (added in step 2) gets a glyph.
- **Room cards** say when a room spans floors, and when it's walk-through (its sides count as corridors) instead of "needs a corridor".
- **Browser:** a stairwell over a floor-2 farm is refused ("Overlaps Farm"); one in ring 2 goes in on both floors and connects through the corridor above it.

**Step 7, connect, bots, tutorial, balance:**
- **Connect button:** it carves in the corridor tool's last finish and names it.
- **Scripted players and tutorial:** the scripted players connect every room they place and retry any that are cut off (step 2). The tutorial teaches placing life support in ring 2, then carving a corridor to it (step 2).
- **Balance**, from the playthroughs (bare rock only):
  - The solo hole has 8 corridor pieces (16 rock) by day 30.
  - Bradbury has 10 (20 rock) and Gale 2 by day 90, with 60 and 28 rooms.
  - The bots mostly build on the gallery (ring 1), so they need few corridors. With digging keeping rock near its 400 cap, bare rock is close to free, and the dearer finishes are a choice of look.

Open questions for Bryon:
- **Costs:** should corridors cost more to make them a real budget line? For example: bare rock 6 per 10 m, or a small upkeep, or labour (a build time).
- **DECISIONS.md** still says "Corridors take slots (spokes and ring segments)". It's read-only here; this plan records the reversal.
- **Not done yet:**
  - undo for corridors (⌘Z covers room placement only);
  - doors on corridors in 3D (the unrolled and plan views have them);
  - elevators (the stairwell is the only vertical link);
  - the catalog's larger plazas and grand staircase.

**Follow-ups (Bryon, Sep 27):**
- **Tiny plaza** (new, not in the catalog): S (1×1), public, comfort +1 r1, rock 5 + brick 2, no staff or power. It shares the small plaza's glyph.
- **Public rooms open onto the shaft:** in ring 1 they have no wall, windows or door on the gallery side. In 3D the solid has no inner face and reaches the shaft edge. In the unrolled view the fill runs up to the gallery with side and bottom walls only. In the plan it fills over the gallery's edge line, with no inner outline.
- **Stairs:**
  - A piece takes the floor it's placed on and the one below. The floor below must be dug, not just being dug: "The floor below (floor N) isn't excavated yet". It must also be free: "Floor N below: overlaps Farm".
  - **Chaining:** a piece may sit on a stack of the same kind in the same slot, and one meeting a stack end to end (just above its top or below its bottom) joins it too. The result is one room spanning every floor. The hover shows a green ghost with a plus (all three views) and "＋ Extend stairs to cover floors 1–3". A piece with nothing new to cover is refused ("Already stairs here").
  - **Cost and undo:** each piece costs the room's price. An extension can't be undone as a room (it isn't one); demolishing a stack refunds half of every piece.
- **Elevator** (the catalog's local elevator): S, stacks like stairs up to 8 floors, power 1, noise −1 r1, metal 10 + machinery 2, public. Stairwells and elevators are both public, so their sides count as corridors on every floor they span, and they link those floors.
- **Browser check (plan view):** stairs placed on floor 6 show on floor 7 open to the shaft; hovering them on floor 7 offers "Extend stairs to cover floors 6–8", the click extends them, floor 8 then offers 6–9, and floor 10 (being dug) refuses.
