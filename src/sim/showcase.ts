import { config } from "./config";
import { recomputeAccess } from "./corridors";
import { cellEdges, edgeSides, galleryEdges } from "./edges";
import { openCells } from "./excavation";
import { ensureFloors, placeRoom, roomAt, type Location } from "./placement";
import { roomDefs } from "./rooms";
import type { SimState } from "./state";

// A showcase colony, for the console (dm.showcase): the hole dug to `floors`,
// every floor with its gallery tube all round and corridors between the
// rings, and rings 1–3 filled with a mix of built, furnished rooms, a stair
// in ring 1's last slot on every floor. Costs, construction time and access
// rules are skipped: it's for looking at (and stress-testing the 3D views and
// the Godot experiment, docs/PLAN-GODOT.md), not for playing.

/** Room types the showcase cycles through: everything buildable and furnished in a ring, but the one-offs. */
function mix(): string[] {
  const skip = new Set(["entrance", "stairwell", "elevator", "cargo_elevator", "landing_pod"]);
  return roomDefs.filter((d) => d.buildable && !skip.has(d.id) && ["S", "M", "L"].includes(d.size) && !d.excavationOnly && !d.cargoShaft).map((d) => d.id);
}

export function buildShowcase(state: SimState, floors: number): { rooms: number } {
  const layout = state.layout;
  const hole = layout.hole;
  hole.floors = Math.max(hole.floors, Math.min(floors, config.digging.maxFloors));
  ensureFloors(layout);
  state.unlocks = [...new Set([...(state.unlocks ?? []), "basicHomes", "standardHomes", "luxuryHomes", "leisure", "recycling", "hospital", "cleaning", "brickworks", "cargo", "children", "elders"])];
  const types = mix();
  let next = 0;
  let placed = 0;
  const rings = Math.min(3, hole.unlockedRings);
  for (let floor = 1; floor <= hole.floors; floor++) {
    // The stairs, down every floor.
    const stairSlot = hole.ringSlots[0]! - 1;
    if (!roomAt(layout, { floor, ring: 1, slot: stairSlot })) {
      const r = placeRoom(layout, "stairwell", { kind: "ring", floor, ring: 1, slot: stairSlot, w: 1, d: 1 });
      if (r.ok) openCells(layout, r.cells);
    }
    for (let ring = 1; ring <= rings; ring++) {
      const n = hole.ringSlots[ring - 1]!;
      for (let slot = 0; slot < n; slot++) {
        if (roomAt(layout, { floor, ring, slot })) continue;
        // The next type that fits here, trying a few.
        for (let tries = 0; tries < types.length; tries++) {
          const type = types[(next + tries) % types.length]!;
          const size = roomDefs.find((d) => d.id === type)!.size as keyof typeof config.shapes;
          const [w, d] = config.shapes[size]![0]!;
          const at: Location = { kind: "ring", floor, ring, slot, w, d };
          const r = placeRoom(layout, type, at);
          if (!r.ok) continue;
          openCells(layout, r.cells);
          next = (next + tries + 1) % types.length;
          placed++;
          break;
        }
      }
    }
    // The gallery tube all round, and corridors between the rings and between rooms in rings 1–2 wherever two rooms meet.
    for (const e of galleryEdges(hole, floor)) layout.corridors[e.id] = "gallery";
    for (let ring = 1; ring < rings; ring++) {
      for (let slot = 0; slot < hole.ringSlots[ring - 1]!; slot++) {
        for (const e of cellEdges(hole, { floor, ring, slot })) {
          // Arcs round the ring's outer side, and spokes between its rooms out from the tube.
          if (e.kind === "arc" ? e.circle !== ring : e.ring !== ring) continue;
          const [a, b] = edgeSides(hole, e);
          const ra = a ? roomAt(layout, a) : undefined;
          const rb = b ? roomAt(layout, b) : undefined;
          // Not along the stairs: their doorways would leave no room for the flight (the gallery tube reaches them).
          if (ra && rb && ra !== rb && ra.type !== "stairwell" && rb.type !== "stairwell") layout.corridors[e.id] = "marscrete";
        }
      }
    }
  }
  for (const r of layout.rooms) {
    r.planned = false;
    delete r.building;
  }
  recomputeAccess(layout);
  layout.version++;
  return { rooms: placed };
}
