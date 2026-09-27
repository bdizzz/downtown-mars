import type { SimState } from "./state";

// Advance the simulation by one fixed tick. Mutates state in place.
// Systems (staffing, rooms, colonists, storage) will run here in order.
export function step(state: SimState): void {
  state.tick += 1;
}
