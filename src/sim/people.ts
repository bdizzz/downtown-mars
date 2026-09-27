import raw from "../../data/people.json";
import type { SimConfig } from "./config";
import { postMessage } from "./messages";
import type { SimState } from "./state";

// A hole's colonists as a few cohorts: a life stage, a head count, and the
// tick they move on (children grow up, adults grow old, elders pass away).
// Cheap at any size, and deterministic: spans come from a hash of the hole,
// the tick and the cohort's place, not from the hole's random stream.

export type Stage = "child" | "adult" | "elder";

export interface Cohort {
  stage: Stage;
  count: number;
  /** Tick this cohort moves to its next stage (or, for elders, passes away). */
  until: number;
}

export const people = raw as unknown as {
  cohortSize: number;
  adult: { workSpanDays: [number, number] };
  child: { days: number; needsFactor: number };
  elder: { days: [number, number]; needsFactor: number };
  births: { minHappiness: number; perAdultPerDay: number };
  school: { familySize: number; unschooledComfort: number };
  elderCare: { affectedPerElder: number; uncaredHealth: number };
};

/** 0..1 from a few integers, stable across runs and platforms. */
export function hash01(...xs: number[]): number {
  let h = 0x9e3779b9;
  for (const x of xs) {
    h = Math.imul(h ^ (x | 0), 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return (h >>> 0) / 0x100000000;
}

export function spanTicks([lo, hi]: [number, number], cfg: SimConfig, ...seed: number[]): number {
  return Math.round((lo + (hi - lo) * hash01(...seed)) * cfg.ticksPerDay);
}

export function countStage(state: SimState, stage: Stage): number {
  return state.population.cohorts.reduce((n, c) => n + (c.stage === stage ? c.count : 0), 0);
}

export function stageCounts(state: SimState): Record<Stage, number> {
  return { child: countStage(state, "child"), adult: countStage(state, "adult"), elder: countStage(state, "elder") };
}

/** Keep the head count everything else reads in step with the cohorts. */
export function syncCount(state: SimState): void {
  state.population.count = state.population.cohorts.reduce((n, c) => n + c.count, 0);
}

/** New working adults (from Earth, a convoy, or migration), in groups with their own working spans. */
export function addAdults(state: SimState, n: number, cfg: SimConfig): void {
  const size = people.cohortSize;
  for (let i = 0; n > 0; i++) {
    const count = Math.min(size, n);
    n -= count;
    const until = state.tick + spanTicks(people.adult.workSpanDays, cfg, state.holeId, state.tick, i, state.population.cohorts.length);
    state.population.cohorts.push({ stage: "adult", count, until });
  }
  syncCount(state);
}

/** Add cohorts that already exist (volunteers or migrants arriving). */
export function addCohorts(state: SimState, cohorts: Cohort[]): void {
  for (const c of cohorts) if (c.count > 0) state.population.cohorts.push({ ...c });
  syncCount(state);
}

/** Take up to n adults, youngest first (the longest working span left). Returns who left. */
export function takeAdults(state: SimState, n: number): Cohort[] {
  const taken: Cohort[] = [];
  const adults = state.population.cohorts.filter((c) => c.stage === "adult").sort((a, b) => b.until - a.until);
  for (const c of adults) {
    if (n <= 0) break;
    const k = Math.min(n, c.count);
    c.count -= k;
    n -= k;
    taken.push({ ...c, count: k });
  }
  state.population.cohorts = state.population.cohorts.filter((c) => c.count > 0);
  syncCount(state);
  return taken;
}

/** For tests and old saves: exactly n adults, with the usual spread of working spans. */
export function setAdults(state: SimState, n: number, cfg: SimConfig): void {
  state.population.cohorts = state.population.cohorts.filter((c) => c.stage !== "adult");
  addAdults(state, n, cfg);
}

/** What a hole has for rooms that need something: deposits under it, and stages reached. */
export function holeGates(state: SimState): string[] {
  return [...(state.deposits ?? []), ...(state.unlocks ?? [])];
}

/** Record that a hole has reached something that unlocks rooms (first child, first elder). */
export function unlock(state: SimState, what: "children" | "elders"): void {
  state.unlocks ??= [];
  if (!state.unlocks.includes(what)) state.unlocks.push(what);
}

/** Colonists weighted by what they eat, drink and breathe: children need less. */
export function needsWeight(state: SimState): number {
  return state.population.cohorts.reduce(
    (n, c) => n + c.count * (c.stage === "child" ? people.child.needsFactor : c.stage === "elder" ? people.elder.needsFactor : 1),
    0,
  );
}

/** Cohorts whose time has come move on: adults retire into elders, and elders pass away. */
export function stepAging(state: SimState, cfg: SimConfig): void {
  const due = state.population.cohorts.filter((c) => c.until <= state.tick);
  if (!due.length) return;
  let retired = 0;
  let passed = 0;
  let grown = 0;
  for (const c of due) {
    if (c.stage === "child") {
      c.stage = "adult";
      c.until = state.tick + spanTicks(people.adult.workSpanDays, cfg, state.holeId, state.tick, c.count, 3);
      grown += c.count;
    } else if (c.stage === "adult") {
      c.stage = "elder";
      c.until = state.tick + spanTicks(people.elder.days, cfg, state.holeId, state.tick, c.count, 7);
      retired += c.count;
    } else if (c.stage === "elder") {
      passed += c.count;
      c.count = 0;
    }
  }
  state.population.cohorts = state.population.cohorts.filter((c) => c.count > 0);
  syncCount(state);
  const first = retired > 0 && !(state.unlocks ?? []).includes("elders");
  if (retired) unlock(state, "elders");
  if (retired) {
    postMessage(
      state,
      cfg,
      first
        ? `The first colonists have retired: ${retired} ${retired === 1 ? "elder" : "elders"} who no longer work, and will want elder care.`
        : `${retired} ${retired === 1 ? "colonist has" : "colonists have"} retired and joined the elders.`,
    );
  }
  if (grown) {
    postMessage(
      state,
      cfg,
      `${grown} ${grown === 1 ? "child has" : "children have"} grown up on Mars and joined the workforce.`,
      "good",
    );
  }
  if (passed) {
    postMessage(state, cfg, `${passed} ${passed === 1 ? "elder has" : "elders have"} passed away peacefully, after a long life on Mars.`);
  }
}
