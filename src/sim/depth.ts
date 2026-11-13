import raw from "../../data/depth.json";
import type { SimConfig } from "./config";
import type { DepositKind } from "./mapgeo";
import { postMessage } from "./messages";
import { hash01 } from "./people";
import type { SimState } from "./state";
import { cavityOn, eventDef, eventsOf, raiseEvent, type PendingEvent } from "./events";

// Every hole's hidden depth (#390). When a hole is founded it rolls a hard
// limit (the last floor the drill can reach) and one or two soft limits above
// it. Nothing shows them: a floor or two before each the player gets an omen,
// and at each the drill stops with an event. At a soft limit they pay to dig on
// or stop for good; at the hard limit the hole ends, for a reason from the
// place itself. Either way the hole is capped, for good, with a ceremony and a
// name from how it ended. Everything but the triggers is data (data/depth.json).

export interface DepthLimit {
  /** The last floor dug before the drill stops here. */
  floor: number;
  /** The event it raises (data/events.json), picked when the limits are rolled so its omens can match. */
  event: string;
  soft: boolean;
  /** The omen comes this many floors before it. */
  lead: number;
  /** The omen's been given. */
  omened?: boolean;
}

/** How a capped hole ended: its final depth and the ending that names it. */
export interface Capped {
  tick: number;
  floors: number;
  /** An event id from data/depth.json `endings` ("geothermal_pocket"), or "stopped" for the player's own call. */
  ending: string;
}

export interface DepthState {
  /** Limits still ahead, shallowest first: soft ones the player has paid past are gone. The last is the hard limit. */
  limits: DepthLimit[];
  /** The drill is stopped at a limit, waiting for this event's answer. */
  held?: { eventId: number; floor: number };
  /** The hole is capped: it never digs again. */
  capped?: Capped;
  /** When the last omen came, for the rig's judder and the sound (a tremor shakes the camera too). */
  omenTick?: number;
  tremorTick?: number;
  /** Crated drills waiting here for the next seed kit gathered at this hole (#411). */
  crates?: number;
}

interface Weighted {
  event: string;
  weight: number;
  boostIfDeposit?: string;
  boost?: number;
}

export const depthData = raw as unknown as {
  hard: [number, number];
  firstHoleMin: number;
  softMin: number;
  secondSoftChance: number;
  omenLead: [number, number];
  drill: Record<string, number>;
  repairShare: number;
  scrapShare: number;
  magmaCells: number;
  softEvents: Weighted[];
  hardEvents: Weighted[];
  omens: Record<string, { text: string; tremor?: boolean }[]>;
  endings: Record<string, string>;
  plaque: string;
};

function pick(list: Weighted[], deposits: DepositKind[], r: number): string {
  const w = (e: Weighted) => e.weight * (e.boostIfDeposit && deposits.includes(e.boostIfDeposit as DepositKind) ? (e.boost ?? 1) : 1);
  let left = r * list.reduce((s, e) => s + w(e), 0);
  return (list.find((e) => (left -= w(e)) < 0) ?? list.at(-1)!).event;
}

/**
 * Roll a hole's limits from its seed. The first hole goes at least firstHoleMin deep. A hole already
 * dug deeper (an older save) keeps what it has: every limit lies below its deepest floor.
 */
export function rollDepth(seed: number, holeId: number, deposits: DepositKind[], dug: number, cfg: SimConfig): DepthState {
  const d = depthData;
  const r = (...about: number[]) => hash01(seed, holeId, 0xd3e7, ...about);
  const ceiling = cfg.digging.maxFloors;
  const lo = Math.max(d.hard[0], holeId === 1 ? d.firstHoleMin : 0);
  let hard = lo + Math.floor(r(1) * (d.hard[1] - lo + 1));
  hard = Math.min(ceiling, Math.max(hard, dug + 1));
  // Never before floor 2 is dug (floor 1 comes with the landing), so every omen can come.
  const lead = (k: number, floor: number) => Math.max(1, Math.min(floor - 2, d.omenLead[0] + Math.floor(r(5, k) * (d.omenLead[1] - d.omenLead[0] + 1))));
  // Soft limits: one, sometimes two, between softMin and the floor above the hard limit, and below what's dug.
  const softLo = Math.max(d.softMin, dug + 1);
  const room = hard - softLo; // floors softLo..hard-1
  const soft: number[] = [];
  if (room > 0) {
    const want = r(2) < d.secondSoftChance && room > 1 ? 2 : 1;
    for (let k = 0; soft.length < want && k < 8; k++) {
      const f = softLo + Math.floor(r(3, k) * room);
      if (!soft.includes(f)) soft.push(f);
    }
    soft.sort((a, b) => a - b);
  }
  const limits: DepthLimit[] = soft.map((floor, k) => ({ floor, event: pick(d.softEvents, deposits, r(4, k)), soft: true, lead: lead(k, floor) }));
  limits.push({ floor: hard, event: pick(d.hardEvents, deposits, r(4, 9)), soft: false, lead: lead(9, hard) });
  return { limits };
}

/** The hole's depth, rolled on first use (an older save gets its limits on load, all below what it's dug). */
export function depthOf(state: SimState, cfg: SimConfig): DepthState {
  state.depth ??= rollDepth(eventsOf(state).seed, state.holeId, state.deposits ?? [], state.layout.hole.floors, cfg);
  return state.depth;
}

export function isCapped(state: SimState): boolean {
  return !!state.depth?.capped;
}

/** Stopped at a limit, waiting for the player, or capped for good. */
export function drillStopped(state: SimState): "held" | "capped" | null {
  if (state.depth?.capped) return "capped";
  if (state.depth?.held) return "held";
  return null;
}

