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
