import type { SimConfig } from "./config";
import { postMessage } from "./messages";
import type { SimState } from "./state";
import type { World } from "./world";

// A hole fails when its last colonist is gone (T-162): no one is left to open the airlock, so
// nobody new can come in. It has to stay empty for a while first, so a dip (everyone out on a
// move, a drop about to land) doesn't count. A failed hole is lost for good; the game goes on
// in the others, and ends when every hole has failed.

export interface HoleFailure {
  tick: number;
  /** The most people it ever had. */
  peak: number;
}

/** Each tick: note the hole's peak, and fail it once it has stayed empty long enough. */
export function stepFailure(state: SimState, cfg: SimConfig): void {
  if (state.failed) return;
  const count = state.population.count;
  state.peakPopulation = Math.max(state.peakPopulation ?? 0, count);
  if (count > 0) {
    delete state.emptySince;
    return;
  }
  state.emptySince ??= state.tick;
  if (state.tick - state.emptySince < cfg.failure.emptyDays * cfg.ticksPerDay) return;
  state.failed = { tick: state.tick, peak: state.peakPopulation };
  postMessage(state, cfg, `${state.name} has failed: no one is left to open the airlock for newcomers.`, "warn");
}

/** Every hole has failed, and nobody is on the way to found or join one. */
export function everyHoleFailed(world: World): boolean {
  return world.holes.length > 0 && world.holes.every((h) => h.failed) && !world.convoys.length && !world.migrations.length;
}

/** How long a hole lasted, in game days, from its founding to its failure (or now). */
export function daysLasted(state: SimState, cfg: SimConfig): number {
  return ((state.failed?.tick ?? state.tick) - state.foundedTick) / cfg.ticksPerDay;
}
