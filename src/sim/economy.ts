import type { SimConfig } from "./config";
import type { RoomInstance } from "./placement";
import { LABELS, record } from "./ledger";
import { modifiers, type Modifiers } from "./ordinances";
import { cropDef, resourceDef, resourceDefs } from "./resources";
import { roomDef } from "./rooms";
import type { SimState } from "./state";
import { countStage, needsWeight, type Cohort } from "./people";

// The per-tick economy: staff the rooms, run them, feed the colonists, cap
// storage. Every amount in the data is per game day, so each tick moves
// 1/ticksPerDay of it.

export interface RoomSpec {
  staff: number;
  uses: Record<string, number>;
  makes: Record<string, number>;
  scrubs: Record<string, number>;
  stores: Record<string, number>;
  sanitation: number;
}

export interface RoomStatus {
  staff: number;
  staffNeeded: number;
  /** 0..1 of full output this tick. */
  rate: number;
  /** Why it isn't at full rate: "staff", a resource id it's short of, or "full:<id>". */
  limit?: string;
}

export interface Population {
  /** Everyone, all stages: kept in step with cohorts (see people.ts). */
  count: number;
  cohorts: Cohort[];
  /** 0..100, hole-wide, from how well needs are met. */
  health: number;
  /** 0..1 per need, last tick. */
  needsMet: Record<string, number>;
  /** 0..1 of colonists with a restroom. */
  sanitation: number;
}

/**
 * A room's effective numbers: its catalog entry, adjusted for crop, and scaled
 * when a deep room's wedge covers more slots than its nominal size.
 */
export function roomSpec(room: RoomInstance, cfg: SimConfig): RoomSpec {
  const def = roomDef(room.type);
  const uses = { ...def.uses };
  const makes = { ...def.makes };
  if (def.growsCrops && room.crop) {
    const crop = cropDef(room.crop);
    uses.water = crop.water;
    uses.power = crop.power;
    makes.rawFood = crop.yield;
  }
  const nominal = cfg.economy.nominalSlots[def.size] ?? 1;
  const k = room.at.kind === "ring" ? room.cells.length / nominal : 1;
  const scale = (r: Record<string, number>) => Object.fromEntries(Object.entries(r).map(([id, v]) => [id, v * k]));
  return {
    staff: Math.round(def.staff * k),
    uses: scale(uses),
    makes: scale(makes),
    scrubs: scale(def.scrubs ?? {}),
    stores: def.stores ?? {},
    sanitation: (def.sanitation ?? 0) * k,
  };
}

/** The stored good a room exists to make, if any: what "stop at" watches. */
export function mainOutput(room: RoomInstance, cfg: SimConfig): string | null {
  const id = Object.keys(roomSpec(room, cfg).makes).find((k) => {
    const def = resourceDefs.find((r) => r.id === k);
    return def && !def.flow && !def.waste;
  });
  return id ?? null;
}

/** Why a working room is standing down by the player's choice, if it is. */
export function standDown(room: RoomInstance, state: SimState, cfg: SimConfig): string | null {
  const res = state.resources;
  if (room.paused) return "paused";
  // A staging bay works only while the player has asked for a kit.
  if (roomDef(room.type).stagesSeedKit && !state.gatheringKit) return "kit";
  if (room.stopAt !== undefined) {
    const out = mainOutput(room, cfg);
    if (out && (res[out] ?? 0) >= room.stopAt) return `stocked:${out}`;
  }
  return null;
}

/** A room does anything only once it's built and reachable. */
export function isActive(room: RoomInstance): boolean {
  return !room.planned && room.connected;
}

export function capacities(state: SimState, cfg: SimConfig): Record<string, number> {
  const caps: Record<string, number> = {};
  for (const r of resourceDefs) caps[r.id] = r.baseCapacity;
  for (const room of state.layout.rooms) {
    if (room.planned) continue;
    for (const [id, v] of Object.entries(roomSpec(room, cfg).stores)) caps[id] = (caps[id] ?? 0) + v;
  }
  return caps;
}

function priorityOrder(cfg: SimConfig) {
  const rank = new Map(cfg.economy.priorities.map((p, i) => [p, i]));
  return (a: RoomInstance, b: RoomInstance) => (rank.get(a.priority) ?? 99) - (rank.get(b.priority) ?? 99) || a.id - b.id;
}

