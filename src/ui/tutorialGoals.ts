import raw from "../../data/tutorial.json";
import type { Snapshot } from "../sim/snapshot";

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
  galley: (s) => has(s, "galley"),
  restroom: (s) => has(s, "restroom"),
  // A corridor that actually reaches a room past ring 1.
  corridor: (s) =>
    Object.values(s.layout.corridorLinked ?? {}).some(Boolean) &&
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

const KEY = "downtown-mars.tutorial.hidden";

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
