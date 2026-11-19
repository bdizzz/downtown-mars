import { varietyComfort } from "./food";
import type { SimConfig } from "./config";
import { isActive } from "./economy";
import { effectOnRoom } from "./effects";
import type { RoomInstance } from "./placement";
import { windowComfort } from "./windows";
import { modifiers } from "./ordinances";
import { careFactors, updateCare } from "./care";
import { CONDITION, homeWearComfort, sharedWear } from "./condition";
import { liningComfort, refitComfort, sharedLiningComfort } from "./materials";
import { roomDef } from "./rooms";
import type { SimState } from "./state";
import { postMessage } from "./messages";
import { config } from "./config";
import { amenityFelt, updateDining, updateSanitation } from "./amenities";
import { eventMood, festivalWork } from "./events";
import { temperatureComfort } from "./temperature";
import { commuteComfort, foodWalkComfort, syncColonists } from "./colonists";

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
  /** What makes up its target, in happiness points per cause (partPoints; missing in old saves until the next update). */
  points?: Record<string, number>;
}

/** The hole's people's own needs on average (#526), each a factor (−3..+3), and their walks in metres. */
export interface Needs {
  comfort: number;
  fed: number;
  health: number;
  /** Metres from bed to work, over those with both. */
  commuteM: number;
  /** Metres from bed to the nearest galley, over those with a bed. */
  foodM: number;
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
  /** What makes up the average, in points per cause, weighted by who feels it (homes and the homeless; missing in old saves until the next update). */
  points?: Record<string, number>;
  /** The people's own needs on average (missing in old saves until the next update). */
  needs?: Needs;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Points rounded to a tenth, the negligible ones dropped, to keep saves small. */
function tidy(points: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, v] of Object.entries(points)) if (Math.abs(v) >= 0.05) out[id] = Math.round(v * 10) / 10;
  return out;
}

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

/** How well needs are met, as a health factor: 0 at full health, −3 at none. */
function needsHealth(state: SimState, cfg: SimConfig): number {
  return ((state.population.health - 100) / 100) * cfg.happiness.factorLimit;
}

/** One thing a home feels, on one factor (−3..+3 before the factor's clamp); ids name the causes in data/diagnosis.json. */
export interface Part {
  id: string;
  factor: keyof Factors;
  value: number;
}

/** Everything that adds up to a home's three factors (or, with no room, the homeless's), part by part. */
export function homeParts(state: SimState, room: RoomInstance | null, cfg: SimConfig): Part[] {
  const h = cfg.happiness;
  const mod = modifiers(state);
  // Clinic, school and elder-care places within reach of this home (or, for the homeless, whatever's left).
  const care = careFactors(state, room ? room.id : null);
  const pop = state.population;
  const parts: Part[] = [];
  const add = (id: string, factor: keyof Factors, value: number) => {
    if (value) parts.push({ id, factor, value });
  };
  // Shared by everyone: the hole's own health, care, ordinances.
  add("holeHealth", "health", needsHealth(state, cfg));
  add("noClinic", "health", (1 - care.clinic) * h.noCareHealth);
  add("elderCare", "health", care.health);
  add("ordinanceHealth", "health", mod.health);
  add("ordinanceComfort", "comfort", mod.comfort);
  add("schooling", "comfort", care.school);
  add("grief", "comfort", care.grief);
  // Worn shared rooms (the galley, restrooms, workplaces) get everyone down; worn homes, their own residents.
  // Lined ones (brick, metal) lift everyone a little; a home's own lining, its residents.
  add("sharedWear", "comfort", -sharedWear(state) * CONDITION.happiness.sharedComfort);
  add("sharedLining", "comfort", sharedLiningComfort(state));
  // How varied the meals have been this past month (food.ts).
  add("variety", "comfort", varietyComfort(state));
  // Diners without a seat at a galley or canteen within reach eat on the go;
  // and those without a restroom within reach (or a bathroom at home) go without.
  const seated = room ? (pop.servedByHome?.[room.id] ?? pop.served ?? 1) : (pop.servedHomeless ?? pop.served ?? 1);
  const sanitation = room ? (pop.sanitationByHome?.[room.id] ?? 1) : (pop.sanitationHomeless ?? 1);
  add("noSeat", "comfort", -(1 - seated) * h.unservedComfort);
  add("noRestroom", "comfort", -(1 - sanitation) * h.noRestroomComfort);
  // Cold homes (or hot ones): the floor's temperature (temperature.ts).
  add("temperature", "comfort", temperatureComfort(state, room, cfg));
  if (!room) {
    add("homeless", "comfort", h.homelessComfort);
    return parts;
  }
  // Parks, plazas, gyms and restrooms within walking reach.
  const amen = amenityFelt(state, room);
  const field = state.effects.field;
  const def = roomDef(room.type);
  add("ownComfort", "comfort", def.effects.filter((e) => e.residentsOnly && e.type === "comfort").reduce((sum, e) => sum + e.strength, 0));
  // Its windows (none until the player puts them in): the view.
  add("windows", "comfort", windowComfort(state.layout, room, cfg));
  add("amenityComfort", "comfort", amen.comfort);
  add("homeWear", "comfort", homeWearComfort(room));
  add("lining", "comfort", liningComfort(room) + refitComfort(state, room));
  add("neighbourComfort", "comfort", effectOnRoom(field, "comfort", room));
  add("smell", "comfort", effectOnRoom(field, "smell", room));
  add("noise", "noise", effectOnRoom(field, "noise", room) * mod.noiseFactor);
  // Stale air (outer rings, industry) wears on health; ventilation and green space freshen it.
  add("airQuality", "health", effectOnRoom(field, "airQuality", room) * h.airHealth);
  add("crowding", "health", crowdedAir(state, room) * h.airHealth);
  add("neighbourHealth", "health", effectOnRoom(field, "health", room));
  add("amenityHealth", "health", amen.health);
  return parts;
}

