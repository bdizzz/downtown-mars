import type { SimConfig } from "./config";
import { slotsInRing } from "./geometry";
import type { RoomInstance } from "./placement";
import { roomDef } from "./rooms";
import type { SimState } from "./state";

// Each floor's temperature (#393). One number per floor, no heat flowing
// between floors and no ducts: a floor heads for a target and moves toward it
// slowly. The target is the floor's resting temperature (the rock's, by the
// site's latitude and the floor's depth), plus body heat and the waste heat of
// rooms like smelters, plus what its heaters add (up to the thermostat), minus
// what its radiators pipe away (down to the thermostat). Heat is measured on a
// reference floor, a small hole's floor dug across its unlocked rings: a
// bigger floor needs more heaters for the same lift. Heaters draw power by how
// hard they're working, the share worked out each tick for the next, so a
// floor at its setpoint costs less to keep warm than one still warming up.
// Everything is °C; the views show °F or °C by the player's setting.

export interface TemperatureState {
  /** Floor 1's resting temperature, °C, rolled when the hole was founded. */
  rest: number;
  /** Each floor's temperature now, °C (index 0 is floor 1). */
  floors: number[];
  /** Each floor's heaters' share of full power, 0..1, as asked for this tick (worked out last tick). */
  heat: number[];
  /** Each floor's radiators' share of full power, 0..1, likewise. */
  cool: number[];
  /** The hole's thermostat, °C. */
  setpoint: number;
  /** Floors set apart from the hole's thermostat, by floor number. */
  overrides?: Record<number, number>;
}

/** One floor's heat budget, °C, for the views and the tests. */
export interface FloorHeat {
  floor: number;
  /** Its temperature now. */
  now: number;
  /** Where it rests with nothing warming it. */
  rest: number;
  /** Body heat and waste heat. */
  body: number;
  waste: number;
  /** What its heaters could add at full power, what those with power could, and what they're adding. */
  heatersFull: number;
  heatersOn: number;
  heating: number;
  /** What its radiators could take away at full power, what those with power could, and what they're taking. */
  radiatorsFull: number;
  radiatorsOn: number;
  cooling: number;
  /** Where it's heading. */
  target: number;
  /** Its thermostat, and whether that's this floor's own. */
  setpoint: number;
  override: boolean;
  heaters: number;
  radiators: number;
  /** Dug cells (what the heat spreads over). */
  cells: number;
}

/** Floor 1's resting band at a latitude, °C: straight-line between the bands, on past the first toward the equator. */
export function restBand(lat: number, cfg: SimConfig): [number, number] {
  const bands = cfg.temperature.restBands;
  const a = Math.abs(lat);
  let i = 0;
  while (i < bands.length - 2 && a > bands[i + 1]!.lat) i++;
  const lo = bands[i]!;
  const hi = bands[Math.min(i + 1, bands.length - 1)]!;
  const t = hi.lat === lo.lat ? 0 : Math.min(1, (a - lo.lat) / (hi.lat - lo.lat));
  const cap = cfg.temperature.restCapC;
  return [Math.min(cap, lo.lowC + (hi.lowC - lo.lowC) * t), Math.min(cap, lo.highC + (hi.highC - lo.highC) * t)];
}

/** A hole's floor 1 resting temperature: a roll within its latitude's band. `roll` is 0..1. */
export function rollRest(lat: number | null, roll: number, cfg: SimConfig): number {
  const [lo, hi] = restBand(lat ?? cfg.temperature.restBands[0]!.lat, cfg);
  return lo + (hi - lo) * roll;
}

