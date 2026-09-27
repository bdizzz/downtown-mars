import type { SimConfig } from "./config";
import { capacities, isActive, roomSpec } from "./economy";
import { LABELS, record } from "./ledger";
import { postMessage } from "./messages";
import { addAdults, needsWeight } from "./people";
import { addNotable } from "./notables";
import { resourceDef } from "./resources";
import { roomDef } from "./rooms";
import { nextRandom } from "./rng";
import type { SimState } from "./state";

// Earth's supply drops. Each one covers the hole's current shortfall in food,
// water and oxygen, plus a fixed bundle of materials and a few colonists, so
// drops shrink as the hole learns to feed itself.

export interface EarthState {
  nextDropTick: number;
  /** This drop has already been delayed once, so it won't be again. */
  delayed: boolean;
  /** Waiting in orbit for a working landing pad. */
  waiting: boolean;
  /** Drops landed so far (absent in older saves). */
  landed?: number;
}

export function createEarth(cfg: SimConfig): EarthState {
  return { nextDropTick: cfg.earth.firstDropDay * cfg.ticksPerDay, delayed: false, waiting: false };
}

export function padReady(state: SimState): boolean {
  return state.layout.rooms.some(
    (r) => r.type === "landing_pad" && isActive(r) && (state.roomStatus[r.id]?.rate ?? 0) > 0,
  );
}

export function beds(state: SimState): number {
  return state.layout.rooms.filter(isActive).reduce((sum, r) => sum + (roomDef(r.type).houses ?? 0), 0);
}

/** Per-day shortfall of what colonists need that the hole doesn't make yet. */
export function dailyGaps(state: SimState, cfg: SimConfig): Record<string, number> {
  const pop = needsWeight(state);
  const needs = cfg.colonists.needsPerDay;
  let waterUse = pop * (needs.water ?? 0);
  let waterMade = 0;
  let o2Made = 0;
  let foodMade = 0;
  for (const room of state.layout.rooms.filter(isActive)) {
    const spec = roomSpec(room, cfg);
    const rate = state.roomStatus[room.id]?.rate ?? 0;
    waterUse += spec.uses.water ?? 0;
    waterMade += (spec.makes.water ?? 0) * rate;
    o2Made += (spec.makes.o2 ?? 0) * rate;
    foodMade += (spec.makes.rawFood ?? 0) * rate;
  }
  return {
    rations: Math.max(0, pop * (needs.meals ?? 0) - foodMade),
    water: Math.max(0, waterUse - waterMade),
    o2: Math.max(0, pop * (needs.o2 ?? 0) - o2Made),
  };
}

export function stepEarth(state: SimState, cfg: SimConfig): void {
  const e = state.earth;
  const ec = cfg.earth;
  if (state.tick < e.nextDropTick) return;

  if (!padReady(state)) {
    if (!e.waiting) postMessage(state, cfg, "Supply drop is holding in orbit: the landing pad needs staff and power.", "warn");
    e.waiting = true;
    e.nextDropTick = state.tick + Math.round(ec.retryDays * cfg.ticksPerDay);
    return;
  }
  if (!e.delayed && nextRandom(state) < ec.delayChance) {
    e.delayed = true;
    e.nextDropTick = state.tick + Math.round(ec.delayDays * cfg.ticksPerDay);
    postMessage(state, cfg, "Supply drop delayed a day by dust over the landing zone.", "warn");
    return;
  }

  const contents = land(state, cfg);
  const listed = Object.entries(contents)
    .filter(([, v]) => v >= 1)
    .map(([id, v]) => `${id === "colonists" ? "colonists" : resourceDef(id).name.toLowerCase()} ${Math.round(v)}`);
  postMessage(state, cfg, `Supply drop landed: ${listed.join(", ") || "nothing needed"}.`, "good");

  e.nextDropTick = state.tick + ec.intervalDays * cfg.ticksPerDay;
  e.landed = (e.landed ?? 0) + 1;
  e.delayed = false;
  e.waiting = false;
}

function land(state: SimState, cfg: SimConfig): Record<string, number> {
  const ec = cfg.earth;
  const res = state.resources;
  const caps = capacities(state, cfg);
  const contents: Record<string, number> = {};
  const add = (id: string, amount: number) => {
    const fit = Math.max(0, Math.min(amount, (caps[id] ?? Infinity) - (res[id] ?? 0)));
    if (fit <= 0) return;
    res[id] = (res[id] ?? 0) + fit;
    contents[id] = (contents[id] ?? 0) + fit;
    record(state, id, "in", LABELS.earth, fit);
  };

  // Colonists step off first, so the top-ups below include them. Earth won't
  // send anyone into a hole whose people are already in poor health.
  const healthy = state.population.health >= ec.colonistsNeedHealth;
  const arrivals = healthy ? Math.max(0, Math.min(ec.colonistsPerDrop, beds(state) - state.population.count)) : 0;
  if (arrivals > 0) {
    addAdults(state, arrivals, cfg);
    contents.colonists = arrivals;
    addNotable(state);
  }

  const cover = ec.intervalDays + ec.coverBufferDays;
  const gaps = dailyGaps(state, cfg);
  // Top up to cover the gap, counting what's already in store.
  const onHand: Record<string, number> = {
    rations: (res.rations ?? 0) + (res.rawFood ?? 0) + (res.meals ?? 0),
    water: res.water ?? 0,
    o2: res.o2 ?? 0,
  };
  for (const [id, perDay] of Object.entries(gaps)) add(id, perDay * cover - (onHand[id] ?? 0));
  for (const [id, amount] of Object.entries(ec.fixed)) add(id, amount);

  return contents;
}
