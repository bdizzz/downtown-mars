import { cropsNotGrown, FOOD, variety } from "./food";
import raw from "../../data/visits.json";
import tutorial from "../../data/tutorial.json";
import type { SimConfig } from "./config";
import { DIAGNOSIS, diagnose } from "./diagnosis";
import { siteRefusal } from "./costs";
import { isActive } from "./economy";
import { postMessage } from "./messages";
import { enact } from "./ordinances";
import { holeGates } from "./people";
import { nextRandom } from "./rng";
import { roomDef } from "./rooms";
import type { SimState } from "./state";

// Citizen visits: a notable turns up at the office with a problem the hole
// really has, and the player picks an answer. Promises are checked later and
// either kept or broken. Unanswered visits leave after a while, unhappy.
// The doctor and a residents' delegate (F-018) come about a diagnosis cause
// that has lasted: the first time only to tell you, later for a promise.
// Each speaks in a voice their traits colour (#433), with the numbers and the
// fix in a small aside rather than read out.

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
  check: "noiseFixed" | "clinicBuilt" | "causeFixed" | "varietyUp";
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

/** How a notable talks (#433): their first trait in voices.byTrait picks it; plain if none does. */
export type Voice = "blunt" | "worried" | "cheerful";

export interface VisitDef {
  id: string;
  title: string;
  /** What they say, plainly. */
  text: string;
  /** What they say in each voice; text for a voice left out. */
  voices?: Partial<Record<Voice, string>>;
  /** The numbers and the fix, shown small under what they say. */
  aside?: string;
  minDay?: number;
  /** The rooms that fix what it's about: it waits until one can be built (#434). */
  fixRooms?: string[];
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
  /** The numbers and the fix, shown small under the text (absent in older saves, and for visits with none). */
  aside?: string;
  arrivedTick: number;
  /** When they give up and go; absent for one who waits until answered (the tutorial's greeter). */
  leavesTick?: number;
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

// ---- fair complaints (#434): nothing asked for before the player could have built it ----

const GRACE = raw.grace;
const CAUSE_ROOMS = raw.concerns.fixRooms as Record<string, string[]>;
const GUIDED_STEPS = tutorial.guided.steps.length;

/** Whether the player can build this room here now: unlocked in this hole and, in the guided tutorial, shown by a step so far. */
function canBuild(state: SimState, room: string): boolean {
  if (siteRefusal(room, holeGates(state))) return false;
  const g = state.guide;
  if (!g || g.step >= GUIDED_STEPS) return true;
  return g.unlocked.includes(`room:${room}`) || g.unlocked.includes("room:*");
}

/** Fair to ask about: nothing fixes it with a room (a corridor, a bulkhead), or one of the rooms that do can be built. */
const fair = (state: SimState, rooms?: string[]) => !rooms?.length || rooms.some((r) => canBuild(state, r));

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

const lowerFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
const upperFirst = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** The worst lasting cause for the doctor (health) or the delegate, the first time (note) or again (promise). */
function concernTrigger(state: SimState, cfg: SimConfig, health: boolean, again: boolean): Trigger | null {
  const office = state.office;
  const day = cfg.ticksPerDay;
  const due = Object.entries(office.causeSince ?? {})
    .filter(([key, since]) => {
      if (isHealth(key) !== health || state.tick - since < CONCERNS.holdDays * day) return false;
      if (!fair(state, CAUSE_ROOMS[key])) return false;
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
  const key = `${health ? "health" : "happiness"}:${cause.id}`;
  const say = (CONCERNS.say as Record<string, string>)[key] ?? lowerFirst(cause.text);
  return {
    role: health ? "doctor" : "organizer",
    cause: key,
    vars: {
      say,
      Say: upperFirst(say),
      cause: cause.text,
      amount: health ? `${tenth(-cause.amount)} health a month` : `${tenth(-cause.amount)} points of happiness`,
      fix: cause.fix ?? "",
    },
  };
}

// ---- meals: food variety stuck at poor, or at average (#375) ----

/** The rating each meal visit is about (QUALITIES' index): its promise is kept once variety is past it. */
const MEAL_VISITS: Record<string, number> = { poor_meals: 0, average_meals: 1 };

/** Nearly every meal eaten over the last month was of this quality, and people have been eating. */
function mealTrigger(state: SimState, kind: string): Trigger | null {
  const level = MEAL_VISITS[kind]!;
  const v = variety(state);
  if (!v || v.rating !== level || (v.shares[level] ?? 0) < FOOD.visits.onlyShare) return null;
  if (v.perMonth < FOOD.visits.minMealsPerPerson * state.population.count) return null;
  if (state.office.promises.some((p) => p.kind === kind)) return null;
  const crops = cropsNotGrown(state);
  return { vars: { crops: crops.length ? orList(crops.slice(0, 3)) : "more of what we have" } };
}

/** "a, b or c". */
const orList = (items: string[]) => (items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} or ${items.at(-1)}`);

const TRIGGERS: Record<string, (state: SimState, cfg: SimConfig) => Trigger | null> = {
  poor_meals: (state) => mealTrigger(state, "poor_meals"),
  average_meals: (state) => mealTrigger(state, "average_meals"),
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
  varietyUp: (state, p) => (variety(state)?.rating ?? -1) > (MEAL_VISITS[p.kind] ?? Infinity),
};

// ---- helpers ----

function fill(text: string, state: SimState, notableId: number, roomId?: number, vars: Record<string, string> = {}): string {
  const notable = state.notables.find((n) => n.id === notableId);
  const room = roomId !== undefined ? state.layout.rooms.find((r) => r.id === roomId) : undefined;
  return text
    .replaceAll("{name}", notable?.name ?? "A colonist")
    .replaceAll("{home}", room ? roomDef(room.type).name.toLowerCase() : "homes")
    .replaceAll("{floor}", room?.at.kind === "ring" ? String(room.at.floor) : "1")
    .replace(/\{(cause|what|amount|fix|crops|say|Say)\}/g, (m, k: string) => vars[k] ?? m)
    // A cause with no fix leaves a gap.
    .replace(/ +"(?=\s|$)/g, '"')
    .replace(/ {2,}/g, " ")
    .trim();
}

const VOICE_BY_TRAIT = raw.voices.byTrait as Record<string, Voice>;

/** The voice a notable speaks in: their first trait that has one, else plain (undefined). */
export function voiceOf(traits: readonly string[] | undefined): Voice | undefined {
  for (const t of traits ?? []) if (VOICE_BY_TRAIT[t]) return VOICE_BY_TRAIT[t];
  return undefined;
}

/** What a visit's notable says, in their voice, and its aside, filled in. */
function spoken(def: VisitDef, state: SimState, notableId: number, roomId?: number, vars?: Record<string, string>): { text: string; aside?: string } {
  const voice = voiceOf(state.notables.find((n) => n.id === notableId)?.traits);
  const text = fill((voice && def.voices?.[voice]) || def.text, state, notableId, roomId, vars);
  const aside = def.aside ? fill(def.aside, state, notableId, roomId, vars) : "";
  return aside ? { text, aside } : { text };
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
  for (const v of office.waiting.filter((v) => v.leavesTick !== undefined && state.tick >= v.leavesTick)) {
    applyOutcome(state, cfg, visitDef(v.kind).ignored, v.notableId, v.roomId, promiseVars(v.cause));
  }
  office.waiting = office.waiting.filter((v) => v.leavesTick === undefined || state.tick < v.leavesTick);

  // Promises come due, or are kept early.
  for (const p of [...office.promises]) {
    const kept = CHECKS[p.check](state, p);
    if (!kept && state.tick < p.dueTick) continue;
    applyOutcome(state, cfg, kept ? p.kept : p.broken, p.notableId, p.roomId, promiseVars(p.cause));
    office.promises = office.promises.filter((x) => x !== p);
  }

  trackCauses(state);

  // New visitors, if there's room to wait: none in the first months after landing, and one at a time for a while after (#434).
  const day = state.tick / cfg.ticksPerDay;
  const landed = (state.tick - state.foundedTick) / cfg.ticksPerDay;
  if (landed < GRACE.afterLandingDays) return;
  const seats = landed < GRACE.earlyDays ? GRACE.earlyAtOnce : raw.waitingRoomSize;
  for (const def of visitDefs) {
    if (office.waiting.length >= seats) break;
    if (office.waiting.some((v) => v.kind === def.id)) continue;
    if (def.minDay !== undefined && day < def.minDay) continue;
    if (!fair(state, def.fixRooms)) continue;
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
      ...spoken(def, state, notableId, trig.roomId, trig.vars),
      arrivedTick: state.tick,
      ...(def.patienceDays > 0 ? { leavesTick: state.tick + def.patienceDays * cfg.ticksPerDay } : {}),
    });
    const name = state.notables.find((n) => n.id === notableId)?.name ?? "Someone";
    postMessage(state, cfg, `${name} is waiting at the office: ${def.title.toLowerCase()}.`, "info");
  }
}

/** The tutorial's greeter (T-080): a visit kind with no trigger, sent for by the greet command. */
export const GREETER = "greeter";

/**
 * Someone drops by the office to say hello, so the tutorial's office step always has a visitor
 * (T-080). Only when nobody's waiting: anyone at all will do for the step. A notable other than the
 * deputy, who's the one talking you through the tutorial. They wait until answered.
 */
export function greet(state: SimState, cfg: SimConfig): { ok: true } {
  const office = state.office;
  if (office.waiting.length) return { ok: true };
  const def = visitDef(GREETER);
  const others = state.notables.slice(1);
  const from = others.length ? others : state.notables;
  if (!from.length) return { ok: true };
  const notableId = from[Math.floor(nextRandom(state) * from.length)]!.id;
  office.lastVisit[def.id] = state.tick;
  office.waiting.push({
    id: office.nextVisitId++,
    kind: def.id,
    notableId,
    title: def.title,
    ...spoken(def, state, notableId),
    arrivedTick: state.tick,
  });
  const name = state.notables.find((n) => n.id === notableId)?.name ?? "Someone";
  postMessage(state, cfg, `${name} is waiting at the office: ${def.title.toLowerCase()}.`, "info");
  return { ok: true };
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
