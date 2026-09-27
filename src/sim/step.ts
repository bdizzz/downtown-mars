import type { SimConfig } from "./config";
import { stepDigging } from "./digging";
import { stepEconomy, updateRates } from "./economy";
import type { SimState } from "./state";

// Advance the simulation by one fixed tick. Mutates state in place.
export function step(state: SimState, cfg: SimConfig): void {
  state.tick += 1;
  const before = { ...state.resources };
  stepDigging(state, cfg);
  stepEconomy(state, cfg);
  updateRates(state, before, cfg);
}
