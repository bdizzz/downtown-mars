import { config, type SimConfig } from "./config";
import { areaScale, checkPlacement, unitsOf, type CheckResult, type Layout, type Spot } from "./placement";
import { resourceDef } from "./resources";
import type { DepositKind } from "./mapgeo";
import { roomDef } from "./rooms";
import { buildLiningCost, type WallStep } from "./materials";

/** A cost times a fill room's share of its target area (1 for any other room), to a tenth. */
export function scaled(cost: Record<string, number>, scale: number): Record<string, number> {
  return scale === 1 ? { ...cost } : Object.fromEntries(Object.entries(cost).map(([id, v]) => [id, Math.round(v * scale * 10) / 10]));
}

/** A room's cost plus anything on top (a lining to build it in). */
export function withExtra(type: string, extra: Record<string, number> = {}, scale = 1): Record<string, number> {
  const cost = scaled(roomDef(type).cost, scale);
  for (const [id, v] of Object.entries(extra)) cost[id] = (cost[id] ?? 0) + v;
  return cost;
}

/** What's missing to pay for a room (and anything on top, `extra`), e.g. "Needs 15 more metal", or null if affordable. */
export function missingCost(resources: Record<string, number>, type: string, extra: Record<string, number> = {}, scale = 1): string | null {
  const short = Object.entries(withExtra(type, extra, scale))
    .map(([id, amt]) => [id, Math.ceil(amt - Math.floor(resources[id] ?? 0))] as const)
    .filter(([, gap]) => gap > 0);
  if (!short.length) return null;
  return "Needs " + short.map(([id, gap]) => `${gap} more ${resourceDef(id).name.toLowerCase()}`).join(", ");
}

const DEPOSIT_NAMES: Record<DepositKind, string> = { ice: "ice", aquifer: "an aquifer", ore: "ore", silica: "silica" };

/** Why a room is still locked. Read each time: the thresholds scale with difficulty (difficulty.ts). */
function unlockText(gate: string): string {
  const u = config.unlocks;
  const at = (n: number) => `Unlocks at ${n} colonists in this hole`;
  if (gate === "children") return "Unlocks with the first child born here";
  if (gate === "elders") return "Unlocks when the first colonists retire";
  if (gate === "geothermal") return "Only where the drill strikes a geothermal pocket";
  if (gate === "cargo") return at(u.cargoPopulation);
  if (gate === "basicHomes") return at(u.homes.basic);
  if (gate === "standardHomes") return at(u.homes.standard);
  if (gate === "luxuryHomes") return at(u.homes.luxury);
  if (gate === "cleaning") return at(u.cleaningPopulation);
  const n = (u.rooms as Record<string, number>)[gate];
  return n !== undefined ? at(n) : "Locked";
}

/**
 * Why this hole can't have a room at all, whatever the spot, or null.
 * `gates` lists what the hole has: the deposits under it (e.g. no ore, no
 * smelter) and what it has unlocked (e.g. "children" for a school).
 */
export function siteRefusal(type: string, gates: string[]): string | null {
  const def = roomDef(type);
  const need = def.requiresDeposit;
  if (need && !gates.includes(need)) return `Needs a site on ${DEPOSIT_NAMES[need]}: this hole doesn't sit on any`;
  if (def.unlockedBy && !gates.includes(def.unlockedBy)) return unlockText(def.unlockedBy);
  return null;
}

/** Placement rules, the site, and cost (with the lining to build it in, if any): what the build preview and the build command both use. */
export function checkBuild(
  layout: Layout,
  resources: Record<string, number>,
  type: string,
  at: Spot,
  cfg: SimConfig = config,
  gates: string[] = [],
  lining?: WallStep | null,
): CheckResult {
  const check = checkPlacement(layout, type, at, cfg);
  if (!check.ok) return check;
  const site = siteRefusal(type, gates);
  if (site) return { ok: false, reason: site, cells: check.cells, surfaceCells: check.surfaceCells };
  const missing = missingCost(resources, type, buildLiningCost(type, check.at, unitsOf(layout.hole, check.cells), lining), areaScale(layout.hole, type, check.at, cfg));
  return missing ? { ok: false, reason: missing, cells: check.cells, surfaceCells: check.surfaceCells } : check;
}

export function charge(resources: Record<string, number>, type: string, scale = 1): void {
  for (const [id, amt] of Object.entries(scaled(roomDef(type).cost, scale))) resources[id] = (resources[id] ?? 0) - amt;
}

/** The ledger label for building (and, negatively, for refunds). */
export const CONSTRUCTION = "Construction";

export function refund(resources: Record<string, number>, type: string, fraction: number, scale = 1): void {
  for (const [id, amt] of Object.entries(scaled(roomDef(type).cost, scale))) resources[id] = (resources[id] ?? 0) + amt * fraction;
}
