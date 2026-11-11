import raw from "../../data/food.json";
import type { SimConfig } from "./config";
import { record } from "./ledger";
import { noteMade } from "./origins";
import type { RoomInstance } from "./placement";
import { cropDef, cropDefs, isCrop, longGrowBonus, type CropDef } from "./resources";
import { roomDef } from "./rooms";
import type { SimState } from "./state";

// Harvest cycles, food by type and meal variety (#375).
//
// A farm's crop grows on a counter: its output piles up out of sight (banked), at whatever rate the
// farm runs, and arrives all at once when the counter fills, with a bonus for a long grow time. The
// raw food it brings is kept by type, one per crop. Kitchens cook each meal from up to four types in
// equal shares, and the more types, the better the meal; the meals eaten over the last month make
// the hole's food variety, which everyone feels.

export interface Quality {
  id: string;
  name: string;
  /** Felt by every home, on the comfort factor. */
  comfort: number;
}

export const FOOD = raw as {
  maxTypes: number;
  mixed: { id: string; name: string };
  unknownMeals: number;
  varietyMonths: number;
  qualities: Quality[];
  visits: { onlyShare: number; minMealsPerPerson: number };
};
export const QUALITIES = FOOD.qualities;

/** A farm's harvest cycle: months grown so far, and what its crop has made toward the harvest. */
export interface Growth {
  days: number;
  banked: number;
  /** Harvests brought in so far (absent: none yet). */
  harvests?: number;
}

/** Raw food by type, meals by quality, and meals eaten a month by quality (smoothed over varietyMonths). */
export interface FoodState {
  types: Record<string, number>;
  meals: number[];
  eaten: number[];
}

const EPS = 1e-9;
const zeros = () => QUALITIES.map(() => 0);

// ---- harvest cycles ----

/** The crop a farm grows, or null for a room that doesn't grow crops. */
export function farmCrop(room: RoomInstance): CropDef | null {
  const def = roomDef(room.type);
  if (!def.growsCrops) return null;
  const id = room.crop ?? def.defaultCrop;
  return id && isCrop(id) ? cropDef(id) : null;
}

/** What a crop yields: raw food, or what it makes instead (hemp's fiber). */
export const cropMakes = (crop: CropDef): string => crop.makes ?? "rawFood";

/** The bonus on a harvest for its grow time: 0..longGrowBonus.max. */
export function harvestBonus(crop: CropDef): number {
  const b = longGrowBonus;
  const t = (crop.growMonths - b.fromMonths) / (b.toMonths - b.fromMonths);
  return b.max * Math.max(0, Math.min(1, t));
}

/** A whole harvest at full work, from a farm making `perMonth` on average: perMonth × growMonths × the bonus. */
export function harvestSize(crop: CropDef, perMonth: number = crop.yield): number {
  return perMonth * crop.growMonths * (1 + harvestBonus(crop));
}

/** A farm's harvest so far: how far along (0..1), months to go, and what it would bring if it kept working as it has. */
export function harvestProgress(room: RoomInstance, perMonth: number): { share: number; monthsLeft: number; expected: number; full: number; slowed: boolean } | null {
  const crop = farmCrop(room);
  if (!crop) return null;
  const g = room.growth ?? { days: 0, banked: 0 };
  const share = Math.max(0, Math.min(1, g.days / crop.growMonths));
  const full = harvestSize(crop, perMonth);
  // What's banked so far, plus the rest of the cycle at the pace kept so far (full pace before it starts).
  const pace = g.days > EPS ? g.banked / g.days : perMonth;
  const expected = (g.banked + pace * Math.max(0, crop.growMonths - g.days)) * (1 + harvestBonus(crop));
  return { share, monthsLeft: Math.max(0, crop.growMonths - g.days), expected, full, slowed: expected < full * 0.97 };
}

/** The farm's crop output this tick goes toward its harvest, not into the stores. */
export function bank(room: RoomInstance, amount: number): void {
  const g = (room.growth ??= { days: 0, banked: 0 });
  g.banked += amount;
}

