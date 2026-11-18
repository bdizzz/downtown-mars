import raw from "../../data/milestones.json";
import type { SimConfig } from "./config";
import { dailyGaps, padReady } from "./earth";
import { isActive } from "./economy";
import { averageFlows, LABELS } from "./ledger";
import { needsWeight } from "./people";
import type { SimState } from "./state";

// Self-sufficiency (F-005 / #183): can the hole keep its people alive indefinitely at its current
// size? Judged from what it makes against what its people need right now: the same shortfall
// Earth's drops top up (earth.ts dailyGaps), in rations, water and oxygen. Three tiers, each held
// for a while before its milestone counts:
// - earth: the drops cover the shortfall (a working landing pad), or trade does;
// - trade: rover deliveries cover it, net of what the hole sends away, with no drops;
// - alone: no shortfall at all.
// Power has no stock to fall short of: a hole is short of it when a room is held back for want of it.

export type Tier = "earth" | "trade" | "alone";
export const TIERS: Tier[] = ["earth", "trade", "alone"];

/** When each tier began to hold, while it still does (absent in older saves until the first check). */
export type SufficiencyState = Partial<Record<Tier, number>>;

const data = (raw as unknown as {
  sufficiency: {
    /** dailyGaps' needs, each with the resources that meet it (rovers may bring any of them). */
    needs: Record<string, string[]>;
    /** A shortfall this small, as a share of the need, still counts as covered. */
    tolerance: number;
  };
}).sufficiency;

/** Does nothing keep a room from running for want of power? */
function powered(state: SimState): boolean {
  return !state.layout.rooms.some((r) => isActive(r) && state.roomStatus[r.id]?.limit === "power");
}

/** Each need's shortfall a day, and the need itself, at the current population. */
function shortfalls(state: SimState, cfg: SimConfig): { id: string; gap: number; need: number; net: number }[] {
  const gaps = dailyGaps(state, cfg);
  const weight = needsWeight(state);
  const flows = averageFlows(state, cfg);
  const needOf: Record<string, number> = {
    rations: weight * (cfg.colonists.needsPerDay.meals ?? 0),
    water: weight * (cfg.colonists.needsPerDay.water ?? 0),
    o2: weight * cfg.air.breathPerDay,
  };
  return Object.entries(data.needs).map(([id, resources]) => {
    // What rovers brought in a day, less what they took away, over the ledger's days.
    let net = 0;
    for (const res of resources) {
      const f = flows[res];
      if (!f) continue;
      for (const [label, v] of Object.entries(f.in)) if (label.startsWith(LABELS.roverFrom)) net += v;
      for (const [label, v] of Object.entries(f.out)) if (label.startsWith(LABELS.roverTo)) net -= v;
    }
    return { id, gap: gaps[id] ?? 0, need: needOf[id] ?? 0, net };
  });
}

/** Which tiers hold right now. A higher tier holds the lower ones too: a hole fine on its own is fine with help. */
export function tiersHolding(state: SimState, cfg: SimConfig): Set<Tier> {
  const out = new Set<Tier>();
  if (state.failed || state.population.count <= 0 || !powered(state)) return out;
  const short = shortfalls(state, cfg);
  const covered = (extra: (s: (typeof short)[number]) => number) => short.every((s) => s.gap - extra(s) <= data.tolerance * s.need);
  if (covered(() => 0)) out.add("alone");
  if (out.has("alone") || covered((s) => s.net)) out.add("trade");
  if (out.has("trade") || padReady(state)) out.add("earth");
  return out;
}

/** Note when each tier began to hold, and forget the ones that stopped. */
export function stepSufficiency(state: SimState, cfg: SimConfig): void {
  const since = (state.sufficiency ??= {});
  const holding = tiersHolding(state, cfg);
  for (const t of TIERS) {
    if (!holding.has(t)) delete since[t];
    else since[t] ??= state.tick;
  }
}

/** How long a tier has held, in game months (ledger days); 0 when it doesn't. */
export function heldMonths(state: SimState, cfg: SimConfig, tier: Tier): number {
  const from = state.sufficiency?.[tier];
  return from === undefined ? 0 : (state.tick - from) / cfg.ticksPerDay;
}
