import raw from "../../data/visits.json";
import type { SimConfig } from "./config";
import { isActive } from "./economy";
import { postMessage } from "./messages";
import { enact } from "./ordinances";
import { nextRandom } from "./rng";
import { roomDef } from "./rooms";
import type { SimState } from "./state";

// Citizen visits: a notable turns up at the office with a problem the hole
// really has, and the player picks an answer. Promises are checked later and
// either kept or broken. Unanswered visits leave after a while, unhappy.

export interface Outcome {
  loyalty?: number;
  /** Happiness bump for the home the visit is about. */
  homeHappiness?: number;
  /** Happiness bump for every home. */
  allHappiness?: number;
  message?: string;
  enact?: string;
}

export interface PromiseDef {
  check: "noiseFixed" | "clinicBuilt";
  days: number;
  kept: Outcome;
  broken: Outcome;
}

export interface ChoiceDef extends Outcome {
  id: string;
  label: string;
  hint: string;
  promise?: PromiseDef;
}

export interface VisitDef {
  id: string;
  title: string;
  text: string;
  minDay?: number;
  cooldownDays: number;
  patienceDays: number;
  ignored: Outcome;
  choices: ChoiceDef[];
}

export interface Visit {
  id: number;
  kind: string;
  notableId: number;
  /** The home the visit is about, if any. */
  roomId?: number;
  title: string;
  text: string;
  arrivedTick: number;
  leavesTick: number;
}

export interface OpenPromise {
  kind: string;
  check: PromiseDef["check"];
  notableId: number;
  roomId?: number;
  dueTick: number;
  kept: Outcome;
  broken: Outcome;
}

export interface Office {
  waiting: Visit[];
  promises: OpenPromise[];
  /** Last tick each kind of visit arrived, for cooldowns. */
  lastVisit: Record<string, number>;
  nextVisitId: number;
}

export const visitDefs: VisitDef[] = raw.visits as VisitDef[];
const byId = new Map(visitDefs.map((v) => [v.id, v]));

export function visitDef(kind: string): VisitDef {
  const def = byId.get(kind);
  if (!def) throw new Error(`unknown visit "${kind}"`);
  return def;
}

export function createOffice(): Office {
  return { waiting: [], promises: [], lastVisit: {}, nextVisitId: 1 };
}

// ---- triggers: what in the hole prompts each kind of visit ----

interface Trigger {
  roomId?: number;
  /** Prefer a notable with this role as the messenger. */
  role?: string;
}

const noisiestHome = (state: SimState) =>
  state.happiness.pools
    .filter((p) => p.residents > 0 && p.factors.noise <= -1)
    .sort((a, b) => a.factors.noise - b.factors.noise)[0];

const hasClinic = (state: SimState) => state.layout.rooms.some((r) => r.type === "clinic" && isActive(r));

const TRIGGERS: Record<string, (state: SimState) => Trigger | null> = {
  noise_complaint: (state) => {
    const home = noisiestHome(state);
    if (!home) return null;
    if (state.office.promises.some((p) => p.check === "noiseFixed" && p.roomId === home.roomId)) return null;
    return { roomId: home.roomId };
  },
  clinic_demand: (state) => {
    if (hasClinic(state) || state.office.promises.some((p) => p.check === "clinicBuilt")) return null;
    return { role: "doctor" };
  },
};

const CHECKS: Record<PromiseDef["check"], (state: SimState, p: OpenPromise) => boolean> = {
  noiseFixed: (state, p) => {
    const pool = state.happiness.pools.find((x) => x.roomId === p.roomId);
    // Moving everyone out or demolishing the home also ends the complaint.
    return !pool || pool.residents === 0 || pool.factors.noise > -0.5;
  },
  clinicBuilt: (state) => hasClinic(state),
};

// ---- helpers ----

function fill(text: string, state: SimState, notableId: number, roomId?: number): string {
  const notable = state.notables.find((n) => n.id === notableId);
  const room = roomId !== undefined ? state.layout.rooms.find((r) => r.id === roomId) : undefined;
  return text
    .replaceAll("{name}", notable?.name ?? "A colonist")
    .replaceAll("{home}", room ? roomDef(room.type).name.toLowerCase() : "homes")
    .replaceAll("{floor}", room?.at.kind === "ring" ? String(room.at.floor) : "1");
}

function messenger(state: SimState, role?: string): number | null {
  const pool = state.notables.filter((n) => n.role === role);
  const from = pool.length ? pool : state.notables;
  if (!from.length) return null;
  return from[Math.floor(nextRandom(state) * from.length)]!.id;
}