/** Starts a farm's cycle over (a new crop). */
export function replant(room: RoomInstance): void {
  room.growth = { days: 0, banked: 0 };
}

/**
 * Every working farm's counter moves on a tick, at a steady pace whatever the farm is doing; when it
 * fills, what the crop made comes in as a whole harvest, with its bonus, and the counter starts over.
 */
export function stepHarvests(state: SimState, cfg: SimConfig, rooms: RoomInstance[]): void {
  const dt = 1 / cfg.ticksPerDay;
  const res = state.resources;
  for (const room of rooms) {
    const crop = farmCrop(room);
    if (!crop) continue;
    const g = (room.growth ??= { days: 0, banked: 0 });
    g.days += dt;
    if (g.days < crop.growMonths - EPS) continue;
    const amount = g.banked * (1 + harvestBonus(crop));
    const out = cropMakes(crop);
    if (amount > 0) {
      res[out] = (res[out] ?? 0) + amount;
      record(state, out, "in", crop.farmName, amount);
      noteMade(state, out, amount, room.id);
      state.harvested = (state.harvested ?? 0) + amount;
      if (out === "rawFood") addFood(state, crop.id, amount);
    }
    room.growth = { days: Math.max(0, g.days - crop.growMonths), banked: 0, harvests: (g.harvests ?? 0) + 1 };
  }
}

// ---- food by type ----

function foodState(state: SimState): FoodState {
  state.food ??= { types: {}, meals: zeros(), eaten: zeros() };
  return state.food;
}

/** Raw food of one type comes in. */
export function addFood(state: SimState, type: string, amount: number): void {
  const f = foodState(state);
  f.types[type] = (f.types[type] ?? 0) + amount;
}

/** A food type's name: its crop's, or the mixed stores'. */
export function foodTypeName(type: string): string {
  return isCrop(type) ? cropDef(type).name : FOOD.mixed.name;
}

/** The edible crops, the food types there can be. */
export const edibleCrops = (): CropDef[] => cropDefs.filter((c) => cropMakes(c) === "rawFood");

/**
 * Keep the stocks by type and quality in step with the hole's raw food and meals, whatever moved
 * them (storage overflow, convoys, events, the console): what went missing comes off every type in
 * proportion, and what turned up from nowhere is mixed stores (raw food) or meals of unknown quality.
 */
export function reconcileFood(state: SimState): void {
  const f = foodState(state);
  fit(f.types, state.resources.rawFood ?? 0, FOOD.mixed.id);
  const meals = Object.fromEntries(f.meals.map((v, i) => [String(i), v]));
  fit(meals, state.resources.meals ?? 0, String(FOOD.unknownMeals));
  f.meals = QUALITIES.map((_, i) => meals[String(i)] ?? 0);
  for (const [k, v] of Object.entries(f.types)) if (v <= EPS) delete f.types[k];
}

function fit(parts: Record<string, number>, total: number, extra: string): void {
  const sum = Object.values(parts).reduce((a, v) => a + v, 0);
  if (sum > total + EPS) {
    const k = sum > 0 ? total / sum : 0;
    for (const id of Object.keys(parts)) parts[id] = parts[id]! * k;
  } else if (sum < total - EPS) parts[extra] = (parts[extra] ?? 0) + (total - sum);
}

/**
 * Raw food for cooking: `amount` from up to maxTypes types in equal shares, the most-stocked first,
 * so each meal is the best the stocks allow. Returns how much went into meals of each quality.
 */
export function drawFood(state: SimState, amount: number): number[] {
  const f = foodState(state);
  const out = zeros();
  let left = amount;
  while (left > EPS) {
    const stocked = Object.entries(f.types)
      .filter(([, v]) => v > EPS)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (!stocked.length) break;
    const n = Math.min(FOOD.maxTypes, stocked.length, QUALITIES.length);
    const top = stocked.slice(0, n);
    const each = Math.min(left / n, top[n - 1]![1]);
    for (const [id] of top) f.types[id] = f.types[id]! - each;
    out[n - 1]! += each * n;
    left -= each * n;
  }
  // Raw food the types don't account for (shouldn't happen once reconciled) is plain fare.
  if (left > EPS) out[0]! += left;
  return out;
}

