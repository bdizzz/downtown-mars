import { maintenanceView, type MaintenanceView } from "./condition";
import { stormDue, stormLevel } from "./weather";
import { gameTime, type GameTime } from "./clock";
import type { SimConfig } from "./config";
import { canDig, diggingFloor, ticksToDig } from "./digging";
import { beds, padReady } from "./earth";
import { capacities, powerFlow, type Population, type RoomStatus } from "./economy";
import type { EffectField } from "./effects";
import type { Deposit, DepositKind } from "./mapgeo";
import { hasStagingBay, kitProgress } from "./founding";
import { afterglow, afterglowDaysLeft, type Happiness } from "./happiness";
import type { History } from "./history";
import { cryptSpace, holeGates, stageCounts, type Stage } from "./people";
import { ordinanceDef } from "./ordinances";
import { elderCoverage, schoolCoverage, type Coverage } from "./care";
import { birthBlockers, birthsPerDay } from "./births";
import { queueView, type JobView } from "./construction";
import type { Culture } from "./culture";
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

export interface ConvoyView {
  name: string;
  from: { lat: number; lon: number } | null;
  to: { lat: number; lon: number };
  /** 0 at departure, 1 on arrival. */
  progress: number;
  daysLeft: number;
}

export interface RouteView {
  id: number;
  fromHoleId: number;
  toHoleId: number;
  resource: string;
  amountPerTrip: number;
  phase: "loading" | "outbound" | "returning";
  cargo: number;
  /** 0..1 through the current leg. */
  progress: number;
  /** Days for one way. */
  legDays: number;
  /** Beyond the hole's rovers, so parked. */
  idle: boolean;
  /** How opinion scales each load: above 1 for friends, 0 when they refuse. */
  loadFactor: number;
}

export interface RelationView {
  from: number;
  to: number;
  opinion: number;
  tier: string;
}

/** One line per hole, for the hole picker and anything network-wide. */
export interface HoleSummary {
  id: number;
  name: string;
  population: number;
  /** Visitors waiting at that hole's office. */
  waiting: number;
  site: { lat: number; lon: number } | null;
  /** What that hole sits on. */
  deposits: DepositKind[];
  /** Working rovers (from rover depots). */
  rovers: number;
  /** Tradeable stock, for choosing routes. */
  stock: Record<string, number>;
  culture: Culture;
  /** Where the culture is heading. */
  cultureTarget: Culture;
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
  /** Resource deposits you know about; the worker fills these in too. */
  deposits: Deposit[];
  /** Whether the whole map is known yet. */
  mapUnlocked: boolean;
  /** What the hole you're looking at sits on. */
  holeDeposits: DepositKind[];
  /** Deposits and unlocks together, for which rooms this hole can build. */
  holeGates: string[];
  /** This hole's seed kit: gathered so far against what a kit needs. */
  kit: { loaded: Record<string, number>; progress: number; hasBay: boolean; gathering: boolean };
  /** Founding convoys on their way; the worker fills these in. */
  convoys: ConvoyView[];
  /** Every trade route in the network; the worker fills these in. */
  routes: RouteView[];
  /** How each hole sees each other hole. */
  relations: RelationView[];
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
  /** Head counts by life stage. */
  stages: Record<Stage, number>;
  /** Places for children and elders. */
  care: { school: Coverage; elders: Coverage };
  births: { blockers: string[]; perDay: number; born: number };
  /** Where the dead go: crypt places left, how many rest there, grief, and whether they return to the soil. */
  rest: { space: number; interred: number; grief: number; composting: boolean };
  /** Colonists on the road between holes; the worker fills these in. */
  migrations: { from: number; to: number; count: number; progress: number; daysLeft: number }[];
  /** Where this hole's unhappy colonists are leaving for, if anywhere (worker). */
  leavingFor: string | null;
  /** The construction queue, in order, and the hole's bandwidth. */
  construction: { bandwidth: number; jobs: JobView[] };
  /** Cohorts moving on next, soonest first. */
  upcoming: { stage: Stage; count: number; daysLeft: number }[];
  workforce: { total: number; employed: number };
  roomStatus: Record<number, RoomStatus>;
  earth: { ticksToDrop: number; waiting: boolean; padReady: boolean; landed: number };
  /** Dust storms: how hard one is blowing (0 clear to 1), and the days until a forecast one arrives. */
  weather: { storm: number; dueInDays: number | null };
  /** Room condition and upkeep: the overall condition, the queue, and what each service room is repairing. */
  maintenance: MaintenanceView;
  /**
   * Each room's condition, by id (rooms without one left out). It changes
   * every tick, and the layout only travels to the main thread when its
   * version moves, so it's sent on its own and put back on the rooms there.
   */
  conditions: Record<number, number>;
  beds: number;
  messages: Message[];
  happiness: Happiness;
  /** The thrill of arrival: happiness points it's adding now, and days until it's gone. */
  afterglow: { points: number; daysLeft: number };
  /** Resources and vital signs over time (the worker sends it only when it has a new sample). */
  history: History | null;
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
    mapUnlocked: false,
    holeDeposits: state.deposits ?? [],
    holeGates: holeGates(state),
    kit: { loaded: state.kit ?? {}, progress: kitProgress(state), hasBay: hasStagingBay(state), gathering: state.gatheringKit },
    convoys: [],
    routes: [],
    relations: [],
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
    stages: stageCounts(state),
    care: { school: schoolCoverage(state), elders: elderCoverage(state) },
    migrations: [],
    leavingFor: null,
    construction: queueView(state),
    rest: {
      space: cryptSpace(state),
      interred: state.population.interred ?? 0,
      grief: state.population.grief ?? 0,
      composting: state.ordinances.some((id) => ordinanceDef(id).composeDead),
    },
    births: { blockers: birthBlockers(state), perDay: birthsPerDay(state), born: state.population.born ?? 0 },
    upcoming: [...state.population.cohorts]
      .sort((a, b) => a.until - b.until)
      .slice(0, 5)
      .map((c) => ({ stage: c.stage, count: c.count, daysLeft: Math.max(0, (c.until - state.tick) / cfg.ticksPerDay) })),
    workforce: state.workforce,
    roomStatus: state.roomStatus,
    earth: {
      ticksToDrop: Math.max(0, state.earth.nextDropTick - state.tick),
      waiting: state.earth.waiting,
      padReady: padReady(state),
      landed: state.earth.landed ?? 0,
    },
    weather: { storm: stormLevel(state, cfg), dueInDays: stormDue(state, cfg) },
    maintenance: maintenanceView(state),
    conditions: Object.fromEntries(state.layout.rooms.filter((r) => r.condition !== undefined).map((r) => [r.id, r.condition!])),
    beds: beds(state),
    messages: state.messages,
    happiness: state.happiness,
    afterglow: { points: afterglow(state, cfg), daysLeft: afterglowDaysLeft(state, cfg) },
    history: state.history ?? null,
    notables: state.notables,
    office: state.office,
    ordinances: state.ordinances,
    ordinanceSlots: ordinanceSlots(state),
    flows: averageFlows(state, cfg),
  };
}
