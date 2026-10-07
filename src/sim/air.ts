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
  /** Health lost a day in each band (the worse band of each gas applies, not both). */
  healthLossPerDay: { o2Low: number; o2VeryLow: number; co2Harmful: number; co2Dangerous: number };
}

/** What the hole's air is, for the HUD and charts. */
export interface AirState {
  /** Living volume, m³. */
  volume: number;
  /** What the volume was worked out from, so it's only redone when that changes. */
  key: string;
}

/** Every dug cell and every built corridor and tube, in m³. */
export function livingVolume(layout: Layout, cfg: SimConfig): number {
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
  const key = `${l.version}|${l.hole.floors}|${openCellCount(l)}|${Object.keys(l.corridors ?? {}).length}|${Object.keys(l.corridorsBuilding ?? {}).length}`;
  if (state.air?.key !== key) state.air = { volume: livingVolume(l, cfg), key };
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

/** The air in a line's worth of numbers, for the snapshot. */
export interface AirView {
  volume: number;
  o2Pct: number;
  co2Pct: number;
}

export function airView(state: SimState, cfg: SimConfig): AirView {
  return { volume: airVolume(state, cfg), o2Pct: airPct(state, cfg, "o2"), co2Pct: airPct(state, cfg, "co2") };
}
