import type { SimConfig } from "./config";
import type { Drill } from "./digging";
import { createEarth, type EarthState } from "./earth";
import { refreshEffects, type Effects } from "./effects";
import type { Message } from "./messages";
import type { Population, RoomStatus } from "./economy";
import { createHole } from "./geometry";
import { createLayout, placeRoom, type Layout } from "./placement";
import { roomDef } from "./rooms";

export interface SimState {
  tick: number;
  rngState: number;
  layout: Layout;
  drill: Drill;
  /** Stockpiles by resource id. Fractional amounts accumulate between ticks. */
  resources: Record<string, number>;
  /** Smoothed net change per game day, by resource id. */
  rates: Record<string, number>;
  population: Population;
  workforce: { total: number; employed: number };
  roomStatus: Record<number, RoomStatus>;
  earth: EarthState;
  messages: Message[];
  /** Derived from the layout; recomputed only when layout.version changes. */
  effects: Effects;
}

export function createInitialState(cfg: SimConfig): SimState {
  const h = cfg.starterHole;
  const layout = createLayout(createHole(h.shaftRadiusM, h.floors, h.unlockedRings, cfg.geometry), cfg);

  for (const k of cfg.landingKit.surface) {
    must(placeRoom(layout, k.room, { kind: "surface", slot: k.slot }, cfg), k.room);
  }
  for (const k of cfg.landingKit.ring) {
    const [w, d] = cfg.shapes[roomDef(k.room).size as keyof SimConfig["shapes"]]![0]!;
    must(placeRoom(layout, k.room, { kind: "ring", floor: k.floor, ring: k.ring, slot: k.slot, w, d }, cfg), k.room);
  }
  layout.version = 0;
  return {
    tick: 0,
    rngState: cfg.seed >>> 0,
    layout,
    drill: { active: true, progress: 0 },
    resources: { ...cfg.startingStock },
    rates: {},
    population: { count: cfg.colonists.start, health: 100, needsMet: {}, sanitation: 1 },
    workforce: { total: cfg.colonists.start, employed: 0 },
    roomStatus: {},
    earth: createEarth(cfg),
    messages: [],
    effects: refreshEffects(layout, null),
  };
}

function must(result: { ok: boolean; reason?: string }, what: string): void {
  if (!result.ok) throw new Error(`landing kit: can't place ${what}: ${result.reason}`);
}
