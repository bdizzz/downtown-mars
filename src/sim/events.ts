import raw from "../../data/events.json";
import type { SimConfig } from "./config";
import { recomputeAccess } from "./corridors";
import { openCells, isOpen } from "./excavation";
import type { DepositKind } from "./mapgeo";
import { postMessage } from "./messages";
import { addNotable } from "./notables";
import { addAdults, hash01 } from "./people";
import type { Cell } from "./placement";
import type { SimState } from "./state";

// Events with choices (PLAN-M14): the drill strikes something, a ship calls
// for help, a milestone is reached. An event waits as a card for an answer,
// without pausing the game; left too long, its `ignored` effect happens.
// Everything but the triggers is data (data/events.json).

export interface EventEffect {
  /** Added to stock; negative amounts are a cost (a choice you can't afford can't be picked). */
  resources?: Record<string, number>;
  /** Happiness for everyone, easing off to nothing over `days`. */
  mood?: { amount: number; days: number };
  message?: string;
  /** The hole gains this deposit. */
  deposit?: string;
  /** Dig out the event's cavity (a lava tube) for free. */
  openCavity?: boolean;
  /** Stop the drill for this many days. */
  holdDrillDays?: number;
  /** Condition points (of 100) lost by every room on the floor above the find. */
  conditionFloorAbove?: number;
  /** Newcomers who join the hole as working adults. */
  colonists?: number;
  /** One of the newcomers becomes a notable with this role. */
  notableRole?: string;
  /** Something that happens later: an effect after a number of days, picked between the two. */
  followUp?: { days: [number, number]; effect: EventEffect };
  /** Propose a celebration for this milestone. */
  celebrate?: string;
  /** Hold a festival. */
  festival?: boolean;
  /** The lander comes down on the pad. */
  landing?: boolean;
}

export interface EventChoice extends EventEffect {
  id: string;
  label: string;
  hint: string;
  /** Only with a working landing pad. */
  needsPad?: boolean;
}

export interface EventDef {
  id: string;
  title: string;
  text: string;
  patienceDays: number;
  ignored: EventEffect;
  choices: EventChoice[];
}

/** An event waiting for an answer. */
export interface PendingEvent {
  id: number;
  kind: string;
  title: string;
  text: string;
  arrivedTick: number;
  expiresTick: number;
  /** For a find: the floor it's on; for a lava tube, the cells it would open. */
  floor?: number;
  cells?: Cell[];
  /** Filled into {ship} and {milestone}. */
  ship?: string;
  milestone?: string;
}

interface Mood {
  amount: number;
  startTick: number;
  untilTick: number;
}

export interface EventsState {
  /** Events roll their own dice from this (hashed with what they're about), so they never shift the hole's other luck. */
  seed: number;
  pending: PendingEvent[];
  followUps: { dueTick: number; effect: EventEffect; kind: string }[];
  nextId: number;
  /** Last tick each kind of event arrived, for cooldowns. */
  lastTick: Record<string, number>;
  /** Finds made, and milestones celebrated (or let pass), so each happens once. */
  found: string[];
  celebrated: string[];
  moods: Mood[];
  /** A festival on now (it lifts happiness, and costs a little work). */
  festival?: { startTick: number; untilTick: number };
  /** When the drill last struck something, for the 3D rig's shudder. */
  struckTick?: number;
  /** When the lander last came down for an event (a rescue), for the 3D view. */
  landingTick?: number;
}

export const eventData = raw as unknown as {
  checkEveryTicks: number;
  discoveries: {
    chance: number;
    firstAlways: boolean;
    finds: { event: string; minFloor: number; weight: number; skipIfDeposit?: string; once?: boolean }[];
    cavityCells: number;
  };
  events: EventDef[];
};

const byId = new Map(eventData.events.map((e) => [e.id, e]));

export function eventDef(kind: string): EventDef {
  const def = byId.get(kind);
  if (!def) throw new Error(`unknown event "${kind}"`);
  return def;
}

export function createEvents(seed: number): EventsState {
  return { seed: seed >>> 0, pending: [], followUps: [], nextId: 1, lastTick: {}, found: [], celebrated: [], moods: [] };
}

