import raw from "../../data/visits.json";
import type { SimConfig } from "./config";
import { DIAGNOSIS, diagnose } from "./diagnosis";
import { isActive } from "./economy";
import { postMessage } from "./messages";
import { enact } from "./ordinances";
import { nextRandom } from "./rng";
import { roomDef } from "./rooms";
import type { SimState } from "./state";

// Citizen visits: a notable turns up at the office with a problem the hole
// really has, and the player picks an answer. Promises are checked later and
// either kept or broken. Unanswered visits leave after a while, unhappy.
// The doctor and a residents' delegate (F-018) come about a diagnosis cause
// that has lasted: the first time only to tell you, later for a promise.

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
  check: "noiseFixed" | "clinicBuilt" | "causeFixed";
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
  /** The diagnosis cause it's about, "health:meals" or "happiness:smell" (the doctor and the delegate). */
  cause?: string;
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
  cause?: string;
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
  /** Visits answered so far (absent in older saves). */
  answered?: number;
  /** When each diagnosis cause the doctor or the delegate would come about began, by its key (absent in older saves). */
  causeSince?: Record<string, number>;
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
  /** The diagnosis cause it's about, and the words for it ({cause}, {amount}, {fix}). */
  cause?: string;
  vars?: Record<string, string>;
}

const noisiestHome = (state: SimState) =>
  state.happiness.pools
    .filter((p) => p.residents > 0 && p.factors.noise <= -1)
    .sort((a, b) => a.factors.noise - b.factors.noise)[0];

const hasClinic = (state: SimState) => state.layout.rooms.some((r) => r.type === "clinic" && isActive(r));

// ---- the doctor and the residents' delegate: a diagnosis cause that has lasted ----

const CONCERNS = raw.concerns;

/** Whether a cause is the doctor's (the hole's health) or the delegate's (happiness). */
const isHealth = (key: string) => key.startsWith("health:");
const causeId = (key: string) => key.slice(key.indexOf(":") + 1);

/** A cause's short name ("meals", "smell"). */
export function causeLabel(key: string): string {
  const id = causeId(key);
  return (isHealth(key) ? DIAGNOSIS.health[id] : DIAGNOSIS.happiness[id])?.label ?? id;
}

/** The causes worth a visit right now: anything draining health, and the happiness parts costing problemPoints or more. */
function concernKeys(state: SimState): string[] {
  const out: string[] = [];
  for (const [id, v] of Object.entries(state.population.healthDrain ?? {})) if (v > 0.001) out.push(`health:${id}`);
  for (const [id, v] of Object.entries(state.happiness.points ?? {})) {
    if (v <= -CONCERNS.problemPoints && !CONCERNS.skip.includes(id) && DIAGNOSIS.happiness[id]?.fix) out.push(`happiness:${id}`);
  }
  return out;
}

/** A cause no longer worth a promise: it doesn't drain health, or costs less than fixedPoints of happiness. */
function causeFixed(state: SimState, key: string): boolean {
  const id = causeId(key);
  return isHealth(key) ? (state.population.healthDrain?.[id] ?? 0) <= 0.001 : (state.happiness.points?.[id] ?? 0) > -CONCERNS.fixedPoints;
}

/** Keep when each cause began, so a visit waits until one has lasted. */
function trackCauses(state: SimState): void {
  const now = new Set(concernKeys(state));
  const since = (state.office.causeSince ??= {});
  for (const key of Object.keys(since)) if (!now.has(key)) delete since[key];
  for (const key of now) since[key] ??= state.tick;
}

const tenth = (v: number) => String(Math.round(v * 10) / 10);

/** The worst lasting cause for the doctor (health) or the delegate, the first time (note) or again (promise). */
function concernTrigger(state: SimState, cfg: SimConfig, health: boolean, again: boolean): Trigger | null {
  const office = state.office;
  const day = cfg.ticksPerDay;
  const due = Object.entries(office.causeSince ?? {})
    .filter(([key, since]) => {
      if (isHealth(key) !== health || state.tick - since < CONCERNS.holdDays * day) return false;
      if (office.waiting.some((v) => v.cause === key) || office.promises.some((p) => p.cause === key)) return false;
      const last = office.lastVisit[`cause:${key}`];
      return again ? last !== undefined && state.tick - last >= CONCERNS.repeatDays * day : last === undefined;
    })
    .map(([key]) => key);
  if (!due.length) return null;
  const d = diagnose(state, cfg);
  const causes = health ? d.health.causes : d.happiness.causes;
  const cause = causes.filter((c) => due.includes(`${health ? "health" : "happiness"}:${c.id}`)).sort((a, b) => a.amount - b.amount)[0];
  if (!cause) return null;
  return {
    role: health ? "doctor" : "organizer",
    cause: `${health ? "health" : "happiness"}:${cause.id}`,
    vars: {
      cause: cause.text,
      amount: health ? `${tenth(-cause.amount)} health a month` : `${tenth(-cause.amount)} points of happiness`,
      fix: cause.fix ?? "",
    },
  };
}

const TRIGGERS: Record<string, (state: SimState, cfg: SimConfig) => Trigger | null> = {
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
  doctor_note: (state, cfg) => concernTrigger(state, cfg, true, false),
  doctor_promise: (state, cfg) => concernTrigger(state, cfg, true, true),
  delegate_note: (state, cfg) => concernTrigger(state, cfg, false, false),
  delegate_promise: (state, cfg) => concernTrigger(state, cfg, false, true),
};

