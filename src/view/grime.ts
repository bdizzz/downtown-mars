import { conditionOf, hasCondition } from "../sim/condition";
import type { RoomInstance } from "../sim/placement";

// Wear and grime, shown: a room's grime follows its condition (condition.ts).
// Spotless at 100%, grubbier as it wears, gone again the moment a crew
// finishes repairing it. Levels are whole steps, so rooms share materials and
// the 3D view only rebuilds when a room crosses into the next.

export const GRIME = { levels: 4 };

/** A room's grime, as a whole level from 0 (spotless) to GRIME.levels - 1. */
export function grimeLevel(room: RoomInstance): number {
  if (room.planned || room.building || !hasCondition(room)) return 0;
  const worn = 1 - conditionOf(room);
  return Math.max(0, Math.min(GRIME.levels - 1, Math.floor(worn * GRIME.levels)));
}
