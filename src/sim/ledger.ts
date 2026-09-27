import type { SimConfig } from "./config";
import type { SimState } from "./state";

// Where every resource comes from and goes, for the flow diagram. Amounts are
// summed per game day; the diagram averages the last few complete days so
// lumpy things (Earth drops every few days) show as a steady share.

export type Flows = Record<string, { in: Record<string, number>; out: Record<string, number> }>;

export interface Ledger {
  current: Flows;
  /** Complete days, oldest first. */
  days: Flows[];
}

export const LABELS = {
  colonists: "Colonists",
  digging: "Digging",
  earth: "Earth drops",
  lost: "Overflow",
  restrooms: "Restrooms",
} as const;

export function createLedger(): Ledger {
  return { current: {}, days: [] };
}

export function record(state: SimState, resource: string, dir: "in" | "out", label: string, amount: number): void {
  if (amount <= 0) return;
  const r = (state.ledger.current[resource] ??= { in: {}, out: {} });
  r[dir][label] = (r[dir][label] ?? 0) + amount;
}

/** Close the day's books at midnight. */
export function stepLedger(state: SimState, cfg: SimConfig): void {
  if (state.tick % cfg.ticksPerDay !== 0) return;
  state.ledger.days.push(state.ledger.current);
  state.ledger.current = {};
  while (state.ledger.days.length > cfg.economy.ledgerDays) state.ledger.days.shift();
}

/** Average per day over the complete days kept (or today so far, scaled up, early on). */
export function averageFlows(state: SimState, cfg: SimConfig): Flows {
  const { days, current } = state.ledger;
  const sources = days.length ? days : [current];
  const scale = days.length ? 1 / days.length : cfg.ticksPerDay / Math.max(1, state.tick % cfg.ticksPerDay);
  const out: Flows = {};
  for (const day of sources) {
    for (const [res, f] of Object.entries(day)) {
      const o = (out[res] ??= { in: {}, out: {} });
      for (const dir of ["in", "out"] as const) {
        for (const [label, v] of Object.entries(f[dir])) o[dir][label] = (o[dir][label] ?? 0) + v * scale;
      }
    }
  }
  return out;
}
