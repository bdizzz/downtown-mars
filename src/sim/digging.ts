import { rollDiscovery } from "./events";
import type { SimConfig } from "./config";
import { shaftSlots, yieldRock } from "./excavation";
import { blueprintReady } from "./construction";
import { LABELS } from "./ledger";
import { ensureFloors, recomputeAccess } from "./placement";
import type { SimState } from "./state";

// The starter drill digs the floor below the deepest one, a little each tick.
// The shaft's rock comes out as it goes (rooms are excavated separately). When the floor is done, blueprints on it switch on.

export interface Drill {
  active: boolean;
  /** Ticks of work done on the floor being dug. */
  progress: number;
  /** Stopped until this tick by an event (venting gas, studying fossils). */
  holdUntil?: number;
}

/** Ticks needed to dig a given floor (2 = the first one dug). Deeper is slower, and much slower past the first few floors. */
export function ticksToDig(floor: number, cfg: SimConfig): number {
  const d = cfg.digging;
  const slow = floor >= d.slowFromFloor ? d.slowFactor : 1;
  return Math.round(d.ticksForFirstFloor * Math.pow(1 + d.depthGrowth, floor - 2) * slow);
}

/** Rock from one floor of the drill: the shaft's share only (rooms are excavated separately). */
export function rockPerFloor(state: SimState, cfg: SimConfig): number {
  return shaftSlots(state.layout, cfg) * cfg.digging.rockPerSlot;
}

export function diggingFloor(state: SimState): number {
  return state.layout.hole.floors + 1;
}

export function canDig(state: SimState, cfg: SimConfig): boolean {
  return diggingFloor(state) <= cfg.digging.maxFloors;
}

export function stepDigging(state: SimState, cfg: SimConfig): void {
  if (!state.drill.active || !canDig(state, cfg)) return;
  if (state.drill.holdUntil !== undefined && state.tick < state.drill.holdUntil) return;
  const floor = diggingFloor(state);
  const needed = ticksToDig(floor, cfg);

  state.drill.progress += 1;
  yieldRock(state, cfg, shaftSlots(state.layout, cfg) / needed, LABELS.digging);
  if (state.drill.progress < needed) return;

  const layout = state.layout;
  layout.hole.floors = floor;
  ensureFloors(layout);
  for (const r of [...layout.rooms]) {
    if (r.planned && r.at.kind === "ring" && r.at.floor === floor) {
      r.planned = false;
      blueprintReady(state, r, cfg);
    }
  }
  recomputeAccess(layout);
  layout.version++;
  state.drill.progress = 0;
  // Perhaps it struck something on the way.
  rollDiscovery(state, cfg, floor);
}
