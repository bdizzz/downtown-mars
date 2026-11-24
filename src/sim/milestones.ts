import raw from "../../data/milestones.json";
import { gameTime } from "./clock";
import { config, type SimConfig } from "./config";
import { LABELS } from "./ledger";
import { postMessage } from "./messages";
import { resourceDef } from "./resources";
import { roomDef, roomDefs } from "./rooms";
import type { SimState } from "./state";
import { cultureGap, type Culture } from "./culture";
import { heldMonths, stepSufficiency, type Tier } from "./sufficiency";
import type { World } from "./world";

// Milestones (F-005): one catalog of what a hole can achieve, tracked per hole
// with the day each was reached. Some also propose a celebration (events.ts).
// Everything but the checks is data (data/milestones.json).

export type MilestoneCheck =
  | "population"
  | "born"
  | "floors"
  | "harvest"
  | "grownUp"
  | "generation"
  | "passedAway"
  | "fullRing"
  | "domed"
  | "closedLoop"
  | "holesCapped"
  | "selfSufficient"
  | "noDrops"
  | "founded"
  | "tradeRoutes"
  | "holesLinked"
  | "culturesApart"
  | "event";

export interface MilestoneDef {
  id: string;
  title: string;
  /** How to get there, for the milestones panel. */
  hint?: string;
  group: string;
  check: MilestoneCheck;
  at?: number;
  /** closedLoop: the resources that make up the loop (clean and gray water); `at` is the people it needs first. */
  loop?: string[];
  /** selfSufficient: which tier (sufficiency.ts), held for `months` game months. */
  tier?: Tier;
  months?: number;
  /** culturesApart: how far one hole's culture must be from every other's (culture.ts cultureGap, 0 to 2). */
  gap?: number;
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

/** How far along a counted milestone is (people, floors, children born…); null for the yes-or-no ones. */
export function progress(state: SimState, m: MilestoneDef): number | null {
  const pop = state.population;
  switch (m.check) {
    case "population":
      return pop.count;
    case "born":
      return pop.born ?? 0;
    case "floors":
      return state.layout.hole.floors;
    case "harvest":
      return state.harvested ?? 0;
    case "grownUp":
      return pop.grownUp ?? 0;
    case "generation":
      return pop.generation ?? 1;
    case "passedAway":
      // Older saves kept only those laid in a crypt.
      return pop.passedAway ?? pop.interred ?? 0;
    case "noDrops":
      return monthsWithoutDrops(state);
    default:
      return null;
  }
}

/** Has the hole got there? Event milestones never are by themselves: an event reaches them. */
export function passed(state: SimState, m: MilestoneDef): boolean {
  switch (m.check) {
    case "population":
    case "born":
    case "floors":
    case "harvest":
    case "grownUp":
    case "generation":
    case "passedAway":
      return progress(state, m)! >= (m.at ?? 1);
    case "fullRing":
      return fullRing(state);
    case "domed":
      return !!state.layout.domed;
    case "closedLoop":
      // A tiny crew with the landing kit's recycler closes the loop by itself (#441): it counts once
      // the hole is big enough for its water to matter.
      return state.population.count >= (m.at ?? 0) && closedLoop(state, m.loop ?? []);
    case "selfSufficient":
      return heldMonths(state, config, m.tier ?? "alone") >= (m.months ?? 1);
    case "noDrops":
      return state.population.count > 0 && !state.failed && monthsWithoutDrops(state) >= (m.at ?? 1);
    case "founded": // these need the world: trackNetworkMilestones reaches them
    case "holesCapped":
    case "tradeRoutes":
    case "holesLinked":
    case "culturesApart":
    case "event":
      return false;
  }
}

/** Whole game months since the last supply drop landed (or the hole began). */
function monthsWithoutDrops(state: SimState): number {
  const last = state.earth.lastDropTick;
  return last === undefined ? 0 : Math.floor((state.tick - last) / config.ticksPerDay);
}

/** Is every slot of some floor's ring dug out, beyond the rings the landing crew blasted out of floor 1? */
export function fullRing(state: SimState): boolean {
  const { hole, open } = state.layout;
  for (let f = 0; f < Math.min(hole.floors, open?.length ?? 0); f++) {
    for (let r = 0; r < hole.unlockedRings; r++) {
      if (f === 0 && r < config.starterHole.openRings) continue;
      const row = open![f]![r];
      if (row && row.length === hole.ringSlots[r] && row.every((v) => v === 1)) return true;
    }
  }
  return false;
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
 * They didn't count harvests, so a working farm means the first harvest is behind them.
 */
export function milestonesOf(state: SimState): ReachedMilestone[] {
  if (!state.milestones) {
    const celebrated = new Set(state.events?.celebrated ?? []);
    const farming = state.layout.rooms.some((r) => !r.planned && !r.building && roomDef(r.type).growsCrops);
    const before = (m: MilestoneDef) => celebrated.has(m.id) || passed(state, m) || (m.check === "harvest" && farming);
    state.milestones = milestoneData.milestones.filter(before).map((m) => ({ id: m.id, day: null }));
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

/** The network's milestones (#413, #184): reached once for the whole network, and counted in every hole's panel. */
export const NETWORK_CHECKS: MilestoneCheck[] = ["holesCapped", "tradeRoutes", "holesLinked", "culturesApart"];

/** The biggest group of holes joined by trade routes, either way: their ids, oldest route first. */
export function linkedHoles(routes: { fromHoleId: number; toHoleId: number }[]): number[] {
  const groups: Set<number>[] = [];
  for (const r of routes) {
    const touching = groups.filter((g) => g.has(r.fromHoleId) || g.has(r.toHoleId));
    const merged = new Set<number>([r.fromHoleId, r.toHoleId, ...touching.flatMap((g) => [...g])]);
    for (const g of touching) groups.splice(groups.indexOf(g), 1);
    groups.push(merged);
  }
  return [...groups.reduce<Set<number>>((a, b) => (b.size > a.size ? b : a), new Set())];
}

/** The hole whose culture is furthest from the nearest other's, and how far (null with fewer than two holes). */
export function mostApart(holes: { id: number; culture: Culture }[]): { id: number; gap: number } | null {
  if (holes.length < 2) return null;
  let best: { id: number; gap: number } | null = null;
  for (const a of holes) {
    const gap = Math.min(...holes.filter((b) => b !== a).map((b) => cultureGap(a.culture, b.culture)));
    if (!best || gap > best.gap) best = { id: a.id, gap };
  }
  return best;
}

/**
 * The milestones that need the whole world, from the world's step. A kit sent is the hole's own, reached
 * by the hole that founded another. The network's are reached once, in the hole that got it there: the
 * latest capped, the one whose rover set out, the one that drifted apart.
 */
export function trackNetworkMilestones(world: Pick<World, "holes" | "routes">, cfg: SimConfig): void {
  const { holes, routes } = world;
  const live = holes.filter((h) => !h.failed && h.population.count > 0);
  const capped = holes.filter((h) => h.depth?.capped).sort((a, b) => a.depth!.capped!.tick - b.depth!.capped!.tick);
  const linked = routes.length ? linkedHoles(routes) : [];
  const apart = mostApart(live.map((h) => ({ id: h.holeId, culture: h.culture })));
  const hole = (id: number | undefined) => holes.find((h) => h.holeId === id);
  for (const m of milestoneData.milestones) {
    if (m.check === "founded") {
      for (const h of holes) {
        if (!hasReached(h, m.id) && holes.filter((c) => c.parentHoleId === h.holeId).length >= (m.at ?? 1)) reachMilestone(h, cfg, m.id);
      }
      continue;
    }
    if (!NETWORK_CHECKS.includes(m.check) || holes.some((h) => hasReached(h, m.id))) continue;
    let by: SimState | undefined;
    if (m.check === "holesCapped" && capped.length >= (m.at ?? 1)) by = capped.at(-1);
    else if (m.check === "tradeRoutes" && routes.length >= (m.at ?? 1)) by = hole(routes.at(-1)!.fromHoleId);
    else if (m.check === "holesLinked" && linked.length >= (m.at ?? 2)) {
      by = hole(routes.filter((r) => linked.includes(r.fromHoleId)).at(-1)?.fromHoleId);
    } else if (m.check === "culturesApart" && apart && apart.gap >= (m.gap ?? 1)) by = hole(apart.id);
    if (by) reachMilestone(by, cfg, m.id);
  }
}

/** Every milestone passed since the last check is reached now. */
export function trackMilestones(state: SimState, cfg: SimConfig): void {
  stepSufficiency(state, cfg);
  for (const m of milestoneData.milestones) {
    if (!hasReached(state, m.id) && passed(state, m)) reachMilestone(state, cfg, m.id);
  }
}