/** The hole's events, made on first use (older saves have none). */
export function eventsOf(state: SimState): EventsState {
  return (state.events ??= createEvents(state.holeId * 7919 + 17));
}

/** A die for an event: 0..1, the same every time for the same hole, seed and things asked about. */
function roll(state: SimState, ...about: number[]): number {
  return hash01(eventsOf(state).seed, state.holeId, ...about);
}

function fill(text: string, e: Partial<PendingEvent>): string {
  return text
    .replaceAll("{floor}", String(e.floor ?? ""))
    .replaceAll("{ship}", e.ship ?? "")
    .replaceAll("{milestone}", e.milestone ?? "");
}

/** Raise an event: a card waiting for an answer. */
export function raiseEvent(state: SimState, cfg: SimConfig, kind: string, extra: Omit<Partial<PendingEvent>, "id" | "kind"> = {}): PendingEvent {
  const ev = eventsOf(state);
  const def = eventDef(kind);
  const pending: PendingEvent = {
    ...extra,
    id: ev.nextId++,
    kind,
    title: fill(def.title, extra),
    text: fill(def.text, extra),
    arrivedTick: state.tick,
    expiresTick: state.tick + Math.round(def.patienceDays * cfg.ticksPerDay),
  };
  ev.pending.push(pending);
  ev.lastTick[kind] = state.tick;
  postMessage(state, cfg, `${pending.title}: a decision is waiting.`, "info");
  return pending;
}

/** Why a choice can't be picked right now, or null if it can. */
export function choiceRefusal(state: SimState, choice: EventChoice, padWorks: boolean): string | null {
  if (choice.needsPad && !padWorks) return "Needs a staffed, powered landing pad";
  for (const [id, v] of Object.entries(choice.resources ?? {})) {
    if (v < 0 && (state.resources[id] ?? 0) + v < -1e-9) return `Not enough ${id}`;
  }
  return null;
}

/** Answer an event with one of its choices. */
export function answerEvent(state: SimState, cfg: SimConfig, eventId: number, choiceId: string, padWorks: boolean): { ok: true } | { ok: false; reason: string } {
  const ev = eventsOf(state);
  const pending = ev.pending.find((e) => e.id === eventId);
  if (!pending) return { ok: false, reason: "That's already been decided" };
  const choice = eventDef(pending.kind).choices.find((c) => c.id === choiceId);
  if (!choice) return { ok: false, reason: "No such choice" };
  const refusal = choiceRefusal(state, choice, padWorks);
  if (refusal) return { ok: false, reason: refusal };
  ev.pending = ev.pending.filter((e) => e !== pending);
  applyEffect(state, cfg, choice, pending);
  return { ok: true };
}

/** What an effect does to the hole. */
export function applyEffect(state: SimState, cfg: SimConfig, e: EventEffect, at: Partial<PendingEvent> & { kind?: string } = {}): void {
  const ev = eventsOf(state);
  const day = cfg.ticksPerDay;
  for (const [id, v] of Object.entries(e.resources ?? {})) state.resources[id] = Math.max(0, (state.resources[id] ?? 0) + v);
  if (e.mood) ev.moods.push({ amount: e.mood.amount, startTick: state.tick, untilTick: state.tick + Math.round(e.mood.days * day) });
  if (e.deposit && !state.deposits.includes(e.deposit as DepositKind)) state.deposits.push(e.deposit as DepositKind);
  if (e.openCavity && at.cells?.length) {
    openCells(state.layout, at.cells.filter((c) => !isOpen(state.layout, c)));
    recomputeAccess(state.layout);
    state.layout.version++;
  }
  if (e.holdDrillDays) state.drill.holdUntil = Math.max(state.drill.holdUntil ?? 0, state.tick) + Math.round(e.holdDrillDays * day);
  if (e.conditionFloorAbove && at.floor !== undefined) {
    for (const r of state.layout.rooms) {
      if (r.planned || !r.cells.some((c) => c.floor === at.floor! - 1)) continue;
      r.condition = Math.max(0, (r.condition ?? 1) - e.conditionFloorAbove / 100);
    }
  }
  if (e.colonists) addAdults(state, e.colonists, cfg);
  if (e.notableRole) {
    const n = addNotable(state);
    if (n) n.role = e.notableRole;
  }
  if (e.followUp) {
    const [lo, hi] = e.followUp.days;
    const days = lo + roll(state, state.tick, 4) * (hi - lo);
    ev.followUps.push({ dueTick: state.tick + Math.round(days * day), effect: e.followUp.effect, kind: at.kind ?? "" });
  }
  if (e.landing) ev.landingTick = state.tick;
  if (e.message) postMessage(state, cfg, fill(e.message, at), (e.mood?.amount ?? 0) < 0 ? "warn" : "good");
}

