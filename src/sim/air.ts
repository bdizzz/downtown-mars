import type { SimConfig } from "./config";
import { corridors } from "./corridors";
import { edgeById, edgeLengthM } from "./edges";
import { LABELS, record } from "./ledger";
import type { Layout } from "./placement";
import { needsWeight } from "./people";
import type { SimState } from "./state";

// The hole's air as a mix (PLAN-M16): O2 and CO2 are amounts in the air, read
// as a % of what the hole's living volume holds. The living volume is every
// dug cell and every built corridor and gallery tube; the open shaft and the
// rock don't count. Digging dilutes the air: the same O2 over more space.
// People turn O2 into CO2, 1:1; life support and plants turn it back.

export interface AirConfig {
  /** Air units a cubic metre holds: O2 % = o2 / (volume × unitsPerM3). */
  unitsPerM3: number;
  /** O2 each person breathes a day (by needs weight, so children breathe less), made into as much CO2. */
  breathPerDay: number;
  /** % of the air. Life support's O2 stops at the target; a new game starts there. */
  o2Target: number;
  /** Below this, health falls; below veryLow, fast. */
  o2Low: number;
  o2VeryLow: number;
  /** Above this, a fire risk. */
  o2High: number;
  /** CO2 above harmful costs health; above dangerous, fast. */
  co2Harmful: number;
  co2Dangerous: number;
  /** Scrubbers leave this much CO2 for the farms; a new game starts here. */
  co2Floor: number;
  /** CO2 above this goes into CO2 tanks, if there are any with room. */
  co2StoreAbove: number;
  /** Health lost a day in each band (the worse band of each gas applies, not both). */
  healthLossPerDay: { o2Low: number; o2VeryLow: number; co2Harmful: number; co2Dangerous: number };
}

/** What the hole's air is, for the HUD and charts. */
export interface AirState {
  /** Living volume, m³. */
  volume: number;
  /** What the volume was worked out from, so it's only redone when that changes. */
  key: string;
  /** The dug part of the volume (cells, corridors and tubes: not a domed shaft), m³, at the last count. */
  dug?: number;
  /** O2 still owed for space dug since: what digging diluted, for the flows' "Air for new space". */
  owed?: number;
  /** The tank fill slider, 0..1 of the O2 tanks: electrolyzers fill them this far once the air is at its target. */
  tankFill?: number;
  /** A sealed dome pressurizing: O2 its shaft needs in all, and what's been made for it so far. */
  shaft?: { need: number; made: number };
}

/** Every dug cell and every built corridor and tube, and a domed shaft once it's open, in m³. */
export function livingVolume(layout: Layout, cfg: SimConfig): number {
  return dugVolume(layout, cfg) + (layout.domed ? shaftVolume(layout, cfg) : 0);
}

/** The shaft's own volume: what a dome over it seals in. */
export function shaftVolume(layout: Layout, cfg: SimConfig): number {
  return Math.PI * layout.hole.shaftRadiusM ** 2 * layout.hole.floors * cfg.geometry.floorHeightM;
}

/** Every dug cell and every built corridor and tube, in m³. */
function dugVolume(layout: Layout, cfg: SimConfig): number {
  const g = cfg.geometry;
  const floors = Math.min(layout.hole.floors, layout.open?.length ?? 0);
  let volume = openCellCount(layout) * g.slotWidthM * g.roomDepthM * g.floorHeightM;
  for (const id of Object.keys(layout.corridors ?? {})) {
    if (layout.corridorsBuilding?.[id] !== undefined) continue;
    const e = edgeById(layout.hole, id);
    if (!e || e.floor > floors) continue;
    volume += edgeLengthM(layout.hole, e, g.roomDepthM) * corridors.widthM * g.floorHeightM;
  }
  return volume;
}