/** The drill's materials times a share, as whole units: costs round up, returns round down. */
export function drillShare(share: number, up: boolean): Record<string, number> {
  return Object.fromEntries(
    Object.entries(depthData.drill)
      .map(([id, v]) => [id, up ? Math.ceil(v * share) : Math.floor(v * share)] as const)
      .filter(([, v]) => v > 0),
  );
}

export const repairCost = () => drillShare(depthData.repairShare, true);
export const scrapReturn = () => drillShare(depthData.scrapShare, false);

/** "1 machinery, 6 metal, 1 electronics", for the cards' hints. */
export function goodsText(goods: Record<string, number>): string {
  return Object.entries(goods)
    .map(([id, v]) => `${v} ${id}`)
    .join(", ");
}

/** The drill finished a floor: an omen if a limit's near, and the drill stops if it's at one. */
export function reachedFloor(state: SimState, cfg: SimConfig, floor: number): void {
  const depth = depthOf(state, cfg);
  for (const limit of depth.limits) {
    if (limit.omened || limit.floor - floor !== limit.lead) continue;
    limit.omened = true;
    omen(state, cfg, limit);
  }
  const at = depth.limits.find((l) => l.floor === floor);
  if (!at) return;
  // A magma chamber needs rock to open up; if there's none left on this floor, the hole ends on a fault.
  let kind = at.event;
  let cells = kind === "magma_chamber" ? cavityOn(state, floor, depthData.magmaCells) : undefined;
  if (cells === null) {
    kind = "fault_line";
    cells = undefined;
  }
  const ev = eventsOf(state);
  ev.struckTick = state.tick;
  const e = raiseEvent(state, cfg, kind, { floor, ...(cells ? { cells } : {}) });
  depth.held = { eventId: e.id, floor };
}

function omen(state: SimState, cfg: SimConfig, limit: DepthLimit): void {
  const pool = depthData.omens[limit.event] ?? [];
  if (!pool.length) return;
  const o = pool[Math.floor(hash01(eventsOf(state).seed, state.holeId, 0x0e1, limit.floor) * pool.length)]!;
  const depth = depthOf(state, cfg);
  depth.omenTick = state.tick;
  if (o.tremor) {
    depth.tremorTick = state.tick;
    eventsOf(state).struckTick = state.tick; // the rig judders (web and Godot), as when it strikes something
  }
  postMessage(state, cfg, o.text, "info");
}

/** An answer to a limit's card: pay to dig on past a soft limit. */
export function digOn(state: SimState, cfg: SimConfig): void {
  const depth = depthOf(state, cfg);
  const floor = depth.held?.floor;
  depth.held = undefined;
  depth.limits = depth.limits.filter((l) => !(l.soft && l.floor === floor));
}

/**
 * Cap the hole for good: no more floors, ever. Any limit card still waiting goes, the hole takes its name
 * from how it ended, and the capping ceremony is proposed.
 */
export function capHole(state: SimState, cfg: SimConfig, ending: string): void {
  const depth = depthOf(state, cfg);
  if (depth.capped) return;
  const ev = eventsOf(state);
  ev.pending = ev.pending.filter((e) => !eventDef(e.kind).limit && e.kind !== "stop_drilling");
  depth.held = undefined;
  depth.limits = [];
  const floors = state.layout.hole.floors;
  depth.capped = { tick: state.tick, floors, ending };
  state.drill.active = false;
  state.drill.progress = 0;
  raiseEvent(state, cfg, "capping", { floor: floors, milestone: endingName(ending), plaque: plaque(state) });
}

/** "the geothermal hole". */
export function endingName(ending: string): string {
  return depthData.endings[ending] ?? depthData.endings.stopped!;
}

/** The plaque's words: "Bradbury, the geothermal hole: 12 floors deep". */
export function plaque(state: SimState): string {
  const c = state.depth?.capped;
  if (!c) return "";
  return depthData.plaque.replaceAll("{name}", state.name).replaceAll("{ending}", endingName(c.ending)).replaceAll("{depth}", `${c.floors} ${c.floors === 1 ? "floor" : "floors"}`);
}

/** Why the player can't ask to stop drilling for good right now, or null. */
export function stopRefusal(state: SimState): string | null {
  if (isCapped(state)) return "The hole is capped already";
  if (eventsOf(state).pending.some((e) => e.kind === "stop_drilling" || eventDef(e.kind).limit)) return "A decision about the drill is waiting already";
  return null;
}

/** The player asks to stop drilling for good: a card to confirm it (and choose what becomes of the drill). */
export function askToStop(state: SimState, cfg: SimConfig): PendingEvent | null {
  if (stopRefusal(state)) return null;
  return raiseEvent(state, cfg, "stop_drilling", { floor: state.layout.hole.floors });
}

/** Crate the drill: it waits here for the next seed kit, which needs the drill's share less (#411). */
export function crateDrill(state: SimState, cfg: SimConfig): void {
  const depth = depthOf(state, cfg);
  depth.crates = (depth.crates ?? 0) + 1;
}

/** What a crated drill takes off a seed kit gathered here: the drill's materials, or nothing without a crate. */
export function crateDiscount(state: SimState): Record<string, number> {
  return (state.depth?.crates ?? 0) > 0 ? { ...depthData.drill } : {};
}

/** A seed kit left with the crate: it's used up. */
export function useCrate(state: SimState): boolean {
  if (!state.depth?.crates) return false;
  state.depth.crates -= 1;
  return true;
}
