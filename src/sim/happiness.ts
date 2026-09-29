import type { SimConfig } from "./config";
import { isActive } from "./economy";
import { effectOnRoom } from "./effects";
import type { RoomInstance } from "./placement";
import { modifiers } from "./ordinances";
import { careFactors } from "./care";
import { CONDITION, homeWearComfort, sharedWear } from "./condition";
import { roomDef } from "./rooms";
import type { SimState } from "./state";

// Happiness from three factors (noise, comfort, health), each −3..+3, felt
// where colonists live. Each home's happiness eases toward its target, and a
// hole-wide average below the threshold slows every room down.

export interface Factors {
  noise: number;
  comfort: number;
  health: number;
}

export interface HousingPool {
  roomId: number;
  capacity: number;
  residents: number;
  happiness: number;
  target: number;
  factors: Factors;
}

export interface Happiness {
  pools: HousingPool[];
  homeless: number;
  /** Resident-weighted average, 0..100. */
  average: number;
  /** Multiplier on every room's output. */
  productivity: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Share of colonists a working clinic looks after, 0..1. */
export function careCoverage(state: SimState): number {
  const pop = state.population.count;
  if (pop <= 0) return 1;
  let care = 0;
  for (const r of state.layout.rooms) {
    const cares = roomDef(r.type).cares ?? 0;
    if (cares && isActive(r)) care += cares * (state.roomStatus[r.id]?.rate ?? 0);
  }
  return Math.min(1, care / pop);
}

/** How well needs are met, as a health factor: 0 at full health, −3 at none. */
function needsHealth(state: SimState, cfg: SimConfig): number {
  return ((state.population.health - 100) / 100) * cfg.happiness.factorLimit;
}

export function homeFactors(state: SimState, room: RoomInstance | null, cfg: SimConfig): Factors {
  const h = cfg.happiness;
  const lim = h.factorLimit;
  const mod = modifiers(state);
  const care = careFactors(state);
  const shared = needsHealth(state, cfg) + (1 - careCoverage(state)) * h.noCareHealth + mod.health + care.health;
  // Worn shared rooms (the galley, restrooms, workplaces) get everyone down; worn homes, their own residents.
  const sharedComfort = mod.comfort + care.comfort - sharedWear(state) * CONDITION.happiness.sharedComfort;
  if (!room) return { noise: 0, comfort: clamp(h.homelessComfort + sharedComfort, -lim, lim), health: clamp(shared, -lim, lim) };

  const field = state.effects.field;
  const def = roomDef(room.type);
  const own = def.effects.filter((e) => e.residentsOnly && e.type === "comfort").reduce((s, e) => s + e.strength, 0);
  const view = room.cells.some((c) => c.ring === 1) ? h.shaftViewComfort : 0;
  return {
    noise: clamp(effectOnRoom(field, "noise", room) * mod.noiseFactor, -lim, lim),
    comfort: clamp(own + view + sharedComfort + homeWearComfort(room) + effectOnRoom(field, "comfort", room) + effectOnRoom(field, "smell", room), -lim, lim),
    health: clamp(effectOnRoom(field, "health", room) + shared, -lim, lim),
  };
}

export function targetHappiness(f: Factors, cfg: SimConfig): number {
  const w = cfg.happiness.weights;
  return clamp(50 + (cfg.happiness.base - 50) + w.noise * f.noise + w.comfort * f.comfort + w.health * f.health, 0, 100);
}

export function productivity(average: number, cfg: SimConfig): number {
  const h = cfg.happiness;
  if (average >= h.productivityFullAt) return 1;
  return h.productivityAtZero + (1 - h.productivityAtZero) * (average / h.productivityFullAt);
}

export function createHappiness(): Happiness {
  return { pools: [], homeless: 0, average: 50, productivity: 1 };
}

/**
 * Move people into the best homes, then ease each home's happiness toward
 * its target. With `settle`, jump straight to the targets (for a new game).
 */
export function updateHappiness(state: SimState, cfg: SimConfig, settle = false): void {
  const h = cfg.happiness;
  const prev = new Map(state.happiness.pools.map((p) => [p.roomId, p]));
  const homes = state.layout.rooms.filter((r) => isActive(r) && (roomDef(r.type).houses ?? 0) > 0);

  const pools: HousingPool[] = homes.map((room) => {
    const factors = homeFactors(state, room, cfg);
    const target = targetHappiness(factors, cfg);
    const old = prev.get(room.id);
    return { roomId: room.id, capacity: roomDef(room.type).houses!, residents: 0, happiness: old?.happiness ?? target, target, factors };
  });

  // Best homes fill first; ties go to the older room so people don't shuffle.
  let left = state.population.count;
  for (const p of [...pools].sort((a, b) => b.target - a.target || a.roomId - b.roomId)) {
    p.residents = Math.min(p.capacity, left);
    left -= p.residents;
  }

  const ease = settle ? 1 : Math.min(1, h.updateEveryTicks / (h.easeDays * cfg.ticksPerDay));
  for (const p of pools) p.happiness += (p.target - p.happiness) * ease;

  const homelessTarget = targetHappiness(homeFactors(state, null, cfg), cfg);
  const pop = state.population.count;
  const total = pools.reduce((s, p) => s + p.residents * p.happiness, 0) + left * homelessTarget;
  const average = pop > 0 ? total / pop : 50;

  state.happiness = { pools, homeless: left, average, productivity: productivity(average, cfg) };
}

export function stepHappiness(state: SimState, cfg: SimConfig): void {
  if (state.tick % cfg.happiness.updateEveryTicks === 0) updateHappiness(state, cfg);
}