/** The three factors from their parts, each clamped to the factor limit. */
export function sumParts(parts: Part[], cfg: SimConfig): Factors {
  const lim = cfg.happiness.factorLimit;
  const f: Factors = { noise: 0, comfort: 0, health: 0 };
  for (const p of parts) f[p.factor] += p.value;
  return { noise: clamp(f.noise, -lim, lim), comfort: clamp(f.comfort, -lim, lim), health: clamp(f.health, -lim, lim) };
}

/**
 * Each part's share of a home's happiness, in points: its factor's weight
 * times its value, scaled down with the rest of its factor when the factor
 * hits its limit, so they add up to what the home feels.
 */
export function partPoints(parts: Part[], cfg: SimConfig): Record<string, number> {
  const raw: Factors = { noise: 0, comfort: 0, health: 0 };
  for (const p of parts) raw[p.factor] += p.value;
  const felt = sumParts(parts, cfg);
  const out: Record<string, number> = {};
  for (const p of parts) {
    const scale = raw[p.factor] ? felt[p.factor] / raw[p.factor] : 1;
    out[p.id] = (out[p.id] ?? 0) + p.value * scale * cfg.happiness.weights[p.factor];
  }
  return out;
}

export function homeFactors(state: SimState, room: RoomInstance | null, cfg: SimConfig): Factors {
  return sumParts(homeParts(state, room, cfg), cfg);
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
 * Bring the people in step (their beds and jobs, colonists.ts), then ease each
 * home's happiness toward its target, and work out each person's own. With
 * `settle`, jump straight to the targets (for a new game).
 */
export function updateHappiness(state: SimState, cfg: SimConfig, settle = false): void {
  const h = cfg.happiness;
  // Everyone in step with the cohorts, with a job and a bed if there's one for them (colonists.ts).
  syncColonists(state, cfg);
  const c = state.colonists!;
  // Seats, restrooms and care within reach, shared out by where people lived at the last update.
  updateDining(state, cfg);
  updateSanitation(state);
  updateCare(state);
  const prev = new Map(state.happiness.pools.map((p) => [p.roomId, p]));
  const homes = state.layout.rooms.filter((r) => isActive(r) && (roomDef(r.type).houses ?? 0) > 0);

  // Each person's own parts (#525, #526): their walk to work and to the galley, in comfort.
  const own = new Array<number>(c.id.length);
  const ownParts = (i: number) => ({ commute: commuteComfort(c.workM[i]!), foodWalk: foodWalkComfort(c.foodM[i]!) });
  // Who lives where: the people's own beds, and the average of their own parts there.
  const residents = new Map<number, number>();
  const ownSum = new Map<number, { commute: number; foodWalk: number }>();
  let homeless = 0;
  for (let i = 0; i < c.id.length; i++) {
    const home = c.home[i]!;
    const p = ownParts(i);
    own[i] = (p.commute + p.foodWalk) * h.weights.comfort;
    if (home < 0) homeless++;
    residents.set(home, (residents.get(home) ?? 0) + 1);
    const sum = ownSum.get(home) ?? { commute: 0, foodWalk: 0 };
    sum.commute += p.commute;
    sum.foodWalk += p.foodWalk;
    ownSum.set(home, sum);
  }
  /** The own parts of a home's residents (or the homeless's: home −1), on average, as parts of its comfort. */
  const ownOf = (home: number): Part[] => {
    const n = residents.get(home) ?? 0;
    const sum = ownSum.get(home);
    if (!n || !sum) return [];
    const out: Part[] = [];
    if (sum.commute) out.push({ id: "commute", factor: "comfort", value: sum.commute / n });
    if (sum.foodWalk) out.push({ id: "foodWalk", factor: "comfort", value: sum.foodWalk / n });
    return out;
  };
  /** Those parts in points, on top of the home's (they aren't held to the factor's limit with the rest). */
  const ownPoints = (parts: Part[]) => parts.reduce((sum, p) => sum + p.value * h.weights[p.factor], 0);

  // The afterglow, and how recent events have left everyone feeling.
  const glow = afterglow(state, cfg) + eventMood(state);
  const pools: HousingPool[] = homes.map((room) => {
    const parts = homeParts(state, room, cfg);
    const factors = sumParts(parts, cfg);
    const extra = ownOf(room.id);
    const target = clamp(targetHappiness(factors, cfg) + glow + ownPoints(extra), 0, 100);
    const old = prev.get(room.id);
    const points = partPoints(parts, cfg);
    for (const p of extra) points[p.id] = p.value * h.weights[p.factor];
    return { roomId: room.id, capacity: roomDef(room.type).houses!, residents: residents.get(room.id) ?? 0, happiness: old?.happiness ?? target, target, factors, points: tidy(points) };
  });

  const ease = settle ? 1 : Math.min(1, h.updateEveryTicks / (h.easeDays * cfg.ticksPerDay));
  for (const p of pools) p.happiness += (p.target - p.happiness) * ease;

  const homelessParts = homeParts(state, null, cfg);
  const homelessExtra = ownOf(-1);
  const homelessTarget = clamp(targetHappiness(sumParts(homelessParts, cfg), cfg) + glow + ownPoints(homelessExtra), 0, 100);
  const pop = state.population.count;
  const total = pools.reduce((s, p) => s + p.residents * p.happiness, 0) + homeless * homelessTarget;
  const average = pop > 0 ? total / pop : 50;

  // The causes across the hole, weighted by how many feel each.
  const points: Record<string, number> = {};
  const weigh = (pts: Record<string, number>, n: number) => {
    for (const [id, v] of Object.entries(pts)) points[id] = (points[id] ?? 0) + (v * n) / Math.max(1, pop);
  };
  for (const p of pools) if (p.residents > 0) weigh(p.points ?? {}, p.residents);
  if (homeless > 0) {
    const pts = partPoints(homelessParts, cfg);
    for (const p of homelessExtra) pts[p.id] = p.value * h.weights[p.factor];
    weigh(pts, homeless);
  }

  // Each person (#526): their home's happiness, give or take how their own walks compare with their neighbours';
  // and their own needs, from their home's factors and their own parts. The hole's numbers are their averages.
  const byRoom = new Map(pools.map((p) => [p.roomId, p]));
  const homelessFactors = sumParts(homelessParts, cfg);
  const seatedAt = (home: number) => (home < 0 ? (state.population.servedHomeless ?? 1) : (state.population.servedByHome?.[home] ?? 1));
  const needs: Needs = { comfort: 0, fed: 0, health: 0, commuteM: 0, foodM: 0 };
  let commuters = 0;
  let housed = 0;
  const lim = h.factorLimit;
  const meanOwnAt = new Map<number, number>();
  for (let i = 0; i < c.id.length; i++) {
    const home = c.home[i]!;
    const pool = byRoom.get(home);
    let meanOwn = meanOwnAt.get(home);
    if (meanOwn === undefined) meanOwnAt.set(home, (meanOwn = ownPoints(ownOf(home))));
    const base = pool ? pool.happiness : homelessTarget;
    c.happiness[i] = clamp(base + own[i]! - meanOwn, 0, 100);
    const f = pool ? pool.factors : homelessFactors;
    const p = ownParts(i);
    c.comfort[i] = clamp(f.comfort + p.commute + p.foodWalk, -lim, lim);
    c.health[i] = f.health;
    c.fed[i] = clamp(-(1 - seatedAt(home)) * h.unservedComfort + p.foodWalk, -lim, lim);
    needs.comfort += c.comfort[i]!;
    needs.fed += c.fed[i]!;
    needs.health += c.health[i]!;
    if (c.job[i]! >= 0 && home >= 0) {
      commuters++;
      needs.commuteM += c.workM[i]!;
    }
    if (home >= 0 && c.food[i]! >= 0) {
      housed++;
      needs.foodM += c.foodM[i]!;
    }
  }
  const people = Math.max(1, c.id.length);
  needs.comfort /= people;
  needs.fed /= people;
  needs.health /= people;
  needs.commuteM = commuters ? needs.commuteM / commuters : 0;
  needs.foodM = housed ? needs.foodM / housed : 0;

  // A festival's day off slows work as well.
  state.happiness = { pools, homeless, average, productivity: productivity(average, cfg) * festivalWork(state, cfg), afterglow: glow, points: tidy(points), needs };
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
    postMessage(state, cfg, `The thrill of landing is wearing off in ${state.name}. In about ${days - day} months the colonists' spirits will rest on the life you've built them.`, "warn");
  } else if (day === days) {
    postMessage(state, cfg, `The afterglow has faded in ${state.name}: from now on, happiness is down to homes, quiet, health and comfort.`, "warn");
  }
}