/** A kitchen cooked `meals` from `fromRaw` raw food and `fromRations` Earth rations (always poor). */
export function cooked(state: SimState, meals: number, fromRaw: number, fromRations: number): void {
  const f = foodState(state);
  const byQuality = drawFood(state, fromRaw);
  byQuality[0]! += fromRations;
  const input = fromRaw + fromRations;
  if (input <= EPS) return;
  for (let q = 0; q < byQuality.length; q++) f.meals[q] = (f.meals[q] ?? 0) + (meals * byQuality[q]!) / input;
}

/** People ate `amount` meals over `dt` days: from every quality in proportion, and remembered for the variety rating. */
export function ate(state: SimState, amount: number, dt: number): void {
  const f = foodState(state);
  const stock = f.meals.reduce((a, v) => a + v, 0);
  const alpha = Math.min(1, dt / FOOD.varietyMonths);
  for (let q = 0; q < QUALITIES.length; q++) {
    const share = stock > EPS ? (f.meals[q] ?? 0) / stock : q === FOOD.unknownMeals ? 1 : 0;
    const eaten = amount * share;
    f.meals[q] = Math.max(0, (f.meals[q] ?? 0) - eaten);
    f.eaten[q] = (f.eaten[q] ?? 0) * (1 - alpha) + (eaten / dt) * alpha;
  }
}

// ---- food variety ----

export interface Variety {
  /** The rating's index in QUALITIES (0 poor .. 3 great). */
  rating: number;
  /** Each quality's share of the meals eaten over the last month. */
  shares: number[];
  /** Meals eaten a month. */
  perMonth: number;
}

/** The hole's food variety, from the meals eaten over the last month; null before anyone has eaten a meal. */
export function variety(state: Pick<SimState, "food">): Variety | null {
  const eaten = state.food?.eaten;
  if (!eaten) return null;
  const perMonth = eaten.reduce((a, v) => a + v, 0);
  if (perMonth <= 0.01) return null;
  const shares = eaten.map((v) => v / perMonth);
  const score = shares.reduce((a, s, q) => a + s * q, 0);
  return { rating: Math.max(0, Math.min(QUALITIES.length - 1, Math.round(score))), shares, perMonth };
}

/** What the food variety does for every home's comfort. */
export function varietyComfort(state: Pick<SimState, "food">): number {
  const v = variety(state);
  return v ? QUALITIES[v.rating]!.comfort : 0;
}

/** The edible crops this hole doesn't grow yet, by name: what a visitor suggests. */
export function cropsNotGrown(state: SimState): string[] {
  const grown = new Set(state.layout.rooms.map((r) => farmCrop(r)?.id).filter(Boolean));
  return edibleCrops()
    .filter((c) => !grown.has(c.id))
    .map((c) => c.name.toLowerCase());
}

// ---- old saves ----

/**
 * Save v23: farms were mid-cycle all along (halfway, as if they'd worked flat out), and the raw food
 * in store is split across the crops grown, by what each farm makes, or mixed stores if none.
 */
export function migrateFood(state: SimState, perMonth: (room: RoomInstance) => number): void {
  const grown: Record<string, number> = {};
  for (const room of state.layout.rooms) {
    const crop = farmCrop(room);
    if (!crop) continue;
    const made = perMonth(room);
    if (!room.planned && !room.building) room.growth = { days: crop.growMonths / 2, banked: (made * crop.growMonths) / 2 };
    if (cropMakes(crop) === "rawFood") grown[crop.id] = (grown[crop.id] ?? 0) + made;
  }
  const raw = state.resources.rawFood ?? 0;
  const total = Object.values(grown).reduce((a, v) => a + v, 0);
  const types: Record<string, number> = {};
  if (raw > 0) {
    if (total > 0) for (const [id, v] of Object.entries(grown)) types[id] = (raw * v) / total;
    else types[FOOD.mixed.id] = raw;
  }
  const meals = zeros();
  meals[FOOD.unknownMeals] = state.resources.meals ?? 0;
  state.food = { types, meals, eaten: zeros() };
}
