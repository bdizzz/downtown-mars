import type { SimConfig } from "./config";
import { isActive } from "./economy";
import { effectOnRoom } from "./effects";
import type { Layout, RoomInstance } from "./placement";
import { galleryEdges } from "./edges";
import { modifiers } from "./ordinances";
import { careFactors, updateCare } from "./care";
import { CONDITION, homeWearComfort, sharedWear } from "./condition";
import { roomDef } from "./rooms";
import type { SimState } from "./state";
import { postMessage } from "./messages";
import { config } from "./config";
import { amenityFelt, updateDining } from "./amenities";

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
  /** Happiness points from the thrill of arrival, fading over the first weeks (missing in old saves: none). */
  afterglow?: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * A packed home's air: each resident past `crowding.perCell` a cell (as of the
 * last update) costs it `crowding.air` air quality. 0 when it's not crowded.
 */
export function crowdedAir(state: Pick<SimState, "happiness">, room: RoomInstance): number {
  const c = config.effects.crowding;
  const residents = state.happiness.pools.find((p) => p.roomId === room.id)?.residents ?? 0;
  const cells = Math.max(1, room.cells.length || room.surfaceCells.length);
  const over = residents / cells - c.perCell;
  return over > 0 ? -over * c.air : 0;
}

/**
 * Comfort from looking out over the shaft: each of a room's ring-1 cells
 * counts in full through its own windows, or partly through a gallery tube
 * in front of it (built, or being built); averaged over those cells. 0 for a
 * room with none in ring 1.
 */
export function shaftView(layout: Layout, room: RoomInstance, cfg: SimConfig): number {
  const faces = room.cells.filter((c) => c.ring === 1);
  if (!faces.length) return 0;
  const tubes = galleryEdges(layout.hole, faces[0]!.floor);
  const h = cfg.happiness;
  const each = faces.map((c) => {
    const id = (c.floor === faces[0]!.floor ? tubes : galleryEdges(layout.hole, c.floor))[c.slot]?.id;
    return id && layout.corridors?.[id] ? h.galleryViewComfort : h.shaftViewComfort;
  });
  return each.reduce((a, b) => a + b, 0) / each.length;
}

/** How well needs are met, as a health factor: 0 at full health, −3 at none. */
function needsHealth(state: SimState, cfg: SimConfig): number {
  return ((state.population.health - 100) / 100) * cfg.happiness.factorLimit;
}

export function homeFactors(state: SimState, room: RoomInstance | null, cfg: SimConfig): Factors {
  const h = cfg.happiness;
  const lim = h.factorLimit;
  const mod = modifiers(state);
  // Clinic, school and elder-care places within reach of this home (or, for the homeless, whatever's left).
  const care = careFactors(state, room ? room.id : null);
  const shared = needsHealth(state, cfg) + (1 - care.clinic) * h.noCareHealth + mod.health + care.health;
  // Worn shared rooms (the galley, restrooms, workplaces) get everyone down; worn homes, their own residents.
  const sharedComfort = mod.comfort + care.comfort - sharedWear(state) * CONDITION.happiness.sharedComfort;
  // Diners without a seat at a galley or canteen within reach eat on the go.
  const pop = state.population;
  const unserved = (served: number) => (1 - served) * h.unservedComfort;
  if (!room) return { noise: 0, comfort: clamp(h.homelessComfort + sharedComfort - unserved(pop.servedHomeless ?? pop.served ?? 1), -lim, lim), health: clamp(shared, -lim, lim) };
  const seated = pop.servedByHome?.[room.id] ?? pop.served ?? 1;
  // Parks, plazas and gyms within walking reach.
  const amen = amenityFelt(state, room);

  const field = state.effects.field;
  const def = roomDef(room.type);
  const own = def.effects.filter((e) => e.residentsOnly && e.type === "comfort").reduce((s, e) => s + e.strength, 0);
  const view = shaftView(state.layout, room, cfg);
  return {
    noise: clamp(effectOnRoom(field, "noise", room) * mod.noiseFactor, -lim, lim),
    comfort: clamp(own + view + sharedComfort - unserved(seated) + amen.comfort + homeWearComfort(room) + effectOnRoom(field, "comfort", room) + effectOnRoom(field, "smell", room), -lim, lim),
    // Stale air (outer rings, industry) wears on health; ventilation and green space freshen it.
    health: clamp(effectOnRoom(field, "health", room) + (effectOnRoom(field, "airQuality", room) + crowdedAir(state, room)) * h.airHealth + amen.health + shared, -lim, lim),
  };
}

/**
 * The afterglow of the adventure: happiness points a new hole starts with,
 * easing away (slowly, then faster, then slowly) until reality sets in.
 */
export function afterglow(state: SimState, cfg: SimConfig): number {
  const a = cfg.happiness.afterglow;
  const t = (state.tick - state.foundedTick) / (a.days * cfg.ticksPerDay);
  if (t >= 1 || a.points <= 0) return 0;
  return a.points * 0.5 * (1 + Math.cos(Math.PI * Math.max(0, t)));
}

/** Days left before the afterglow is gone. */
export function afterglowDaysLeft(state: SimState, cfg: SimConfig): number {
  return Math.max(0, cfg.happiness.afterglow.days - (state.tick - state.foundedTick) / cfg.ticksPerDay);
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
  // Seats and care within reach, shared out by where people lived at the last update.
  updateDining(state, cfg);
  updateCare(state);
  const prev = new Map(state.happiness.pools.map((p) => [p.roomId, p]));
  const homes = state.layout.rooms.filter((r) => isActive(r) && (roomDef(r.type).houses ?? 0) > 0);

  const glow = afterglow(state, cfg);
  const pools: HousingPool[] = homes.map((room) => {
    const factors = homeFactors(state, room, cfg);
    const target = clamp(targetHappiness(factors, cfg) + glow, 0, 100);
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

  const homelessTarget = clamp(targetHappiness(homeFactors(state, null, cfg), cfg) + glow, 0, 100);
  const pop = state.population.count;
  const total = pools.reduce((s, p) => s + p.residents * p.happiness, 0) + left * homelessTarget;
  const average = pop > 0 ? total / pop : 50;

  state.happiness = { pools, homeless: left, average, productivity: productivity(average, cfg), afterglow: glow };
}

export function stepHappiness(state: SimState, cfg: SimConfig): void {
  if (state.tick % cfg.happiness.updateEveryTicks === 0) updateHappiness(state, cfg);
  afterglowNews(state, cfg);
}

/** Word when the thrill of arrival is half gone, and when it's gone. */
function afterglowNews(state: SimState, cfg: SimConfig): void {
  const since = state.tick - state.foundedTick;
  if (since <= 0 || since % cfg.ticksPerDay !== 0) return;
  const day = since / cfg.ticksPerDay;
  const { days } = cfg.happiness.afterglow;
  if (day === Math.round(days / 2)) {
    postMessage(state, cfg, `The thrill of landing is wearing off in ${state.name}. In about ${days - day} days the colonists' spirits will rest on the life you've built them.`, "warn");
  } else if (day === days) {
    postMessage(state, cfg, `The afterglow has faded in ${state.name}: from now on, happiness is down to homes, quiet, health and comfort.`, "warn");
  }
}