/** Happiness everyone gets from recent events (moods easing off, and a festival on). */
export function eventMood(state: SimState): number {
  const ev = state.events;
  if (!ev) return 0;
  let total = 0;
  for (const m of ev.moods) {
    if (state.tick >= m.untilTick) continue;
    total += m.amount * (1 - (state.tick - m.startTick) / Math.max(1, m.untilTick - m.startTick));
  }
  return total;
}

// ---- drill discoveries ----

/** A run of solid rock on a floor for a lava tube: up to `cells` slots side by side in ring 2 or 3. */
function cavityOn(state: SimState, floor: number, cells: number): Cell[] | null {
  const hole = state.layout.hole;
  const rock = (c: Cell) => !isOpen(state.layout, c) && !state.layout.grid[c.floor - 1]?.[c.ring - 1]?.[c.slot];
  for (const ring of [2, 3]) {
    if (ring > hole.unlockedRings) continue;
    const n = hole.ringSlots[ring - 1]!;
    const start = Math.floor(roll(state, floor, ring, 3) * n);
    for (let k = 0; k < n; k++) {
      const run: Cell[] = [];
      for (let i = 0; i < cells; i++) {
        const c = { floor, ring, slot: (start + k + i) % n };
        if (!rock(c)) break;
        run.push(c);
      }
      if (run.length === cells) return run;
    }
  }
  return null;
}

/** The drill finished a floor: perhaps it struck something. */
export function rollDiscovery(state: SimState, cfg: SimConfig, floor: number): void {
  const d = eventData.discoveries;
  const ev = eventsOf(state);
  const first = ev.found.length === 0 && !ev.lastTick.discovery;
  ev.lastTick.discovery = state.tick;
  if (!(first && d.firstAlways) && roll(state, floor, 1) >= d.chance) return;
  const options = d.finds.filter(
    (f) => floor >= f.minFloor && !(f.skipIfDeposit && state.deposits.includes(f.skipIfDeposit as DepositKind)) && !(f.once && ev.found.includes(f.event)),
  );
  let total = options.reduce((s, f) => s + f.weight, 0);
  while (options.length && total > 0) {
    let pick = roll(state, floor, 2, options.length) * total;
    const find = options.find((f) => (pick -= f.weight) < 0) ?? options.at(-1)!;
    const cells = find.event === "lava_tube" ? cavityOn(state, floor, d.cavityCells) : undefined;
    if (cells === null) {
      // No rock left for a tube on this floor: try something else.
      options.splice(options.indexOf(find), 1);
      total -= find.weight;
      continue;
    }
    ev.found.push(find.event);
    ev.struckTick = state.tick;
    raiseEvent(state, cfg, find.event, { floor, ...(cells ? { cells } : {}) });
    return;
  }
}

// ---- the tick ----

export function stepEvents(state: SimState, cfg: SimConfig): void {
  if (state.tick % eventData.checkEveryTicks !== 0) return;
  const ev = state.events;
  if (!ev) return;
  // Waited too long: the event takes its own course.
  for (const e of ev.pending.filter((x) => state.tick >= x.expiresTick)) {
    ev.pending = ev.pending.filter((x) => x !== e);
    applyEffect(state, cfg, eventDef(e.kind).ignored, e);
  }
  // Follow-ups come due.
  for (const f of ev.followUps.filter((x) => state.tick >= x.dueTick)) {
    ev.followUps = ev.followUps.filter((x) => x !== f);
    applyEffect(state, cfg, f.effect, { kind: f.kind });
  }
  ev.moods = ev.moods.filter((m) => state.tick < m.untilTick);
}
