import type { SimConfig } from "./config";
import { airPct, airVolume } from "./air";
import { overallCondition } from "./condition";
import { powerFlow } from "./economy";
import { beds } from "./earth";
import { resourceDefs } from "./resources";
import type { SimState } from "./state";

// How the hole has been doing over time, for the charts: once a game hour,
// every resource's stock and a few vital signs (people, happiness, health,
// condition, workers, power made and used). The last few days are kept hour
// by hour; the whole game, one average a day. Recorded without randomness, so
// it never changes anything else.

/** Series beyond the resources (whose series are their ids). */
export const VITALS = ["population", "beds", "happiness", "health", "condition", "employed", "workers", "powerMade", "powerUsed", "o2Pct", "co2Pct", "airVolume"] as const;
export type Vital = (typeof VITALS)[number];

export interface History {
  /** Ticks between hourly samples. */
  every: number;
  /** Tick of the newest hourly sample. */
  last: number;
  /** One sample an hour, oldest first, for the last few days. Every series is the same length. */
  hourly: Record<string, number[]>;
  /** One value a day (the day's average), oldest first; the newest is the day before `last`'s. */
  daily: Record<string, number[]>;
  /** Tick at the end of the newest daily value. */
  dailyLast: number;
  /** The day so far: sums of its hourly samples, for its average. */
  acc: Record<string, number>;
  accCount: number;
  /** Bumped with every sample, so the main thread knows when to take a fresh copy. */
  version: number;
}

/** Every series recorded, in order: vitals, then resources. */
export function seriesIds(): string[] {
  return [...VITALS, ...resourceDefs.map((r) => r.id)];
}

export function createHistory(cfg: SimConfig): History {
  const empty = () => Object.fromEntries(seriesIds().map((id) => [id, [] as number[]]));
  return { every: cfg.history.everyTicks, last: -1, hourly: empty(), daily: empty(), dailyLast: -1, acc: {}, accCount: 0, version: 0 };
}

/** What each series reads right now. */
export function sample(state: SimState, cfg: SimConfig): Record<string, number> {
  const power = powerFlow(state, cfg);
  const out: Record<string, number> = {
    population: state.population.count,
    beds: beds(state),
    happiness: state.happiness.average,
    health: state.population.health,
    condition: overallCondition(state) * 100,
    employed: state.workforce.employed,
    workers: state.workforce.total,
    powerMade: power.made,
    powerUsed: power.used,
    o2Pct: airPct(state, cfg, "o2"),
    co2Pct: airPct(state, cfg, "co2"),
    airVolume: airVolume(state, cfg),
  };
  for (const r of resourceDefs) out[r.id] = state.resources[r.id] ?? 0;
  return out;
}

const round = (v: number) => Math.round(v * 100) / 100;

function push(series: Record<string, number[]>, id: string, v: number, keep: number): void {
  const list = (series[id] ??= []);
  list.push(round(v));
  if (list.length > keep) list.splice(0, list.length - keep);
}

export function stepHistory(state: SimState, cfg: SimConfig): void {
  const h = cfg.history;
  if (state.tick % h.everyTicks !== 0) return;
  const hist = (state.history ??= createHistory(cfg));
  const now = sample(state, cfg);
  const keepHours = h.recentDays * (cfg.ticksPerDay / h.everyTicks);
  // A series that's new since the history began (a resource added to the game) starts at zero.
  const length = Math.max(0, ...Object.values(hist.hourly).map((l) => l.length));
  for (const [id, v] of Object.entries(now)) {
    if (!hist.hourly[id]) hist.hourly[id] = Array(length).fill(0);
    push(hist.hourly, id, v, keepHours);
    hist.acc[id] = (hist.acc[id] ?? 0) + v;
  }
  hist.accCount++;
  hist.last = state.tick;
  // End of a day: its average joins the daily series.
  if (state.tick % cfg.ticksPerDay === 0 && hist.accCount > 0) {
    const days = Math.max(0, ...Object.values(hist.daily).map((l) => l.length));
    for (const id of Object.keys(now)) {
      if (!hist.daily[id]) hist.daily[id] = Array(days).fill(0);
      push(hist.daily, id, (hist.acc[id] ?? 0) / hist.accCount, h.maxDays);
    }
    hist.acc = {};
    hist.accCount = 0;
    hist.dailyLast = state.tick;
  }
  hist.version++;
}
