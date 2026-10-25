import raw from "../../data/milestones.json";
import { gameTime } from "./clock";
import type { SimConfig } from "./config";
import { LABELS } from "./ledger";
import { postMessage } from "./messages";
import { resourceDef } from "./resources";
import { roomDefs } from "./rooms";
import type { SimState } from "./state";

// Milestones (F-005): one catalog of what a hole can achieve, tracked per hole
// with the day each was reached. Some also propose a celebration (events.ts).
// Everything but the checks is data (data/milestones.json).

export type MilestoneCheck = "population" | "born" | "floors" | "domed" | "closedLoop" | "event";

export interface MilestoneDef {
  id: string;
  title: string;
  group: string;
  check: MilestoneCheck;
  at?: number;
  /** closedLoop: the resources that make up the loop (clean and gray water). */
  loop?: string[];
  /** Reaching it proposes a celebration. */
  celebrate?: boolean;
}

/** A milestone this hole has reached: on which game day (null if an older save had passed it already). */
export interface ReachedMilestone {
  id: string;
  day: number | null;
}

export const milestoneData = raw as unknown as {
  reached: string;
  groups: { id: string; label: string }[];
  milestones: MilestoneDef[];
};

const byId = new Map(milestoneData.milestones.map((m) => [m.id, m]));

export function milestoneDef(id: string): MilestoneDef | undefined {
  return byId.get(id);
}

/** Has the hole got there? Event milestones never are by themselves: an event reaches them. */
export function passed(state: SimState, m: MilestoneDef): boolean {
  switch (m.check) {
    case "population":
      return state.population.count >= (m.at ?? 0);
    case "born":
      return (state.population.born ?? 0) >= (m.at ?? 1);
    case "floors":
      return state.layout.hole.floors >= (m.at ?? 0);
    case "domed":
      return !!state.layout.domed;
    case "closedLoop":
      return closedLoop(state, m.loop ?? []);
    case "event":
      return false;
  }
}

/** Rooms by their ledger label; treatment is any that uses a waste (the water recycler, the tailings reclaimer). */
const ROOM_LABELS = new Set(roomDefs.map((r) => r.name));
const TREATMENT = new Set(roomDefs.filter((r) => Object.keys(r.uses).some((id) => resourceDef(id).waste)).map((r) => r.name));

/**
 * Over the last whole month (a ledger day), did treatment put back into the loop more than the
 * loop lost for good? Each room's (and the household's) loss is what it took from the loop beyond
 * what it put back: the recycler's sludge, industry's tailings, the electrolyzer's oxygen; overflow
 * is lost too. Water moved in or out (drops, rovers, kits, building) isn't the loop leaking.
 */
export function closedLoop(state: SimState, loop: string[]): boolean {
  const month = state.ledger.days.at(-1);
  if (!month) return false;
  const taken = new Map<string, number>();
  const own = (label: string) => ROOM_LABELS.has(label) || label === LABELS.household;
  let returned = 0;
  let lost = 0;
  for (const id of loop) {
    const f = month[id];
    if (!f) continue;
    for (const [label, v] of Object.entries(f.out)) {
      if (label === LABELS.lost) lost += v;
      else if (own(label)) taken.set(label, (taken.get(label) ?? 0) + v);
    }
    for (const [label, v] of Object.entries(f.in)) {
      if (TREATMENT.has(label)) returned += v;
      if (own(label)) taken.set(label, (taken.get(label) ?? 0) - v);
    }
  }
  // A source (a well) puts in without taking: no loss, and no return either.
  for (const v of taken.values()) lost += Math.max(0, v);
  return returned > lost;
}

/**
 * The hole's milestones, made on first use. Older saves mark what they've already passed (and any
 * milestone they celebrated, an event's among them) as reached on a day unknown, without news.
 */
export function milestonesOf(state: SimState): ReachedMilestone[] {
  if (!state.milestones) {
    const celebrated = new Set(state.events?.celebrated ?? []);
    state.milestones = milestoneData.milestones.filter((m) => celebrated.has(m.id) || passed(state, m)).map((m) => ({ id: m.id, day: null }));
  }
  return state.milestones;
}

export function hasReached(state: SimState, id: string): boolean {
  return milestonesOf(state).some((m) => m.id === id);
}

/** Mark a milestone reached today, with the news. False if it already was. */
export function reachMilestone(state: SimState, cfg: SimConfig, id: string): boolean {
  if (hasReached(state, id)) return false;
  milestonesOf(state).push({ id, day: gameTime(state.tick, cfg).day });
  const title = byId.get(id)?.title ?? id;
  postMessage(state, cfg, milestoneData.reached.replaceAll("{title}", title), "good");
  return true;
}

/** Every milestone passed since the last check is reached now. */
export function trackMilestones(state: SimState, cfg: SimConfig): void {
  for (const m of milestoneData.milestones) {
    if (!hasReached(state, m.id) && passed(state, m)) reachMilestone(state, cfg, m.id);
  }
}
