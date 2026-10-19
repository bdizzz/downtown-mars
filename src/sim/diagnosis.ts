import raw from "../../data/diagnosis.json";
import type { SimConfig } from "./config";
import { airPct } from "./air";
import { eventMood } from "./events";
import { afterglow } from "./happiness";
import type { SimState } from "./state";

// Why the hole's health and happiness are where they are (F-018): what drains
// the health meter, cause by cause, and what each part of the homes' noise,
// comfort and wellbeing adds to or takes from happiness, in points, with the
// homes that feel it and what to do. The numbers come from the sim itself
// (economy.ts keeps the drain, happiness.ts the points); the words are in
// data/diagnosis.json. Read by the HUD, and later the "Why?" panel, the home
// panel, visits and tips.

interface CauseDef {
  factor?: string;
  text: string;
  fix?: string;
}

const DATA = raw as unknown as { homesFrom: number; health: Record<string, CauseDef>; happiness: Record<string, CauseDef> };

export interface Cause {
  id: string;
  /** Health a day (negative: a drain), or happiness points (negative: a pull down). */
  amount: number;
  text: string;
  fix?: string;
  /** happiness only: noise, comfort, health (wellbeing), mood or base. */
  factor?: string;
  /** happiness only: the homes that feel it most, worst first. */
  homes?: number[];
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
    out.push({ id, amount: -perDay, ...fill(DATA.health[id], id, vars) });
  }
  return out.sort((a, b) => a.amount - b.amount);
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
  const feeling = (id: string, sign: number) =>
    occupied
      .filter((p) => (p.points?.[id] ?? 0) * sign >= DATA.homesFrom)
      .sort((a, b) => (a.points?.[id] ?? 0) * sign - (b.points?.[id] ?? 0) * sign)
      .reverse()
      .map((p) => p.roomId);
  const vars = (homes: number[]) => ({ homes: String(homes.length), health: String(Math.round(pop.health)) });
  const happyCauses: Cause[] = Object.entries(points)
    .filter(([, v]) => Math.abs(v) >= 0.05)
    .map(([id, amount]) => {
      const def = DATA.happiness[id];
      const homes = def?.factor === "base" || def?.factor === "mood" ? [] : feeling(id, Math.sign(amount));
      return { id, amount, factor: def?.factor, ...(homes.length ? { homes } : {}), ...fill(def, id, vars(homes)) };
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
  };
}
