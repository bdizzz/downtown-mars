import raw from "../../data/tutorial.json";
import type { Snapshot } from "../sim/snapshot";
import { storageKey } from "./storageKey";

export interface Goal {
  id: string;
  text: string;
  hint: string;
  /** What to pulse: "room:<id>", "hud:<button>" or "overlay:<type>". */
  highlight: string;
}

export const tutorial = raw as { intro: string; goals: Goal[]; outro: string };

/** Things the player did that the sim doesn't know about. */
export interface UiFlags {
  sawNoise: boolean;
  openedFlows: boolean;
  sawThreeD: boolean;
}

const has = (s: Snapshot, type: string, n = 1) => s.layout.rooms.filter((r) => r.type === type).length >= n;

/** Whether each goal is met right now. Goals can be met in any order. */
export const CHECKS: Record<string, (s: Snapshot, ui: UiFlags) => boolean> = {
  // A kitchen cooks and a canteen seats people, so together they stand in for a galley; either alone doesn't.
  galley: (s) => has(s, "galley") || (has(s, "kitchen") && has(s, "canteen")),
  restroom: (s) => has(s, "restroom"),
  // A corridor (not the gallery the game starts with) that actually reaches a room past ring 1.
  corridor: (s) =>
    Object.entries(s.layout.corridorLinked ?? {}).some(([id, linked]) => linked && s.layout.corridors[id] !== "gallery") &&
    s.layout.rooms.some((r) => r.at.kind === "ring" && r.connected && !r.cells.some((c) => c.ring === 1)),
  life_support: (s) => has(s, "life_support"),
  water_tank: (s) => has(s, "water_tank"),
  dorm: (s) => has(s, "bunk_dorm"),
  noise: (_, ui) => ui.sawNoise,
  drop: (s) => s.earth.landed > 0,
  farms: (s) => new Set(s.layout.rooms.filter((r) => r.type === "farm").map((r) => r.crop)).size >= 2,
  visit: (s) => (s.office.answered ?? 0) > 0,
  flows: (_, ui) => ui.openedFlows,
  recycler: (s) => has(s, "water_recycler"),
  clinic: (s) => has(s, "clinic"),
  three_d: (_, ui) => ui.sawThreeD,
};

/** Which goals are met right now, in order. */
export function metGoals(s: Snapshot, flags: UiFlags): boolean[] {
  return tutorial.goals.map((g) => !!CHECKS[g.id]?.(s, flags));
}

/**
 * The step the card shows. With `at` null it follows the first unmet goal; the arrows and dots pick
 * one (`at`), and the card stays there, met or not, until the player meets it, when it moves on to
 * the next unmet goal. Meeting a goal the card isn't on doesn't move it. `wasMet` is whether the
 * picked goal was met last time we looked, so meeting it is a change we can see.
 */
export interface TutorialStep {
  at: number | null;
  wasMet: boolean;
}

export const FOLLOW: TutorialStep = { at: null, wasMet: false };

/** The index the card shows, or -1 when every goal is met (the tutorial's over). */
export function shownGoal(step: TutorialStep, met: boolean[]): number {
  if (met.every(Boolean)) return -1;
  return step.at ?? met.indexOf(false);
}

/** Pick goal `i` (wrapping), as the arrows and dots do. */
export function pickGoal(i: number, met: boolean[]): TutorialStep {
  const n = met.length;
  const at = ((i % n) + n) % n;
  return { at, wasMet: met[at]! };
}

/** The step after the goals changed: on from a picked goal the player has just met. Returns `step` itself when nothing changes. */
export function advanceStep(step: TutorialStep, met: boolean[]): TutorialStep {
  if (step.at === null) return step;
  const now = met[step.at]!;
  if (now === step.wasMet) return step;
  if (!now) return { at: step.at, wasMet: false };
  // Met the picked goal: on to the next unmet one after it, round to the start.
  const n = met.length;
  for (let k = 1; k < n; k++) {
    const i = (step.at + k) % n;
    if (!met[i]) return { at: i, wasMet: false };
  }
  return FOLLOW;
}

const KEY = storageKey("tutorial.hidden");

export function tutorialHidden(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setTutorialHidden(hidden: boolean): void {
  try {
    if (hidden) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable: the choice lasts until reload.
  }
}