export function stepEconomy(state: SimState, cfg: SimConfig): void {
  const dt = 1 / cfg.ticksPerDay;
  const res = state.resources;
  const caps = capacities(state, cfg);
  const rooms = state.layout.rooms.filter(isActive).sort(priorityOrder(cfg));
  const specs = new Map(rooms.map((r) => [r.id, roomSpec(r, cfg)]));
  const status: Record<number, RoomStatus> = {};

  // 1. Staff, highest priority first. Rooms the player stood down take no one.
  // Only adults work.
  const adults = countStage(state, "adult");
  let free = adults;
  const down = new Map<number, string>();
  for (const r of rooms) {
    const why = standDown(r, state, cfg);
    if (why) down.set(r.id, why);
  }
  for (const r of rooms) {
    const need = down.has(r.id) ? 0 : specs.get(r.id)!.staff;
    const got = Math.min(need, free);
    free -= got;
    status[r.id] = { staff: got, staffNeeded: need, rate: 0 };
  }
  state.workforce = { total: adults, employed: adults - free };

  // 2. Run rooms. Pure producers (solar) go first so power is there for the rest.
  const mod = modifiers(state);
  const producers = rooms.filter((r) => Object.keys(specs.get(r.id)!.uses).length === 0);
  const others = rooms.filter((r) => Object.keys(specs.get(r.id)!.uses).length > 0);
  for (const r of [...producers, ...others]) {
    const why = down.get(r.id);
    if (why) status[r.id] = { staff: 0, staffNeeded: specs.get(r.id)!.staff, rate: 0, limit: why };
    else runRoom(r, specs.get(r.id)!, status[r.id]!, state, caps, cfg, dt, mod);
  }
  state.roomStatus = status;

  // 3. Colonists.
  stepColonists(state, rooms, specs, status, cfg, dt, mod);

  // 4. Storage limits; the excess is lost.
  for (const [id, v] of Object.entries(res)) {
    const cap = caps[id] ?? Infinity;
    if (v > cap) {
      record(state, id, "out", LABELS.lost, v - cap);
      res[id] = cap;
    }
  }
}

function available(res: Record<string, number>, id: string, subs: string[] = []): number {
  return [id, ...subs].reduce((sum, k) => sum + (res[k] ?? 0), 0);
}

/** Take an input, falling back to substitutes; records what was actually used. */
function consume(state: SimState, id: string, amount: number, subs: string[], label: string): void {
  const res = state.resources;
  let left = amount;
  for (const k of [id, ...subs]) {
    const take = Math.min(left, res[k] ?? 0);
    res[k] = (res[k] ?? 0) - take;
    record(state, k, "out", label, take);
    left -= take;
    if (left <= 0) break;
  }
}

function runRoom(
  room: RoomInstance,
  spec: RoomSpec,
  st: RoomStatus,
  state: SimState,
  caps: Record<string, number>,
  cfg: SimConfig,
  dt: number,
  mod: Modifiers,
): void {
  const res = state.resources;
  const subs = roomDef(room.type).substitutes ?? {};
  let rate = spec.staff > 0 ? st.staff / spec.staff : 1;
  let limit: string | undefined = rate < 1 ? "staff" : undefined;
  // Unhappy colonists work slower; rooms with no staff aren't affected.
  if (spec.staff > 0 && state.happiness.productivity < 1) {
    rate *= state.happiness.productivity;
    if (state.happiness.productivity < NOTICEABLE) limit ??= "morale";
  }
  if (mod.noisyRoomOutput < 1 && roomDef(room.type).effects.some((e) => e.type === "noise")) {
    rate *= mod.noisyRoomOutput;
    limit ??= "ordinance";
  }

  for (const [id, perDay] of Object.entries(spec.uses)) {
    const need = perDay * rate * dt;
    if (need <= 0) continue;
    const f = available(res, id, subs[id]) / need;
    if (f < 1) {
      rate *= Math.max(0, f);
      limit = id;
    }
  }

  // Don't make what can't be stored: slow down only when every main output is
  // full (a full byproduct, like a farm's oxygen, is just lost). Waste and
  // power never hold a room back. A room with air to scrub keeps running for
  // that alone, venting whatever it makes.
  let outputF = -1;
  let fullOf = "";
  for (const [id, perDay] of Object.entries(spec.makes)) {
    const def = resourceDef(id);
    if (def.waste || def.flow) continue;
    const make = perDay * rate * dt;
    if (make <= 0) continue;
    const f = Math.max(0, (caps[id] ?? Infinity) - (res[id] ?? 0)) / make;
    if (f > outputF) outputF = f;
    if (f < 1) fullOf ||= id;
  }
  for (const [id, perDay] of Object.entries(spec.scrubs)) {
    const want = perDay * rate * dt;
    if (want > 0) outputF = Math.max(outputF, (Math.max(0, (res[id] ?? 0) - scrubFloor(id, cfg))) / want);
  }
  if (outputF >= 0 && outputF < 1) {
    rate *= outputF;
    limit = `full:${fullOf}`;
  }

  const label = roomDef(room.type).name;
  for (const [id, perDay] of Object.entries(spec.uses)) consume(state, id, perDay * rate * dt, subs[id] ?? [], label);
  for (const [id, perDay] of Object.entries(spec.makes)) {
    res[id] = (res[id] ?? 0) + perDay * rate * dt;
    record(state, id, "in", label, perDay * rate * dt);
  }
  for (const [id, perDay] of Object.entries(spec.scrubs)) {
    const take = Math.min(perDay * rate * dt, Math.max(0, (res[id] ?? 0) - scrubFloor(id, cfg)));
    res[id] = (res[id] ?? 0) - take;
    record(state, id, "out", label, take);
  }

  st.rate = rate;
  if (limit) st.limit = limit;
}

