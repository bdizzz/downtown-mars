import type { SimConfig } from "./config";
import { stepDigging } from "./digging";
import type { SimState } from "./state";

// Advance the simulation by one fixed tick. Mutates state in place.
export function step(state: SimState, cfg: SimConfig): void {
  state.tick += 1;
  stepDigging(state, cfg);
}
