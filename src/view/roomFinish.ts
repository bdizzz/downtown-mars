import { roomDef } from "../sim/rooms";

// What a room is made of, for the 3D view with room colours off: whichever
// building material its cost uses most (a galley's 10 rock outweighs its 5
// metal, a clinic's 10 brick its 5 metal). Rooms that cost nothing (the
// entrance, empty rooms) are carved from the rock itself.

export type Finish = "rock" | "marscrete" | "brick" | "metal";

/** Structural materials, in the order they win a tie. */
const MATERIALS: Finish[] = ["marscrete", "brick", "metal", "rock"];

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