/** Below this, a slowdown is worth naming in the room's status. */
const NOTICEABLE = 0.99;

/** Life support leaves a little CO2 in the air for farms. */
function scrubFloor(id: string, cfg: SimConfig): number {
  return id === "co2" ? cfg.economy.co2ScrubFloor : 0;
}

function stepColonists(
  state: SimState,
  rooms: RoomInstance[],
  specs: Map<number, RoomSpec>,
  status: Record<number, RoomStatus>,
  cfg: SimConfig,
  dt: number,
  mod: Modifiers,
): void {
  const c = cfg.colonists;
  const pop = state.population;
  const res = state.resources;
  if (pop.count <= 0) return;
  const weight = needsWeight(state);

  const met: Record<string, number> = {};
  for (const [id, perDay] of Object.entries(c.needsPerDay)) {
    const want = weight * perDay * (mod.needsMultiplier[id] ?? 1) * dt;
    const got = Math.min(want, res[id] ?? 0);
    res[id] = (res[id] ?? 0) - got;
    record(state, id, "out", LABELS.colonists, got);
    met[id] = want > 0 ? got / want : 1;
  }
  for (const [id, perDay] of Object.entries(c.makesPerDay)) {
    res[id] = (res[id] ?? 0) + weight * perDay * dt;
    record(state, id, "in", LABELS.colonists, weight * perDay * dt);
  }

  // Restrooms turn the water people drink into gray and black water.
  let seats = 0;
  let split: Record<string, number> = {};
  for (const r of rooms) {
    const spec = specs.get(r.id)!;
    if (spec.sanitation <= 0) continue;
    seats += spec.sanitation * status[r.id]!.rate;
    split = roomDef(r.type).returnsWater ?? split;
  }
  const covered = Math.min(1, seats / pop.count);
  const drunk = weight * (c.needsPerDay.water ?? 0) * (mod.needsMultiplier.water ?? 1) * dt * (met.water ?? 1);
  for (const [id, share] of Object.entries(split)) {
    res[id] = (res[id] ?? 0) + drunk * covered * share;
    record(state, id, "in", LABELS.restrooms, drunk * covered * share);
  }

  let loss = 0;
  for (const [id, m] of Object.entries(met)) loss += (1 - m) * (c.healthLossPerDay[id] ?? 0);
  loss += (1 - covered) * c.noSanitationHealthLossPerDay;
  if ((res.co2 ?? 0) > c.co2DangerLevel) loss += c.co2HealthLossPerDay;
  pop.health = Math.max(0, Math.min(100, pop.health + (loss > 0 ? -loss : c.healthRecoveryPerDay) * dt));
  pop.needsMet = met;
  pop.sanitation = covered;
}

/** Smoothed net change per game day, for the resource bar. */
export function updateRates(state: SimState, before: Record<string, number>, cfg: SimConfig): void {
  const alpha = 1 / (cfg.economy.rateSmoothingDays * cfg.ticksPerDay);
  for (const id of new Set([...Object.keys(before), ...Object.keys(state.resources)])) {
    const perDay = ((state.resources[id] ?? 0) - (before[id] ?? 0)) * cfg.ticksPerDay;
    state.rates[id] = (state.rates[id] ?? perDay) * (1 - alpha) + perDay * alpha;
  }
}
