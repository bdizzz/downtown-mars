import type { SimConfig } from "./config";
import type { RoomInstance } from "./placement";
import { LABELS, record } from "./ledger";
import { modifiers, type Modifiers } from "./ordinances";
import { cropDef, resourceDef, resourceDefs } from "./resources";
import { roomDef } from "./rooms";
import type { SimState } from "./state";
import { countStage, needsWeight, type Cohort } from "./people";
import { storageCaps } from "./storage";
import { stormOutput } from "./weather";
import { conditionOutput, isCleanable, maintenanceQueue } from "./condition";
import type { CareState } from "./care";
import { airAmount, airHealthLoss, breathe } from "./air";

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
  serves: number;
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
  /** Fraction of the next birth accumulated so far. */
  birthProgress?: number;
  /** Children born in this hole, ever. */
  born?: number;
  /** The dead laid to rest in this hole's crypts, which stay full for good. */
  interred?: number;
  /** Dead with no resting place, fading daily; weighs on comfort. */
  grief?: number;
  /** 0..100, hole-wide, from how well needs are met. */
  health: number;
  /** 0..1 per need, last tick. */
  needsMet: Record<string, number>;
  /** 0..1 of colonists with a restroom within reach, or a bathroom at home (amenities.ts). */
  sanitation: number;
  /** Each home's share of its residents with a restroom within reach (1 with its own bathroom). */
  sanitationByHome?: Record<number, number>;
  /** The homeless's share with a restroom (whatever places are left over anywhere). */
  sanitationHomeless?: number;
  /** 0..1 of diners with a seat at a galley or canteen within reach (missing in old saves: all). */
  served?: number;
  /** Seats at working galleys and canteens, at the last happiness update. */
  seats?: number;
  /** Each home's share of its residents with a seat within reach (amenities.ts). */
  servedByHome?: Record<number, number>;
  /** The homeless's share with a seat (whatever's left over anywhere). */
  servedHomeless?: number;
  /** Clinic, school and elder-care places, home by home and in total (care.ts). */
  care?: CareState;
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
    delete makes.rawFood;
    makes[crop.makes ?? "rawFood"] = crop.yield;
  }
  // Clean water comes back as wastewater as it's used.
  for (const [id, share] of Object.entries(waterReturns(def.returnsWater, cfg))) makes[id] = (makes[id] ?? 0) + (uses.water ?? 0) * share;
  const nominal = cfg.economy.nominalSlots[def.size] ?? 1;
  const k = room.at.kind === "ring" ? room.cells.length / nominal : 1;
  const scale = (r: Record<string, number>) => Object.fromEntries(Object.entries(r).map(([id, v]) => [id, v * k]));
  return {
    staff: Math.round(def.staff * k),
    uses: scale(uses),
    makes: scale(makes),
    scrubs: scale(def.scrubs ?? {}),
    stores: storesOf(room),
    sanitation: (def.sanitation ?? 0) * k,
    serves: (def.serves ?? 0) * k,
  };
}

/** What becomes of used clean water: a room's own split, or the default (all gray). */
export function waterReturns(split: Record<string, number> | undefined, cfg: SimConfig): Record<string, number> {
  return split ?? cfg.economy.waterReturns;
}

/** What a tank holds: the kind it's set to, of its choices, or the first. */
export function holding(room: RoomInstance): string | null {
  const choices = roomDef(room.type).holds;
  if (!choices?.length) return null;
  return room.holds && choices.includes(room.holds) ? room.holds : choices[0]!;
}

/** A room's storage; a tank's whole volume goes to what it's set to hold. */
function storesOf(room: RoomInstance): Record<string, number> {
  const def = roomDef(room.type);
  const held = holding(room);
  if (!held) return def.stores ?? {};
  return { [held]: Object.values(def.stores ?? {}).reduce((a, v) => a + v, 0) };
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
  return !room.planned && !room.building && room.connected;
}

