import raw from "../../data/diagnosis.json";
import type { SimConfig } from "./config";
import { airPct } from "./air";
import { effectSources, type EffectSource } from "./effects";
import { eventMood } from "./events";
import { afterglow } from "./happiness";
import type { Layout } from "./placement";
import { roomDef } from "./rooms";
import type { SimState } from "./state";

// Why the hole's health and happiness are where they are (F-018): what drains
// the health meter, cause by cause, and what each part of the homes' noise,
// comfort and wellbeing adds to or takes from happiness, in points, with the
// homes that feel it and what to do. The numbers come from the sim itself
// (economy.ts keeps the drain, happiness.ts the points); the words are in
// data/diagnosis.json. Read by the HUD, the "Why?" panel, the home panel and
// the Trends bands, and later visits and tips.

export interface CauseDef {
  factor?: string;
  /** Its short name in a breakdown ("view", "no galley seat"). */
  label?: string;
  /** The neighbour effect behind it, whose source rooms are named. */
  field?: string;
  /** Felt by everyone alike (the hole's health, ordinances): no homes or rooms to show. */
  shared?: boolean;
  text: string;
  fix?: string;
}

export const DIAGNOSIS = raw as unknown as {
  homesFrom: number;
  factors: Record<string, string>;
  health: Record<string, CauseDef>;
  happiness: Record<string, CauseDef>;
};
const DATA = DIAGNOSIS;

export interface Cause {
  id: string;
  /** Health a day (negative: a drain), or happiness points (negative: a pull down). */
  amount: number;
  text: string;
  fix?: string;
  /** happiness only: noise, comfort, health (wellbeing), mood or base. */
  factor?: string;
  /** The homes that feel it most, worst first (sanitation: the homes without a restroom in reach). */
  homes?: number[];
  /** happiness only, for a neighbour effect: the rooms making it, the biggest share first. */
  rooms?: number[];
}

export interface Diagnosis {
  health: {
    value: number;
    /** Net change a day: the recovery when nothing drains, otherwise minus the drains. */
    perDay: number;
    recovering: boolean;
    /** What drains it, biggest first (empty when it's recovering). */
    causes: Cause[];
  };
  happiness: {
    average: number;
    /** Where it's heading: the resident-weighted target the causes add up to. */
    target: number;
    /** Every cause, from the biggest pull down to the biggest lift. */
    causes: Cause[];
    /** The unhappiest occupied homes, unhappiest first, with what hurts each most. */
    worst: { roomId: number; happiness: number; causes: Cause[] }[];
  };
  /** Each occupied home's neighbour effects, room by room (effects.ts effectSources), biggest first. */
  sources: Record<number, EffectSource[]>;
}

const pct = (v: number) => String(Math.round(v * 100));

function fill(def: CauseDef | undefined, id: string, vars: Record<string, string>): { text: string; fix?: string } {
  const sub = (t: string) => t.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
  return def ? { text: sub(def.text), ...(def.fix ? { fix: sub(def.fix) } : {}) } : { text: id };
}

/** What drains the hole's health, biggest first. */
function healthCauses(state: SimState, cfg: SimConfig): Cause[] {
  const pop = state.population;
  const drain = pop.healthDrain ?? {};
  const out: Cause[] = [];
  for (const [id, perDay] of Object.entries(drain)) {
    if (perDay <= 0.001) continue;
    const met =
      id === "sanitation" ? (pop.sanitation ?? 1) : id === "o2" || id === "co2" ? null : (pop.needsMet[id] ?? 1);
    const vars = {
      met: met === null ? "" : pct(met),
      pct: id === "o2" || id === "co2" ? airPct(state, cfg, id).toFixed(1) : "",
    };
    const homes = id === "sanitation" ? Object.entries(pop.sanitationByHome ?? {}).filter(([, v]) => v < 0.98).sort((a, b) => a[1] - b[1]).map(([h]) => Number(h)) : [];
    out.push({ id, amount: -perDay, ...fill(DATA.health[id], id, vars), ...(homes.length ? { homes } : {}) });
  }
  return out.sort((a, b) => a.amount - b.amount);
}

/** Sources by home, worked out again only when the layout or the dust changes. */
const sourceCache = new WeakMap<Layout, { key: string; by: Record<number, EffectSource[]> }>();

