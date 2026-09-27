import { config, type SimConfig } from "./config";
import { checkPlacement, type CheckResult, type Layout, type Location } from "./placement";
import { resourceDef } from "./resources";
import type { DepositKind } from "./mapgeo";
import { roomDef } from "./rooms";

/** What's missing to pay for a room, e.g. "Needs 15 more metal", or null if affordable. */
export function missingCost(resources: Record<string, number>, type: string): string | null {
  const short = Object.entries(roomDef(type).cost)
    .map(([id, amt]) => [id, Math.ceil(amt - Math.floor(resources[id] ?? 0))] as const)
    .filter(([, gap]) => gap > 0);
  if (!short.length) return null;
  return "Needs " + short.map(([id, gap]) => `${gap} more ${resourceDef(id).name.toLowerCase()}`).join(", ");
}

const DEPOSIT_NAMES: Record<DepositKind, string> = { ice: "ice", aquifer: "an aquifer", ore: "ore", silica: "silica" };

/** Why this hole can't have a room at all, whatever the spot (e.g. no ore under it), or null. */
export function siteRefusal(type: string, deposits: DepositKind[]): string | null {
  const need = roomDef(type).requiresDeposit;
  return need && !deposits.includes(need) ? `Needs a site on ${DEPOSIT_NAMES[need]}: this hole doesn't sit on any` : null;
}

/** Placement rules, the site, and cost: what the build preview and the build command both use. */
export function checkBuild(
  layout: Layout,
  resources: Record<string, number>,
  type: string,
  at: Location,
  cfg: SimConfig = config,
  deposits: DepositKind[] = [],
): CheckResult {
  const check = checkPlacement(layout, type, at, cfg);
  if (!check.ok) return check;
  const site = siteRefusal(type, deposits);
  if (site) return { ok: false, reason: site, cells: check.cells, surfaceCells: check.surfaceCells };
  const missing = missingCost(resources, type);
  return missing ? { ok: false, reason: missing, cells: check.cells, surfaceCells: check.surfaceCells } : check;
}

export function charge(resources: Record<string, number>, type: string): void {
  for (const [id, amt] of Object.entries(roomDef(type).cost)) resources[id] = (resources[id] ?? 0) - amt;
}

/** The ledger label for building (and, negatively, for refunds). */
export const CONSTRUCTION = "Construction";

export function refund(resources: Record<string, number>, type: string, fraction: number): void {
  for (const [id, amt] of Object.entries(roomDef(type).cost)) resources[id] = (resources[id] ?? 0) + amt * fraction;
}