export function capacities(state: SimState, cfg: SimConfig): Record<string, number> {
  const caps: Record<string, number> = {};
  // The air has no cap: it's a mix over the living volume (air.ts).
  for (const r of resourceDefs) if (!r.air) caps[r.id] = r.baseCapacity;
  for (const room of state.layout.rooms) {
    if (room.planned || room.building) continue;
    for (const [id, v] of Object.entries(roomSpec(room, cfg).stores)) caps[id] = (caps[id] ?? 0) + v;
  }
  // Dry goods live in storage rooms: only as much as they've space allocated for.
  const all = { ...caps, ...storageCaps(state) };
  // Room the console made, for amounts given past what the hole could hold.
  for (const [id, v] of Object.entries(state.consoleSpace ?? {})) all[id] = (all[id] ?? 0) + v;
  return all;
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

  // 2. Run rooms. Pure producers (solar) go first so power is there for the rest,
  // then treatment, draining wastewater so the rooms that make it have room to.
  const mod = modifiers(state);
  // Maintenance and cleaning crews with nothing to repair stand by: they keep the lights on, but use no parts or water.
  const waiting = rooms.some((r) => roomDef(r.type).maintains) ? maintenanceQueue(state) : [];
  const standby = (r: RoomInstance): boolean => {
    const kind = roomDef(r.type).maintains;
    if (!kind || state.maintenance?.lanes[r.id]) return false;
    return !waiting.some((w) => kind === "all" || isCleanable(w.type));
  };
  const producers = rooms.filter((r) => Object.keys(specs.get(r.id)!.uses).length === 0);
  const drains = (r: RoomInstance) => Object.keys(specs.get(r.id)!.uses).some((id) => resourceDef(id).backsUp);
  const treatment = rooms.filter((r) => drains(r));
  const others = rooms.filter((r) => Object.keys(specs.get(r.id)!.uses).length > 0 && !drains(r));
  for (const r of [...producers, ...treatment, ...others]) {
    const why = down.get(r.id);
    if (why) status[r.id] = { staff: 0, staffNeeded: specs.get(r.id)!.staff, rate: 0, limit: why };
    else runRoom(r, standby(r) ? idleSpec(specs.get(r.id)!) : specs.get(r.id)!, status[r.id]!, state, caps, cfg, dt, mod, standby(r));
  }
  state.roomStatus = status;

  // 3. Colonists.
  stepColonists(state, cfg, dt, mod);

  // 4. Storage limits; the excess is lost.
  for (const [id, v] of Object.entries(res)) {
    const cap = caps[id] ?? Infinity;
    if (v > cap) {
      record(state, id, "out", LABELS.lost, v - cap);
      res[id] = cap;
    }
  }
}

/** A room standing by: only its power, and nothing made. */
function idleSpec(spec: RoomSpec): RoomSpec {
  return { ...spec, uses: spec.uses.power ? { power: spec.uses.power } : {}, makes: {} };
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
  idle = false,
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
  // Worn rooms work slower, and stop altogether at 0%.
  const worn = conditionOutput(room);
  if (worn.factor < 1) {
    rate *= worn.factor;
    limit ??= worn.limit;
  }
  // A dust storm dims the solar arrays.
  const storm = stormOutput(state, cfg, room.type);
  if (storm < 1) {
    rate *= storm;
    limit ??= "storm";
  }
  if (mod.noisyRoomOutput < 1 && roomDef(room.type).effects.some((e) => e.type === "noise")) {
    rate *= mod.noisyRoomOutput;
    limit ??= "ordinance";
  }

  // A room that tops up the air makes its O2 only up to the target, and spends
  // its inputs other than power only on the O2 it makes (checked below).
  const topUp = !!roomDef(room.type).topsUpAir;
  const forAir = (id: string) => topUp && id !== "power";
  for (const [id, perDay] of Object.entries(spec.uses)) {
    const need = perDay * rate * dt;
    if (need <= 0 || forAir(id)) continue;
    const f = available(res, id, subs[id]) / need;
    if (f < 1) {
      rate *= Math.max(0, f);
      limit = id;
    }
  }

  // Don't make what can't be stored: slow down only when every main output is
  // full (a full byproduct, like a farm's oxygen, is just lost). Waste and
  // power never hold a room back. A room with air to scrub keeps running for
  // that alone.
  const capOf = (id: string) => (topUp && resourceDef(id).air ? airAmount(state, cfg, cfg.air.o2Target) : (caps[id] ?? Infinity));
  let outputF = -1;
  let fullOf = "";
  const byproducts = roomDef(room.type).byproducts ?? [];
  for (const [id, perDay] of Object.entries(spec.makes)) {
    const def = resourceDef(id);
    if (def.waste || def.flow || byproducts.includes(id)) continue;
    const make = perDay * rate * dt;
    if (make <= 0) continue;
    const f = Math.max(0, capOf(id) - (res[id] ?? 0)) / make;
    if (f > outputF) outputF = f;
    if (f < 1) fullOf ||= id;
  }
  for (const [id, perDay] of Object.entries(spec.scrubs)) {
    const want = perDay * rate * dt;
    if (want > 0) outputF = Math.max(outputF, (Math.max(0, (res[id] ?? 0) - scrubFloor(state, id, cfg))) / want);
  }
  if (outputF >= 0 && outputF < 1) {
    rate *= outputF;
    limit = topUp && fullOf && resourceDef(fullOf).air ? `air:${fullOf}` : `full:${fullOf}`;
  }

  // A top-up room's share of its O2 actually made: only what the air is short of
  // the target, and only as far as its inputs (water) go. Scrubbing runs regardless.
  let airShare = 1;
  if (topUp) {
    for (const [id, perDay] of Object.entries(spec.makes)) {
      const make = perDay * rate * dt;
      if (resourceDef(id).air && make > 0) airShare = Math.min(airShare, Math.max(0, capOf(id) - (res[id] ?? 0)) / make);
    }
    for (const [id, perDay] of Object.entries(spec.uses)) {
      const need = perDay * rate * dt * airShare;
      if (need <= 0 || !forAir(id)) continue;
      const f = available(res, id, subs[id]) / need;
      if (f < 1) {
        airShare *= Math.max(0, f);
        limit = id;
      }
    }
  }
  // Used water has to go somewhere: with the gray tanks full, the room stalls.
  for (const [id, perDay] of Object.entries(spec.makes)) {
    if (!resourceDef(id).backsUp) continue;
    const make = perDay * rate * dt;
    if (make <= 0) continue;
    const f = Math.max(0, (caps[id] ?? Infinity) - (res[id] ?? 0)) / make;
    if (f < 1) {
      rate *= f;
      limit = `drain:${id}`;
    }
  }

  const label = roomDef(room.type).name;
  for (const [id, perDay] of Object.entries(spec.uses)) consume(state, id, perDay * rate * dt * (forAir(id) ? airShare : 1), subs[id] ?? [], label);
  for (const [id, perDay] of Object.entries(spec.makes)) {
    const made = perDay * rate * dt * (topUp && resourceDef(id).air ? airShare : 1);
    res[id] = (res[id] ?? 0) + made;
    record(state, id, "in", label, made);
  }
  for (const [id, perDay] of Object.entries(spec.scrubs)) {
    const take = Math.min(perDay * rate * dt, Math.max(0, (res[id] ?? 0) - scrubFloor(state, id, cfg)));
    res[id] = (res[id] ?? 0) - take;
    record(state, id, "out", label, take);
  }

  st.rate = rate;
  if (limit) st.limit = limit;
  else if (idle) st.limit = "standby";
}

