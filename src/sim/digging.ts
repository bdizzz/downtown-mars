import type { SimConfig } from "./config";
import { ensureFloors, recomputeAccess } from "./placement";
import type { SimState } from "./state";

// The starter drill digs the floor below the deepest one, a little each tick.
// Rock comes out as it goes. When the floor is done, blueprints on it switch on.

export interface Drill {
  active: boolean;
  /** Ticks of work done on the floor being dug. */
  progress: number;
}

/** Ticks needed to dig a given floor (2 = the first one dug). Deeper is slower. */
export function ticksToDig(floor: number, cfg: SimConfig): number {
  const d = cfg.digging;
  return Math.round(d.ticksForFirstFloor * Math.pow(1 + d.depthGrowth, floor - 2));
}

export function rockPerFloor(state: SimState, cfg: SimConfig): number {
  const hole = state.layout.hole;
  const slots = hole.ringSlots.slice(0, hole.unlockedRings).reduce((a, b) => a + b, 0);
  return slots * cfg.digging.rockPerSlot;
}

export function diggingFloor(state: SimState): number {
  return state.layout.hole.floors + 1;
}

export function canDig(state: SimState, cfg: SimConfig): boolean {
  return diggingFloor(state) <= cfg.digging.maxFloors;
}

export function stepDigging(state: SimState, cfg: SimConfig): void {
  if (!state.drill.active || !canDig(state, cfg)) return;
  const floor = diggingFloor(state);
  const needed = ticksToDig(floor, cfg);

  state.drill.progress += 1;
  state.resources.rock = (state.resources.rock ?? 0) + rockPerFloor(state, cfg) / needed;
  if (state.drill.progress < needed) return;

  const layout = state.layout;
  layout.hole.floors = floor;
  ensureFloors(layout);
  for (const r of layout.rooms) {
    if (r.planned && r.at.kind === "ring" && r.at.floor === floor) r.planned = false;
  }
  recomputeAccess(layout);
  layout.version++;
  state.drill.progress = 0;
}