function bump(state: SimState, roomId: number | undefined, amount: number): void {
  for (const p of state.happiness.pools) {
    if (roomId === undefined || p.roomId === roomId) p.happiness = Math.max(0, Math.min(100, p.happiness + amount));
  }
}

function applyOutcome(state: SimState, cfg: SimConfig, o: Outcome, notableId: number, roomId?: number): void {
  const notable = state.notables.find((n) => n.id === notableId);
  if (notable && o.loyalty) notable.loyalty = Math.max(0, Math.min(100, notable.loyalty + o.loyalty));
  if (o.homeHappiness && roomId !== undefined) bump(state, roomId, o.homeHappiness);
  if (o.allHappiness) bump(state, undefined, o.allHappiness);
  if (o.enact) enact(state, o.enact);
  if (o.message) {
    const kind = (o.loyalty ?? 0) < 0 ? "warn" : "info";
    postMessage(state, cfg, fill(o.message, state, notableId, roomId), kind);
  }
}

// ---- the tick ----

export function stepVisits(state: SimState, cfg: SimConfig): void {
  if (state.tick % raw.checkEveryTicks !== 0) return;
  const office = state.office;

  // Visitors who waited too long leave.
  for (const v of office.waiting.filter((v) => state.tick >= v.leavesTick)) {
    applyOutcome(state, cfg, visitDef(v.kind).ignored, v.notableId, v.roomId);
  }
  office.waiting = office.waiting.filter((v) => state.tick < v.leavesTick);

  // Promises come due, or are kept early.
  for (const p of [...office.promises]) {
    const kept = CHECKS[p.check](state, p);
    if (!kept && state.tick < p.dueTick) continue;
    applyOutcome(state, cfg, kept ? p.kept : p.broken, p.notableId, p.roomId);
    office.promises = office.promises.filter((x) => x !== p);
  }

  // New visitors, if there's room to wait.
  const day = state.tick / cfg.ticksPerDay;
  for (const def of visitDefs) {
    if (office.waiting.length >= raw.waitingRoomSize) break;
    if (office.waiting.some((v) => v.kind === def.id)) continue;
    if (def.minDay !== undefined && day < def.minDay) continue;
    const last = office.lastVisit[def.id];
    if (last !== undefined && state.tick - last < def.cooldownDays * cfg.ticksPerDay) continue;
    const trig = TRIGGERS[def.id]?.(state);
    if (!trig) continue;
    const notableId = messenger(state, trig.role);
    if (notableId === null) continue;

    office.lastVisit[def.id] = state.tick;
    office.waiting.push({
      id: office.nextVisitId++,
      kind: def.id,
      notableId,
      ...(trig.roomId !== undefined ? { roomId: trig.roomId } : {}),
      title: def.title,
      text: fill(def.text, state, notableId, trig.roomId),
      arrivedTick: state.tick,
      leavesTick: state.tick + def.patienceDays * cfg.ticksPerDay,
    });
    const name = state.notables.find((n) => n.id === notableId)?.name ?? "Someone";
    postMessage(state, cfg, `${name} is waiting at the office: ${def.title.toLowerCase()}.`, "info");
  }
}

export function answerVisit(
  state: SimState,
  cfg: SimConfig,
  visitId: number,
  choiceId: string,
): { ok: true } | { ok: false; reason: string } {
  const visit = state.office.waiting.find((v) => v.id === visitId);
  if (!visit) return { ok: false, reason: "They've already left" };
  const choice = visitDef(visit.kind).choices.find((c) => c.id === choiceId);
  if (!choice) return { ok: false, reason: "No such answer" };
  if (choice.enact && !state.ordinances.includes(choice.enact)) {
    const r = enact(state, choice.enact);
    if (!r.ok) return r;
  }

  state.office.waiting = state.office.waiting.filter((v) => v !== visit);
  applyOutcome(state, cfg, choice, visit.notableId, visit.roomId);
  if (choice.promise) {
    state.office.promises.push({
      kind: visit.kind,
      check: choice.promise.check,
      notableId: visit.notableId,
      ...(visit.roomId !== undefined ? { roomId: visit.roomId } : {}),
      dueTick: state.tick + choice.promise.days * cfg.ticksPerDay,
      kept: choice.promise.kept,
      broken: choice.promise.broken,
    });
  }
  return { ok: true };
}