function openCellCount(layout: Layout): number {
  const floors = Math.min(layout.hole.floors, layout.open?.length ?? 0);
  let n = 0;
  for (let f = 0; f < floors; f++) for (const ring of layout.open![f]!) for (const v of ring) if (v === 1) n++;
  return n;
}

/** The hole's living volume, redone only when cells open or corridors come and go. */
export function airVolume(state: SimState, cfg: SimConfig): number {
  const l = state.layout;
  const key = `${l.version}|${l.hole.floors}|${openCellCount(l)}|${Object.keys(l.corridors ?? {}).length}|${Object.keys(l.corridorsBuilding ?? {}).length}|${l.domed ? 1 : 0}`;
  if (state.air?.key !== key) {
    const dug = dugVolume(l, cfg);
    const was = state.air;
    // New space owes its share of O2 at the target: the electrolyzer's "Air for new space".
    const grew = was?.dug !== undefined ? Math.max(0, dug - was.dug) : 0;
    const owed = (was?.owed ?? 0) + grew * cfg.air.unitsPerM3 * (cfg.air.o2Target / 100);
    state.air = { ...was, volume: dug + (l.domed ? shaftVolume(l, cfg) : 0), key, dug, owed };
  }
  return state.air.volume;
}

/** Air units the whole volume holds: 1% of the air is a hundredth of this. */
export function airUnits(state: SimState, cfg: SimConfig): number {
  return airVolume(state, cfg) * cfg.air.unitsPerM3;
}

/** O2 or CO2 as a % of the air. */
export function airPct(state: SimState, cfg: SimConfig, id: "o2" | "co2"): number {
  const units = airUnits(state, cfg);
  return units > 0 ? ((state.resources[id] ?? 0) / units) * 100 : 0;
}

/** The amount of a gas that makes `pct` % of the air. */
export function airAmount(state: SimState, cfg: SimConfig, pct: number): number {
  return (airUnits(state, cfg) * pct) / 100;
}

/** Make the air what a freshly sealed hole's is: O2 at the target, CO2 at the scrub floor. */
export function fillAir(state: SimState, cfg: SimConfig): void {
  state.resources.o2 = airAmount(state, cfg, cfg.air.o2Target);
  state.resources.co2 = airAmount(state, cfg, cfg.air.co2Floor);
  state.air!.owed = 0;
}

/** People breathe: O2 into CO2, 1:1, whatever the level (O2 just can't go below 0). */
export function breathe(state: SimState, cfg: SimConfig, dt: number): void {
  const res = state.resources;
  const want = needsWeight(state) * cfg.air.breathPerDay * dt;
  const took = Math.min(want, res.o2 ?? 0);
  if (took <= 0) return;
  res.o2 = (res.o2 ?? 0) - took;
  res.co2 = (res.co2 ?? 0) + took;
  record(state, "o2", "out", LABELS.colonists, took);
  record(state, "co2", "in", LABELS.colonists, took);
}

/** Health lost a day to the air: the worse O2 band plus the worse CO2 band. */
export function airHealthLoss(state: SimState, cfg: SimConfig): number {
  const a = cfg.air;
  const o2 = airPct(state, cfg, "o2");
  const co2 = airPct(state, cfg, "co2");
  let loss = 0;
  if (o2 < a.o2VeryLow) loss += a.healthLossPerDay.o2VeryLow;
  else if (o2 < a.o2Low) loss += a.healthLossPerDay.o2Low;
  if (co2 > a.co2Dangerous) loss += a.healthLossPerDay.co2Dangerous;
  else if (co2 > a.co2Harmful) loss += a.healthLossPerDay.co2Harmful;
  return loss;
}

// ---------------------------------------------------------------------
// Making it: the electrolyzer and the scrubbers run in economy.ts; gas
// tanks are ballast both ways; a new dome's shaft is pressurized before
// it opens.
// ---------------------------------------------------------------------

