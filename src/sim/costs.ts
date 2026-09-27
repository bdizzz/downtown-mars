import { config, type SimConfig } from "./config";
import { checkPlacement, type CheckResult, type Layout, type Location } from "./placement";
import { resourceDef } from "./resources";
import { roomDef } from "./rooms";

/** What's missing to pay for a room, e.g. "Needs 15 more metal", or null if affordable. */
export function missingCost(resources: Record<string, number>, type: string): string | null {
  const short = Object.entries(roomDef(type).cost)
    .map(([id, amt]) => [id, Math.ceil(amt - Math.floor(resources[id] ?? 0))] as const)
    .filter(([, gap]) => gap > 0);
  if (!short.length) return null;
  return "Needs " + short.map(([id, gap]) => `${gap} more ${resourceDef(id).name.toLowerCase()}`).join(", ");
}

/** Placement rules plus cost: what the build preview and the build command both use. */
export function checkBuild(
  layout: Layout,
  resources: Record<string, number>,
  type: string,
  at: Location,
  cfg: SimConfig = config,
): CheckResult {
  const check = checkPlacement(layout, type, at, cfg);
  if (!check.ok) return check;
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