const CHECKS: Record<PromiseDef["check"], (state: SimState, p: OpenPromise) => boolean> = {
  noiseFixed: (state, p) => {
    const pool = state.happiness.pools.find((x) => x.roomId === p.roomId);
    // Moving everyone out or demolishing the home also ends the complaint.
    return !pool || pool.residents === 0 || pool.factors.noise > -0.5;
  },
  clinicBuilt: (state) => hasClinic(state),
  causeFixed: (state, p) => !p.cause || causeFixed(state, p.cause),
};

// ---- helpers ----

function fill(text: string, state: SimState, notableId: number, roomId?: number, vars: Record<string, string> = {}): string {
  const notable = state.notables.find((n) => n.id === notableId);
  const room = roomId !== undefined ? state.layout.rooms.find((r) => r.id === roomId) : undefined;
  return text
    .replaceAll("{name}", notable?.name ?? "A colonist")
    .replaceAll("{home}", room ? roomDef(room.type).name.toLowerCase() : "homes")
    .replaceAll("{floor}", room?.at.kind === "ring" ? String(room.at.floor) : "1")
    .replace(/\{(cause|what|amount|fix)\}/g, (m, k: string) => vars[k] ?? m)
    // A cause with no fix leaves a gap.
    .replace(/ +"(?=\s|$)/g, '"')
    .replace(/ {2,}/g, " ")
    .trim();
}

/** The words a promise's outcome can use: what it was about. */
const promiseVars = (cause?: string): Record<string, string> => (cause ? { what: causeLabel(cause) } : {});

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

function applyOutcome(state: SimState, cfg: SimConfig, o: Outcome, notableId: number, roomId?: number, vars?: Record<string, string>): void {
  const notable = state.notables.find((n) => n.id === notableId);
  if (notable && o.loyalty) notable.loyalty = Math.max(0, Math.min(100, notable.loyalty + o.loyalty));
  if (o.homeHappiness && roomId !== undefined) bump(state, roomId, o.homeHappiness);
  if (o.allHappiness) bump(state, undefined, o.allHappiness);
  if (o.enact) enact(state, o.enact);
  if (o.message) {
    const kind = (o.loyalty ?? 0) < 0 ? "warn" : "info";
    postMessage(state, cfg, fill(o.message, state, notableId, roomId, vars), kind);
  }
}

// ---- the tick ----

export function stepVisits(state: SimState, cfg: SimConfig): void {
  if (state.tick % raw.checkEveryTicks !== 0) return;
  const office = state.office;

  // Visitors who waited too long leave.
  for (const v of office.waiting.filter((v) => state.tick >= v.leavesTick)) {
    applyOutcome(state, cfg, visitDef(v.kind).ignored, v.notableId, v.roomId, promiseVars(v.cause));
  }
  office.waiting = office.waiting.filter((v) => state.tick < v.leavesTick);

  // Promises come due, or are kept early.
  for (const p of [...office.promises]) {
    const kept = CHECKS[p.check](state, p);
    if (!kept && state.tick < p.dueTick) continue;
    applyOutcome(state, cfg, kept ? p.kept : p.broken, p.notableId, p.roomId, promiseVars(p.cause));
    office.promises = office.promises.filter((x) => x !== p);
  }

  trackCauses(state);

  // New visitors, if there's room to wait.
  const day = state.tick / cfg.ticksPerDay;
  for (const def of visitDefs) {
    if (office.waiting.length >= raw.waitingRoomSize) break;
    if (office.waiting.some((v) => v.kind === def.id)) continue;
    if (def.minDay !== undefined && day < def.minDay) continue;
    const last = office.lastVisit[def.id];
    if (last !== undefined && state.tick - last < def.cooldownDays * cfg.ticksPerDay) continue;
    const trig = TRIGGERS[def.id]?.(state, cfg);
    if (!trig) continue;
    const notableId = messenger(state, trig.role);
    if (notableId === null) continue;

    office.lastVisit[def.id] = state.tick;
    if (trig.cause) office.lastVisit[`cause:${trig.cause}`] = state.tick;
    office.waiting.push({
      id: office.nextVisitId++,
      kind: def.id,
      notableId,
      ...(trig.roomId !== undefined ? { roomId: trig.roomId } : {}),
      ...(trig.cause ? { cause: trig.cause } : {}),
      title: def.title,
      text: fill(def.text, state, notableId, trig.roomId, trig.vars),
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
  state.office.answered = (state.office.answered ?? 0) + 1;
  applyOutcome(state, cfg, choice, visit.notableId, visit.roomId, promiseVars(visit.cause));
  if (choice.promise) {
    state.office.promises.push({
      kind: visit.kind,
      check: choice.promise.check,
      notableId: visit.notableId,
      ...(visit.roomId !== undefined ? { roomId: visit.roomId } : {}),
      ...(visit.cause ? { cause: visit.cause } : {}),
      dueTick: state.tick + choice.promise.days * cfg.ticksPerDay,
      kept: choice.promise.kept,
      broken: choice.promise.broken,
    });
  }
  return { ok: true };
}