/** O2 the tank fill slider still wants put into the O2 tanks. */
function tankWant(state: SimState, caps: Record<string, number>): number {
  const fill = state.air?.tankFill ?? 0;
  return Math.max(0, fill * (caps.o2Tank ?? 0) - (state.resources.o2Tank ?? 0));
}

/** O2 a sealed dome's shaft still needs before it opens. */
export function shaftOwed(state: SimState): number {
  const sh = state.air?.shaft;
  return sh ? Math.max(0, sh.need - sh.made) : 0;
}

/**
 * The most O2 the air should hold this tick, for rooms that top it up: the target, plus what
 * the tank fill and a pressurizing dome still want (both taken out of the air after rooms run).
 */
export function o2Wanted(state: SimState, cfg: SimConfig, caps: Record<string, number>): number {
  return airAmount(state, cfg, cfg.air.o2Target) + tankWant(state, caps) + shaftOwed(state);
}

/** Does the air need a room that `runsWhile` this? */
export function airNeeds(state: SimState, cfg: SimConfig, caps: Record<string, number>, need: "o2Short" | "co2Over"): boolean {
  const res = state.resources;
  if (need === "o2Short") return (res.o2 ?? 0) < o2Wanted(state, cfg, caps) - 1e-6;
  return (res.co2 ?? 0) > airAmount(state, cfg, cfg.air.co2Floor) + 1e-6;
}

/** Where the electrolyzer's water went next: the flow panel's second step. */
export const AIR_THEN = {
  newSpace: "Air for new space",
  breathed: "Replacing breathed air",
  reserve: "Into the O2 reserve",
} as const;

/**
 * Where O2 an electrolyzer just made goes, as shares of it: first the air up to its target (new
 * space owed first, then replacing breathed air), then a pressurizing dome (new space too), then
 * the tanks (the reserve). `before` is the air's O2 before it was made. Pays down what's owed.
 */
export function splitMade(state: SimState, cfg: SimConfig, made: number, before: number): [string, number][] {
  if (made <= 0) return [];
  const short = Math.max(0, airAmount(state, cfg, cfg.air.o2Target) - before);
  const toTarget = Math.min(made, short);
  const air = state.air;
  // What's owed is never more than the air is short: anything past that came back some other way (a drop).
  const owedBefore = Math.min(air?.owed ?? 0, short);
  const newSpace = Math.min(owedBefore, toTarget);
  if (air) air.owed = owedBefore - newSpace;
  const dome = Math.min(made - toTarget, shaftOwed(state));
  const parts: [string, number][] = [
    [AIR_THEN.newSpace, newSpace + dome],
    [AIR_THEN.breathed, toTarget - newSpace],
    [AIR_THEN.reserve, made - toTarget - dome],
  ];
  return parts.filter(([, v]) => v > 1e-9).map(([k, v]) => [k, v / made]);
}

const TANKS = [
  { gas: "o2", tank: "o2Tank", release: (a: AirConfig) => a.o2Target, store: (a: AirConfig) => a.o2Target },
  { gas: "co2", tank: "co2Tank", release: (a: AirConfig) => a.co2Floor, store: (a: AirConfig) => a.co2StoreAbove },
] as const;

/** Before rooms run: tanks release what the air is short of (O2 to the target, CO2 up to the scrub floor for farms). */
export function releaseTanks(state: SimState, cfg: SimConfig): void {
  const res = state.resources;
  for (const t of TANKS) {
    const give = Math.min(res[t.tank] ?? 0, Math.max(0, airAmount(state, cfg, t.release(cfg.air)) - (res[t.gas] ?? 0)));
    if (give <= 0) continue;
    res[t.tank] = (res[t.tank] ?? 0) - give;
    res[t.gas] = (res[t.gas] ?? 0) + give;
    record(state, t.tank, "out", LABELS.toAir, give);
    record(state, t.gas, "in", LABELS.fromTanks, give);
  }
}

/**
 * After rooms run: a pressurizing dome takes its share first, then O2 above the target and CO2
 * above `co2StoreAbove` go into tanks with room. When they're full the rest stays in the air:
 * that's how O2 climbs too high.
 */
