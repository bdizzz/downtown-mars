import type { SimConfig } from "./config";
import { LABELS, record } from "./ledger";
import { noteMade } from "./origins";
import type { Layout } from "./placement";
import type { SimState } from "./state";

// Everything is solid rock until it's excavated (space.ts keeps what's dug, by angle). The drill only sinks the
// shaft; rooms are carved out of the rock around it, one construction job at
// a time, and bring up that rock (and whatever the hole sits on) as they go.
// An excavated cell with no room in it is empty space: pillars, no walls,
// walk-through like a plaza.

export { emptyCells, isOpen, openCells, rockCells } from "./space";

/** The shaft's floor area in hundreds of m²: what the drill brings up per floor. */
export function shaftUnits(layout: Layout): number {
  const r = layout.hole.shaftRadiusM;
  return (Math.PI * r * r) / 100;
}

/** Rock, and whatever the hole sits on, from digging out `units` hundred m² of floor. */
export function yieldRock(state: SimState, cfg: SimConfig, units: number, label: string = LABELS.excavation, at?: number): void {
  if (units <= 0) return;
  const rock = units * cfg.digging.rockPer100m2;
  state.resources.rock = (state.resources.rock ?? 0) + rock;
  record(state, "rock", "in", label, rock);
  noteMade(state, "rock", rock, at);
  for (const kind of state.deposits ?? []) {
    for (const [id, per] of Object.entries(cfg.digging.depositYieldsPer100m2[kind] ?? {})) {
      const amount = units * per;
      state.resources[id] = (state.resources[id] ?? 0) + amount;
      record(state, id, "in", label, amount);
      noteMade(state, id, amount, at);
    }
  }
}