/** Every home's neighbour effects, room by room, rounded, the biggest first. */
function homeSources(state: SimState): Record<number, EffectSource[]> {
  const layout = state.layout;
  const dust = state.effects?.dust ?? 1;
  const key = `${layout.version}:${dust}`;
  const hit = sourceCache.get(layout);
  if (hit?.key === key) return hit.by;
  const homes = layout.rooms.filter((r) => !r.planned && !r.building && r.at.kind === "ring" && (roomDef(r.type).houses ?? 0) > 0);
  const by: Record<number, EffectSource[]> = {};
  for (const [id, list] of effectSources(layout, homes, dust)) {
    by[id] = list.map((x) => ({ ...x, value: Math.round(x.value * 100) / 100 })).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  }
  sourceCache.set(layout, { key, by });
  return by;
}

/** The rooms behind a neighbour effect in these homes, the biggest share (in the cause's direction) first. */
function sourceRooms(sources: Record<number, EffectSource[]>, field: string, homes: number[], sign: number): number[] {
  const total = new Map<number, number>();
  for (const h of homes) for (const x of sources[h] ?? []) if (x.type === field && x.value * sign > 0) total.set(x.from, (total.get(x.from) ?? 0) + x.value * sign);
  return [...total].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([id]) => id);
}

/** Happiness by factor right now, in points (noise, comfort, health for wellbeing, and mood: the afterglow and events), for the Trends band. */
export function happinessByFactor(state: SimState, cfg: SimConfig): Record<string, number> {
  const out: Record<string, number> = { noise: 0, comfort: 0, health: 0, mood: afterglow(state, cfg) + eventMood(state) };
  for (const [id, v] of Object.entries(state.happiness.points ?? {})) {
    const f = DATA.happiness[id]?.factor;
    if (f && f in out) out[f]! += v;
  }
  return out;
}

export function diagnose(state: SimState, cfg: SimConfig): Diagnosis {
  const pop = state.population;
  const h = state.happiness;
  const causes = healthCauses(state, cfg);
  const loss = -causes.reduce((s, c) => s + c.amount, 0);
  const recovering = loss <= 0.001;
  const perDay = recovering ? (pop.health < 100 ? cfg.colonists.healthRecoveryPerDay : 0) : -loss;

  // Happiness: every part, plus the base, the afterglow and recent events (felt by everyone alike).
  const points: Record<string, number> = { ...(h.points ?? {}) };
  points.base = cfg.happiness.base - 50;
  const glow = afterglow(state, cfg);
  const mood = eventMood(state);
  if (Math.abs(glow) >= 0.05) points.afterglow = glow;
  if (Math.abs(mood) >= 0.05) points.events = mood;

  const occupied = h.pools.filter((p) => p.residents > 0);
  const sources = homeSources(state);
  const feeling = (id: string, sign: number) =>
    occupied
      .filter((p) => (p.points?.[id] ?? 0) * sign >= DATA.homesFrom)
      .sort((a, b) => (a.points?.[id] ?? 0) * sign - (b.points?.[id] ?? 0) * sign)
      .reverse()
      .map((p) => p.roomId);
  const vars = (homes: number[]) => ({ homes: `${homes.length} ${homes.length === 1 ? "home" : "homes"}`, health: String(Math.round(pop.health)) });
  const happyCauses: Cause[] = Object.entries(points)
    .filter(([, v]) => Math.abs(v) >= 0.05)
    .map(([id, amount]) => {
      const def = DATA.happiness[id];
      const homes = def?.factor === "base" || def?.factor === "mood" ? [] : feeling(id, Math.sign(amount));
      const rooms = def?.field ? sourceRooms(sources, def.field, homes, Math.sign(amount)) : [];
      return { id, amount, factor: def?.factor, ...(homes.length ? { homes } : {}), ...(rooms.length ? { rooms } : {}), ...fill(def, id, vars(homes)) };
    })
    .sort((a, b) => a.amount - b.amount);
  const target = Math.max(0, Math.min(100, 50 + Object.values(points).reduce((s, v) => s + v, 0)));

  const worst = [...occupied]
    .sort((a, b) => a.happiness - b.happiness || a.roomId - b.roomId)
    .slice(0, 5)
    .map((p) => ({
      roomId: p.roomId,
      happiness: p.happiness,
      causes: Object.entries(p.points ?? {})
        .filter(([, v]) => v < 0)
        .sort((a, b) => a[1] - b[1])
        .slice(0, 3)
        .map(([id, amount]) => ({ id, amount, factor: DATA.happiness[id]?.factor, ...fill(DATA.happiness[id], id, vars([p.roomId])) })),
    }));

  return {
    health: { value: pop.health, perDay, recovering, causes },
    happiness: { average: h.average, target, causes: happyCauses, worst },
    sources: Object.fromEntries(occupied.map((p) => [p.roomId, sources[p.roomId] ?? []])),
  };
}
