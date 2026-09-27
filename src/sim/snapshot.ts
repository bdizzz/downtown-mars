import { gameTime, type GameTime } from "./clock";
import type { SimConfig } from "./config";
import { canDig, diggingFloor, ticksToDig } from "./digging";
import type { Layout } from "./placement";
import type { SimState } from "./state";

export interface DrillView {
  active: boolean;
  /** Floor being dug, or null when the drill has hit maxFloors. */
  floor: number | null;
  /** 0..1 through the current floor. */
  progress: number;
  /** Real ticks left on the current floor. */
  ticksLeft: number;
}

// What the views get to see. Plain data, safe to structured-clone.
export interface Snapshot {
  tick: number;
  time: GameTime;
  layout: Layout;
  drill: DrillView;
  resources: Record<string, number>;
}

export function makeSnapshot(state: SimState, cfg: SimConfig): Snapshot {
  const floor = canDig(state, cfg) ? diggingFloor(state) : null;
  const needed = floor ? ticksToDig(floor, cfg) : 1;
  return {
    tick: state.tick,
    time: gameTime(state.tick, cfg),
    layout: state.layout,
    drill: {
      active: state.drill.active,
      floor,
      progress: floor ? state.drill.progress / needed : 0,
      ticksLeft: floor ? needed - state.drill.progress : 0,
    },
    resources: state.resources,
  };
}