/** Below this, a slowdown is worth naming in the room's status. */
const NOTICEABLE = 0.99;

/** Life support leaves a little CO2 in the air for farms. */
function scrubFloor(state: SimState, id: string, cfg: SimConfig): number {
  return id === "co2" ? airAmount(state, cfg, cfg.air.co2Floor) : 0;
}

function stepColonists(state: SimState, cfg: SimConfig, dt: number, mod: Modifiers): void {
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
    record(state, id, "out", id === "water" ? LABELS.household : LABELS.colonists, got);
    met[id] = want > 0 ? got / want : 1;
  }
  // The water people drink and wash with comes straight back as gray water.
  const used = weight * (c.needsPerDay.water ?? 0) * (mod.needsMultiplier.water ?? 1) * dt * (met.water ?? 1);
  for (const [id, share] of Object.entries(waterReturns(undefined, cfg))) {
    res[id] = (res[id] ?? 0) + used * share;
    record(state, id, "in", LABELS.household, used * share);
  }
  for (const [id, perDay] of Object.entries(c.makesPerDay)) {
    res[id] = (res[id] ?? 0) + weight * perDay * dt;
    record(state, id, "in", LABELS.colonists, weight * perDay * dt);
  }
  breathe(state, cfg, dt);

  // Restrooms are a comfort (amenities.ts); only very poor coverage wears on health.
  const poor = Math.max(0, 1 - (pop.sanitation ?? 1) / c.poorSanitationBelow);

  let loss = 0;
  for (const [id, m] of Object.entries(met)) loss += (1 - m) * (c.healthLossPerDay[id] ?? 0);
  loss += poor * c.noSanitationHealthLossPerDay;
  loss += airHealthLoss(state, cfg);
  pop.health = Math.max(0, Math.min(100, pop.health + (loss > 0 ? -loss : c.healthRecoveryPerDay) * dt));
  pop.needsMet = met;
}

/** Smoothed net change per game day, for the resource bar. */
export function updateRates(state: SimState, before: Record<string, number>, cfg: SimConfig): void {
  const alpha = 1 / (cfg.economy.rateSmoothingDays * cfg.ticksPerDay);
  for (const id of new Set([...Object.keys(before), ...Object.keys(state.resources)])) {
    const perDay = ((state.resources[id] ?? 0) - (before[id] ?? 0)) * cfg.ticksPerDay;
    state.rates[id] = (state.rates[id] ?? perDay) * (1 - alpha) + perDay * alpha;
  }
}

/** Power made and used a day, by the rooms running this tick. */
export function powerFlow(state: SimState, cfg: SimConfig): { made: number; used: number } {
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