export function storeInTanks(state: SimState, cfg: SimConfig, caps: Record<string, number>): void {
  const res = state.resources;
  pressurize(state, cfg);
  for (const t of TANKS) {
    const room = Math.max(0, (caps[t.tank] ?? 0) - (res[t.tank] ?? 0));
    const put = Math.min(room, Math.max(0, (res[t.gas] ?? 0) - airAmount(state, cfg, t.store(cfg.air))));
    if (put <= 0) continue;
    res[t.gas] = (res[t.gas] ?? 0) - put;
    res[t.tank] = (res[t.tank] ?? 0) + put;
    record(state, t.gas, "out", LABELS.toTanks, put);
    record(state, t.tank, "in", LABELS.fromAir, put);
  }
}

/** A sealed dome fills its shaft: from the O2 tanks first, then from O2 above the target. */
function pressurize(state: SimState, cfg: SimConfig): void {
  const sh = state.air?.shaft;
  if (!sh) return;
  const res = state.resources;
  const fromTanks = Math.min(res.o2Tank ?? 0, shaftOwed(state));
  if (fromTanks > 0) {
    res.o2Tank = (res.o2Tank ?? 0) - fromTanks;
    sh.made += fromTanks;
    record(state, "o2Tank", "out", LABELS.shaft, fromTanks);
  }
  const fromAir = Math.min(shaftOwed(state), Math.max(0, (res.o2 ?? 0) - airAmount(state, cfg, cfg.air.o2Target)));
  if (fromAir > 0) {
    res.o2 = (res.o2 ?? 0) - fromAir;
    sh.made += fromAir;
    record(state, "o2", "out", LABELS.shaft, fromAir);
  }
}

/** O2 arriving (a drop, a seed kit) goes into the O2 tanks first, as far as they have room. Returns what they took. */
export function intoTanks(state: SimState, caps: Record<string, number>, amount: number, label: string): number {
  const res = state.resources;
  const put = Math.max(0, Math.min(amount, (caps.o2Tank ?? 0) - (res.o2Tank ?? 0)));
  if (put <= 0) return 0;
  res.o2Tank = (res.o2Tank ?? 0) + put;
  record(state, "o2Tank", "in", label, put);
  return put;
}

/** A finished dome starts pressurizing: its shaft needs its share of O2 at the target before it opens. */
export function startPressurizing(state: SimState, cfg: SimConfig): void {
  airVolume(state, cfg);
  const need = shaftVolume(state.layout, cfg) * cfg.air.unitsPerM3 * (cfg.air.o2Target / 100);
  state.air!.shaft = { need, made: 0 };
}

/** Is the shaft's air made? Then it's released into the hole's air (the caller opens the dome). */
export function shaftFull(state: SimState): boolean {
  const sh = state.air?.shaft;
  if (!sh || shaftOwed(state) > 0.01) return false;
  state.resources.o2 = (state.resources.o2 ?? 0) + sh.made;
  record(state, "o2", "in", LABELS.shaft, sh.made);
  delete state.air!.shaft;
  return true;
}

/** The air in a line's worth of numbers, for the snapshot. */
export interface AirView {
  volume: number;
  o2Pct: number;
  co2Pct: number;
  /** The tank fill slider, 0..1. */
  tankFill: number;
  /** A sealed dome's shaft, 0..1 of its air made, while it's pressurizing. */
  pressurizing: number | null;
}

export function airView(state: SimState, cfg: SimConfig): AirView {
  const sh = state.air?.shaft;
  return {
    volume: airVolume(state, cfg),
    o2Pct: airPct(state, cfg, "o2"),
    co2Pct: airPct(state, cfg, "co2"),
    tankFill: state.air?.tankFill ?? 0,
    pressurizing: sh ? Math.min(1, sh.made / Math.max(1, sh.need)) : null,
  };
}