/** A 0..1 roll from a seed, without touching the hole's random stream (so nothing else's luck changes). */
export function seedRoll(seed: number): number {
  let t = (seed + 0x9e3779b9) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function createTemperature(lat: number | null, seed: number, cfg: SimConfig): TemperatureState {
  return { rest: rollRest(lat, seedRoll(seed), cfg), floors: [], heat: [], cool: [], setpoint: cfg.temperature.setpointC };
}

/** The hole's temperature, made for an older save from its id the first time it's needed. */
export function temperatureOf(state: SimState, cfg: SimConfig): TemperatureState {
  return (state.temperature ??= createTemperature(state.site?.lat ?? null, state.holeId * 7919 + 17, cfg));
}

/** A floor's resting temperature, °C. */
export function floorRest(t: TemperatureState, floor: number, cfg: SimConfig): number {
  return Math.min(cfg.temperature.restCapC, t.rest + (floor - 1) * cfg.temperature.depthWarmingPerFloorC);
}

/** A floor's thermostat, °C. */
export function setpointOf(t: TemperatureState, floor: number): number {
  return t.overrides?.[floor] ?? t.setpoint;
}

/** Cells on the reference floor: a small hole's floor dug across its unlocked rings. */
export function referenceCells(cfg: SimConfig): number {
  const h = cfg.starterHole;
  let n = 0;
  for (let ring = 1; ring <= h.unlockedRings; ring++) n += slotsInRing(h.shaftRadiusM, ring, cfg.geometry);
  return n;
}

function dugCells(state: SimState, floor: number): number {
  const rings = state.layout.open?.[floor - 1];
  if (!rings) return 0;
  let n = 0;
  for (const ring of rings) for (const v of ring) if (v === 1) n++;
  return n;
}

/** How a room's share of something splits over the floors its cells are on. */
function byFloor(room: RoomInstance): Map<number, number> {
  const out = new Map<number, number>();
  if (room.at.kind !== "ring" || !room.cells.length) return out;
  for (const c of room.cells) out.set(c.floor, (out.get(c.floor) ?? 0) + 1 / room.cells.length);
  return out;
}

/** How much of a size's nominal a room covers (a deep wedge covers more), as economy.ts scales its numbers. */
function scaleOf(room: RoomInstance, cfg: SimConfig): number {
  const nominal = cfg.economy.nominalSlots[roomDef(room.type).size] ?? 1;
  return room.at.kind === "ring" ? room.cells.length / nominal : 1;
}

const ready = (room: RoomInstance) => !room.planned && !room.building && room.connected;

/** Every floor's heat budget this tick (rooms' running rates from the economy's last run). */
export function floorHeats(state: SimState, cfg: SimConfig): FloorHeat[] {
  const tc = cfg.temperature;
  const t = temperatureOf(state, cfg);
  const floors = state.layout.hole.floors;
  const ref = referenceCells(cfg);
  const body = new Array<number>(floors + 1).fill(0);
  const waste = new Array<number>(floors + 1).fill(0);
  const heatersFull = new Array<number>(floors + 1).fill(0);
  const radiatorsFull = new Array<number>(floors + 1).fill(0);
  const heatersOn = new Array<number>(floors + 1).fill(0);
  const radiatorsOn = new Array<number>(floors + 1).fill(0);
  const heaters = new Array<number>(floors + 1).fill(0);
  const radiators = new Array<number>(floors + 1).fill(0);
  const residents = new Map(state.happiness.pools.map((p) => [p.roomId, p.residents]));
  for (const room of state.layout.rooms) {
    if (!ready(room)) continue;
    const def = roomDef(room.type);
    const st = state.roomStatus[room.id];
    const rate = st?.rate ?? 0;
    // People living or working here, and the heat its machines give off while they run.
    const people = (residents.get(room.id) ?? 0) + (st?.staff ?? 0);
    const hot = def.effects.filter((e) => e.type === "heat").reduce((s, e) => s + e.strength, 0) * rate;
    const k = scaleOf(room, cfg);
    for (const [floor, share] of byFloor(room)) {
      if (floor < 1 || floor > floors) continue;
      body[floor]! += people * share * tc.bodyHeatPerPersonC;
      waste[floor]! += hot * share * tc.wasteHeatPerStrengthC;
      if (def.heats && !room.paused) {
        heatersFull[floor]! += def.heats * k * share;
        heatersOn[floor]! += def.heats * k * share * rate;
        heaters[floor]! += share;
      }
      if (def.cools && !room.paused) {
        radiatorsFull[floor]! += def.cools * k * share;
        radiatorsOn[floor]! += def.cools * k * share * rate;
        radiators[floor]! += share;
      }
    }
  }
  const out: FloorHeat[] = [];
  for (let floor = 1; floor <= floors; floor++) {
    const cells = dugCells(state, floor);
    // Heat spreads over the floor's dug space: a bigger floor gets less from the same source.
    const spread = ref / Math.max(cells, tc.minCells);
    const rest = floorRest(t, floor, cfg);
    const b = body[floor]! * spread;
    const w = waste[floor]! * spread;
    const passive = rest + b + w;
    const setpoint = setpointOf(t, floor);
    const hFull = heatersFull[floor]! * spread;
    const rFull = radiatorsFull[floor]! * spread;
    // What the heaters and radiators delivered: their full lift, times the power share asked for, times how much of it they got.
    const heating = heatersOn[floor]! * spread * (t.heat[floor - 1] ?? 1);
    const cooling = radiatorsOn[floor]! * spread * (t.cool[floor - 1] ?? 1);
    out.push({
      floor,
      now: t.floors[floor - 1] ?? rest,
      rest,
      body: b,
      waste: w,
      heatersFull: hFull,
      heatersOn: heatersOn[floor]! * spread,
      heating,
      radiatorsFull: rFull,
      radiatorsOn: radiatorsOn[floor]! * spread,
      cooling,
      target: passive + heating - cooling,
      setpoint,
      override: t.overrides?.[floor] !== undefined,
      heaters: Math.round(heaters[floor]!),
      radiators: Math.round(radiators[floor]!),
      cells,
    });
  }
  return out;
}

/** Move every floor toward its target, and work out what share of power its heaters and radiators ask for next. */
export function stepTemperature(state: SimState, cfg: SimConfig): void {
  const tc = cfg.temperature;
  const t = temperatureOf(state, cfg);
  const dt = 1 / cfg.ticksPerDay;
  for (const f of floorHeats(state, cfg)) {
    const i = f.floor - 1;
    const now = t.floors[i] ?? f.rest;
    const passive = f.rest + f.body + f.waste;
    // Next tick's ask: just enough to bring the floor to its setpoint (all of it while it's far off).
    t.heat[i] = f.heatersFull > 0 ? clamp01((f.setpoint - passive) / f.heatersFull) : 0;
    t.cool[i] = f.radiatorsFull > 0 ? clamp01((passive - f.setpoint) / f.radiatorsFull) : 0;
    // Heaters warm a floor by their lift a day each, radiators cool it the same; otherwise it drifts.
    const gap = f.target - now;
    const speed = Math.max(tc.driftPerDayC, gap > 0 ? (f.heating > 0 ? f.heatersOn : 0) : f.cooling > 0 ? f.radiatorsOn : 0);
    t.floors[i] = now + Math.sign(gap) * Math.min(Math.abs(gap), speed * dt);
  }
  t.floors.length = state.layout.hole.floors;
  t.heat.length = state.layout.hole.floors;
  t.cool.length = state.layout.hole.floors;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** The share of full power a heater or radiator draws this tick: what its floor asked for. 1 for other rooms. */
export function powerShare(state: SimState, room: RoomInstance): number {
  const def = roomDef(room.type);
  if (!def.heats && !def.cools) return 1;
  const t = state.temperature;
  if (!t || room.at.kind !== "ring") return 1;
  const i = room.at.floor - 1;
  return (def.heats ? t.heat[i] : t.cool[i]) ?? 1;
}

/** The comfort a home feels from its floor's temperature (the homeless: the hole's average). */
export function temperatureComfort(state: SimState, room: RoomInstance | null, cfg: SimConfig): number {
  const t = state.temperature;
  if (!t || !t.floors.length) return 0;
  let c: number | undefined;
  if (room && room.at.kind === "ring") c = t.floors[room.at.floor - 1];
  else if (room) return 0; // the landing pod, up top: out of the floors' reckoning
  c ??= averageTemperature(state);
  return comfortAt(c, cfg);
}

export function comfortAt(c: number, cfg: SimConfig): number {
  for (const band of cfg.temperature.comfort) if (c < band.belowC) return band.comfort;
  return 0;
}

/** The hole's dug floors' average temperature, °C (weighted by dug space). */
export function averageTemperature(state: SimState): number {
  const t = state.temperature;
  if (!t || !t.floors.length) return 0;
  let sum = 0;
  let n = 0;
  t.floors.forEach((c, i) => {
    const w = dugCells(state, i + 1);
    sum += c * w;
    n += w;
  });
  return n > 0 ? sum / n : (t.floors[0] ?? 0);
}

/** The coldest dug floor, °C. */
export function coldestTemperature(state: SimState): number {
  const t = state.temperature;
  if (!t || !t.floors.length) return 0;
  let min = Infinity;
  t.floors.forEach((c, i) => {
    if (dugCells(state, i + 1) > 0) min = Math.min(min, c);
  });
  return Number.isFinite(min) ? min : (t.floors[0] ?? 0);
}

/** Set the hole's thermostat, or one floor's (null clears that floor's own), °C, kept within range. */
export function setThermostat(state: SimState, cfg: SimConfig, celsius: number | null, floor?: number): void {
  const t = temperatureOf(state, cfg);
  const [lo, hi] = cfg.temperature.setpointRangeC;
  const c = celsius === null ? null : Math.max(lo, Math.min(hi, celsius));
  if (floor === undefined) {
    if (c !== null) t.setpoint = c;
    return;
  }
  if (c === null) {
    if (t.overrides) delete t.overrides[floor];
    if (t.overrides && !Object.keys(t.overrides).length) delete t.overrides;
  } else (t.overrides ??= {})[floor] = c;
}

/** What the views see of a hole's temperature, °C. */
export interface TemperatureView {
  /** The hole's thermostat, and its range. */
  setpoint: number;
  range: [number, number];
  /** Floor by floor (index 0 is floor 1). */
  floors: FloorHeat[];
  /** The dug floors' average and the coldest. */
  average: number;
  coldest: number;
  /** Floor 1's resting temperature: the site's. */
  rest: number;
}

export function temperatureView(state: SimState, cfg: SimConfig): TemperatureView {
  const t = temperatureOf(state, cfg);
  return {
    setpoint: t.setpoint,
    range: cfg.temperature.setpointRangeC,
    floors: floorHeats(state, cfg),
    average: averageTemperature(state),
    coldest: coldestTemperature(state),
    rest: t.rest,
  };
}
