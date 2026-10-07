import type { SimConfig } from "./config";
import type { SimState } from "./state";

// Where every resource comes from and goes, for the flow diagram. Amounts are
// summed per game day; the diagram averages the last few complete days so
// lumpy things (Earth drops every few days) show as a steady share.

export type Flows = Record<string, FlowEntry>;

export interface FlowEntry {
  in: Record<string, number>;
  out: Record<string, number>;
  /** Where a use went next, by use then by where (the flow panel's second step): water used by
   * "Electrolyzer" → "Air for new space". Optional; most uses have none. */
  then?: Record<string, Record<string, number>>;
}

export interface Ledger {
  current: Flows;
  /** Complete days, oldest first. */
  days: Flows[];
}

export const LABELS = {
  colonists: "Colonists",
  digging: "Digging",
  earth: "Earth drops",
  excavation: "Excavation",
  /** People's own water: drinking, washing, cooking at home. */
  household: "Drinking and washing",
  lost: "Overflow",
} as const;

export function createLedger(): Ledger {
  return { current: {}, days: [] };
}

/** Record an amount coming in or going out; a use can also say where it went next (`then`). */
export function record(state: SimState, resource: string, dir: "in" | "out", label: string, amount: number, opts?: { then?: string }): void {
  if (amount <= 0) return;
  const r =(state.ledger.current[resource] ??= { in: {}, out: {} });
  r[dir][label] = (r[dir][label] ?? 0) + amount;
  if (dir === "out" && opts?.then) {
    const t = ((r.then ??= {})[label] ??= {});
    t[opts.then] = (t[opts.then] ?? 0) + amount;
  }
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
      for (const [use, next] of Object.entries(f.then ?? {})) {
        const t = ((o.then ??= {})[use] ??= {});
        for (const [label, v] of Object.entries(next)) t[label] = (t[label] ?? 0) + v * scale;
      }
    }
  }
  return out;
}
