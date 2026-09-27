import { gameTime, type GameTime } from "./clock";
import type { SimConfig } from "./config";
import type { Layout } from "./placement";
import type { SimState } from "./state";

// What the views get to see. Plain data, safe to structured-clone.
export interface Snapshot {
  tick: number;
  time: GameTime;
  layout: Layout;
}

export function makeSnapshot(state: SimState, cfg: SimConfig): Snapshot {
  return { tick: state.tick, time: gameTime(state.tick, cfg), layout: state.layout };
}
