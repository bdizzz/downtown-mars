import { gameTime, type GameTime } from "./clock";
import type { SimConfig } from "./config";
import { canDig, diggingFloor, ticksToDig } from "./digging";
import { beds, padReady } from "./earth";
import { capacities, roomSpec, type Population, type RoomStatus } from "./economy";
import type { EffectField } from "./effects";
import type { Message } from "./messages";
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
  /** Neighbor effects per cell; changes only with the layout. */
  effects: EffectField;
  drill: DrillView;
  resources: Record<string, number>;
  capacities: Record<string, number>;
  /** Smoothed net change per game day. */
  rates: Record<string, number>;
  /** Power is a flow, so show what's made and used rather than a net rate. */
  power: { made: number; used: number };
  population: Population;
  workforce: { total: number; employed: number };
  roomStatus: Record<number, RoomStatus>;
  earth: { ticksToDrop: number; waiting: boolean; padReady: boolean };
  beds: number;
  messages: Message[];
}

export function makeSnapshot(state: SimState, cfg: SimConfig): Snapshot {
  const floor = canDig(state, cfg) ? diggingFloor(state) : null;
  const needed = floor ? ticksToDig(floor, cfg) : 1;
  return {
    tick: state.tick,
    time: gameTime(state.tick, cfg),
    layout: state.layout,
    effects: state.effects.field,
    drill: {
      active: state.drill.active,
      floor,
      progress: floor ? state.drill.progress / needed : 0,
      ticksLeft: floor ? needed - state.drill.progress : 0,
    },
    resources: state.resources,
    capacities: capacities(state, cfg),
    rates: state.rates,
    power: powerFlow(state, cfg),
    population: state.population,
    workforce: state.workforce,
    roomStatus: state.roomStatus,
    earth: {
      ticksToDrop: Math.max(0, state.earth.nextDropTick - state.tick),
      waiting: state.earth.waiting,
      padReady: padReady(state),
    },
    beds: beds(state),
    messages: state.messages,
  };
}

function powerFlow(state: SimState, cfg: SimConfig): { made: number; used: number } {
  let made = 0;
  let used = 0;
  for (const room of state.layout.rooms) {
    const st = state.roomStatus[room.id];
    if (!st) continue;
    const spec = roomSpec(room, cfg);
    made += (spec.makes.power ?? 0) * st.rate;
    used += (spec.uses.power ?? 0) * st.rate;
  }
  return { made, used };
}
