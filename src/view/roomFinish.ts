import { canLine, liningOf } from "../sim/materials";
import type { RoomInstance } from "../sim/placement";
import { roomDef } from "../sim/rooms";

// What a room looks like it's made of, in 3D (room colours off) and on the
// plan. A room that can have a lining (docs/PLAN-M15.md) shows its lining:
// bare rock until it's refitted, then brick, metal or their fine finishes.
// Rooms that can't (the entrance, stairs and lifts, empty rooms) keep the
// look of whichever building material their cost uses most; rooms that cost
// nothing are carved from the rock itself.

export type Finish = "rock" | "rock_fine" | "marscrete" | "brick" | "brick_fine" | "metal" | "metal_fine";

/** Structural materials, in the order they win a tie. */
const MATERIALS = ["marscrete", "brick", "metal", "rock"] as const;

/** The building material a room type's cost uses most. */
export function roomFinish(type: string): Finish {
  const cost = roomDef(type).cost;
  let best: Finish = "rock";
  let most = 0;
  for (const m of MATERIALS) {
    const v = cost[m] ?? 0;
    if (v > most) {
      best = m;
      most = v;
    }
  }
  return best;
}

/** What this room's walls and floor look like: its lining, or (if it can't have one) its type's material. */
export function roomLook(room: RoomInstance): Finish {
  if (!canLine(room)) return roomFinish(room.type);
  const w = liningOf(room);
  return w.finish === "fine" ? `${w.material}_fine` : w.material;
}
