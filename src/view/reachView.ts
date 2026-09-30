import { distancesFrom, distancesFromCells, pathsFor, STEP_M } from "../sim/paths";
import type { Cell, Layout, RoomInstance } from "../sim/placement";
import { roomDef } from "../sim/rooms";

// Selecting a service (a galley, a clinic, a school) or a place to go (a park,
// a plaza, a gym) shows its reach on foot: the homes within it tinted green,
// stronger the nearer they are, and the homes beyond it red. Drawn when no
// other overlay is on.

export const REACH_COLORS = { near: 0x5fb35a, far: 0xd9453a };

/** How far a room reaches on foot, in steps: its service or its amenity, whichever's further. 0 if it doesn't. */
export function reachSteps(type: string): number {
  const def = roomDef(type);
  return Math.max(def.reach ?? 0, def.amenity?.reach ?? 0);
}

export interface ReachTint {
  room: RoomInstance;
  color: number;
  alpha: number;
  /** Steps on foot, or null when out of reach. */
  steps: number | null;
}

/** The homes a selected room reaches (and doesn't), or null if it has no reach. */
export function reachTints(layout: Layout, selected: number | null): ReachTint[] | null {
  if (selected === null) return null;
  const from = layout.rooms.find((r) => r.id === selected);
  if (!from || from.planned || from.building) return null;
  const reach = reachSteps(from.type);
  if (!reach) return null;
  const walk = distancesFrom(pathsFor(layout), selected, "walk", reach * STEP_M);
  const out: ReachTint[] = [];
  for (const room of layout.rooms) {
    if (room.at.kind !== "ring" || room.planned || room.building || !roomDef(room.type).houses) continue;
    const m = walk.get(room.id);
    if (m === undefined) out.push({ room, color: REACH_COLORS.far, alpha: 0.35, steps: null });
    else out.push({ room, color: REACH_COLORS.near, alpha: 0.3 + 0.35 * (1 - m / STEP_M / (reach + 1)), steps: m / STEP_M });
  }
  return out;
}

/** A key that changes when the tints would. */
export function reachKey(layout: Layout, selected: number | null): string {
  return selected === null || !layout.rooms.some((r) => r.id === selected && reachSteps(r.type)) ? "" : `${selected}:${layout.version}`;
}

/**
 * For the placement preview, in words: for a home, the nearest of each
 * service and place to go, in steps ("Galley 3 · Clinic 12, out of reach");
 * for a service or amenity, how many homes it would reach.
 */
export function reachSummary(layout: Layout, type: string, cells: Cell[]): string {
  const def = roomDef(type);
  const longest = Math.max(0, ...layout.rooms.map((r) => reachSteps(r.type)), reachSteps(type));
  if (!longest) return "";
  const walk = distancesFromCells(layout, cells, "walk", (longest + 12) * STEP_M);
  if (def.houses) {
    const nearest = new Map<string, number>();
    for (const r of layout.rooms) {
      if (r.planned || r.building || !reachSteps(r.type)) continue;
      const m = walk.get(r.id);
      if (m !== undefined && m < (nearest.get(r.type) ?? Infinity)) nearest.set(r.type, m);
    }
    return [...nearest]
      .sort((a, b) => a[1] - b[1])
      .slice(0, 5)
      .map(([t, m]) => {
        const steps = Math.max(1, Math.round(m / STEP_M));
        return `${roomDef(t).name} ${steps}${m / STEP_M > reachSteps(t) ? ", out of reach" : ""}`;
      })
      .join(" · ");
  }
  const reach = reachSteps(type);
  if (!reach) return "";
  const homes = layout.rooms.filter((r) => r.at.kind === "ring" && !r.planned && !r.building && roomDef(r.type).houses);
  const within = homes.filter((r) => (walk.get(r.id) ?? Infinity) <= reach * STEP_M).length;
  return `reaches ${within} of ${homes.length} ${homes.length === 1 ? "home" : "homes"} within ${reach} steps`;
}
