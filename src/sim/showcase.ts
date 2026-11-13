import { config } from "./config";
import { recomputeAccess } from "./corridors";
import { cellEdges, edgeSides, galleryEdges } from "./edges";
import { openCells } from "./excavation";
import { ensureFloors, placeRoom, roomAt, spanRange } from "./placement";
import { piecesOn } from "./space";
import { roomDefs } from "./rooms";
import type { SimState } from "./state";

// A showcase colony, for the console (dm.showcase): the hole dug to `floors`,
// every floor with its gallery tube all round and corridors between the
// rings, and rings 1–3 packed with a mix of built, furnished rooms, a stair
// at the end of ring 1 on every floor. Costs, construction time and access
// rules are skipped: it's for looking at (and stress-testing the 3D views and
// the Godot experiment, docs/PLAN-GODOT.md), not for playing.

/** Room types the showcase cycles through: everything buildable and furnished in a ring, but the one-offs. */
function mix(): string[] {
  const skip = new Set(["entrance", "stairwell", "elevator", "cargo_elevator", "landing_pod"]);
  return roomDefs.filter((d) => d.buildable && !skip.has(d.id) && ["S", "M", "L"].includes(d.size) && !d.excavationOnly && !d.cargoShaft).map((d) => d.id);
}

const N = config.geometry.notchesPerTurn;

export function buildShowcase(state: SimState, floors: number): { rooms: number } {
  const layout = state.layout;
  const hole = layout.hole;
  hole.floors = Math.max(hole.floors, Math.min(floors, config.digging.maxFloors));
  ensureFloors(layout);
  state.unlocks = [...new Set([...(state.unlocks ?? []), "basicHomes", "standardHomes", "luxuryHomes", "leisure", "recycling", "hospital", "reclaimer", "cleaning", "brickworks", "spiralStair", "plaza", "cargo", "children", "elders"])];
  const types = mix();
  let next = 0;
  let placed = 0;
  const rings = Math.min(3, hole.unlockedRings);
  for (let floor = 1; floor <= hole.floors; floor++) {
    // The stairs, down every floor.
    const stairs = spanRange(hole, "stairwell", 1, 1).target;
    const r = placeRoom(layout, "stairwell", { kind: "ring", floor, ring: 1, start: N - stairs });
    if (r.ok) openCells(layout, r.cells);
    // Each ring packed with rooms, one after the next round the turn.
    for (let ring = 1; ring <= rings; ring++) {
      let at = 0;
      const end = ring === 1 ? N - stairs : N;
      while (at < end) {
        let fitted = false;
        // The next type that fits here, trying a few.
        for (let tries = 0; tries < types.length && !fitted; tries++) {
          const type = types[(next + tries) % types.length]!;
          const span = spanRange(hole, type, ring, 1).target;
          if (at + span > end) continue;
          const placedRoom = placeRoom(layout, type, { kind: "ring", floor, ring, start: at, span, depth: 1 });
          if (!placedRoom.ok) continue;
          openCells(layout, placedRoom.cells);
          next = (next + tries + 1) % types.length;
          placed++;
          at += span;
          fitted = true;
        }
        if (!fitted) break;
      }
    }
    // The gallery tube all round, and corridors between the rings and between rooms in rings 1–2 wherever two rooms meet.
    for (const e of galleryEdges(layout, floor)) layout.corridors[e.id] = "gallery";
    for (let ring = 1; ring < rings; ring++) {
      for (const piece of piecesOn(layout, floor, ring)) {
        for (const e of cellEdges(layout, piece)) {
          // Arcs round the ring's outer side, and spokes between its rooms out from the tube.
          if (e.kind === "arc" ? e.circle !== ring : e.ring !== ring) continue;
          const [a, b] = edgeSides(layout, e);
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
