import { gameTime, type GameTime } from "./clock";
import type { SimConfig } from "./config";
import { canDig, diggingFloor, ticksToDig } from "./digging";
import { beds, padReady } from "./earth";
import { capacities, roomSpec, type Population, type RoomStatus } from "./economy";
import type { EffectField } from "./effects";
import type { Deposit } from "./mapgeo";
import type { Happiness } from "./happiness";
import { averageFlows, type Flows } from "./ledger";
import type { Message } from "./messages";
import type { Notable } from "./notables";
import { ordinanceSlots } from "./ordinances";
import type { Office } from "./visits";
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

/** One line per hole, for the hole picker and anything network-wide. */
export interface HoleSummary {
  id: number;
  name: string;
  population: number;
  /** Visitors waiting at that hole's office. */
  waiting: number;
  site: { lat: number; lon: number } | null;
}

// What the views get to see: the hole being looked at, in full, plus a line
// for every hole. Plain data, safe to structured-clone.
export interface Snapshot {
  /** Changes when a new game starts or a save loads; the worker sets it. */
  gameId: number;
  holeId: number;
  holeName: string;
  /** Filled in by the worker, which can see the whole world. */
  holes: HoleSummary[];
  /** Resource deposits on the map; the worker fills these in too. */
  deposits: Deposit[];
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
  earth: { ticksToDrop: number; waiting: boolean; padReady: boolean; landed: number };
  beds: number;
  messages: Message[];
  happiness: Happiness;
  notables: Notable[];
  office: Office;
  ordinances: string[];
  ordinanceSlots: number;
  /** Per-day flows by resource, averaged over recent days, for the flow diagram. */
  flows: Flows;
}

export function makeSnapshot(state: SimState, cfg: SimConfig): Snapshot {
  const floor = canDig(state, cfg) ? diggingFloor(state) : null;
  const needed = floor ? ticksToDig(floor, cfg) : 1;
  return {
    gameId: 0,
    holeId: state.holeId,
    holeName: state.name,
    holes: [],
    deposits: [],
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
      landed: state.earth.landed ?? 0,
    },
    beds: beds(state),
    messages: state.messages,
    happiness: state.happiness,
    notables: state.notables,
    office: state.office,
    ordinances: state.ordinances,
    ordinanceSlots: ordinanceSlots(state),
    flows: averageFlows(state, cfg),
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
