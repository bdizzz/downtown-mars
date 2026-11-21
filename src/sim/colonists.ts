import notableData from "../../data/notables.json";
import type { SimConfig } from "./config";
import { isActive } from "./economy";
import { packColumn, unpackColumn, type Column } from "./pack";
import { distancesFrom, pathsFor, STEP_M } from "./paths";
import type { Layout } from "./placement";
import peopleData from "../../data/people.json";
import { hash01, type Stage } from "./people";
import { roomDef } from "./rooms";
import type { SimState } from "./state";

// Individual colonists (#521, docs/PLAN-PEOPLE.md): every person in a hole,
// one by one. They're the only record of who lives here (the cohorts went in
// #529): each keeps who they are (an id for life, a name, two traits, when
// they were born, when they next move on), their family (a household, a
// partner, two parents), a job, a bed, their walks to work and to the galley,
// and their own needs.
//
// People are columns, not objects: one array per field, indexed by person.
// In memory they're plain number arrays (so a state copies and clones like
// any other); in a save each saved column is packed into a typed array.
//
// Homes and jobs assign themselves (decided Nov 18): a job first, then the
// free bed worth most (a nice home, a short walk to work, kin under the same
// roof); nobody is turned out of a bed; and two people swap beds only after
// both would have gained from it for a few days in a row.
//
// Households (#527): arrivals come alone or as couples; singles sharing a
// home pair up now and then; children are born into a couple's household and
// take their last name. Kin grieve hard and briefly when one of them dies,
// and a household that leaves for another hole leaves together.
//
// Routes are distances, never walks: one search per room (cached until the
// layout changes), and each person reads their two distances from those.
// Deterministic throughout: rolls come from hash01 of the hole and the
// person's id, and ties break by id.

// Read straight from the data, not through people.ts, which imports this file.
const P = peopleData as unknown as Pick<typeof import("./people").people, "colonists" | "child" | "adult" | "elder">;
const C = P.colonists;

/** Life stages as the stage column stores them. */
export const STAGES: readonly Stage[] = ["child", "adult", "elder"];
const stageNo = (s: Stage) => STAGES.indexOf(s);
const ADULT = 1;

/** Ids are unique across the network: the hole they first appeared in, then a count. */
const ID_SPAN = 1_000_000;

/** What's saved for each person, with the type it packs into. Everything else is worked out again. */
const SAVED = {
  id: Int32Array,
  stage: Uint8Array,
  born: Int32Array,
  until: Int32Array,
  gen: Uint8Array,
  first: Uint16Array,
  last: Uint16Array,
  traitA: Uint8Array,
  traitB: Uint8Array,
  household: Int32Array,
  partner: Int32Array,
  parentA: Int32Array,
  parentB: Int32Array,
  mourned: Int32Array,
  home: Int32Array,
  job: Int32Array,
  gainDays: Uint8Array,
  gainWith: Int32Array,
} as const;
type SavedKey = keyof typeof SAVED;

/** Worked out from the layout and the saved columns; never saved. */
const DERIVED = ["food", "workM", "foodM", "comfort", "fed", "health", "happiness"] as const;
type DerivedKey = (typeof DERIVED)[number];

export type Colonists = Record<SavedKey | DerivedKey, number[]> & {
  /** The next number to hand out in this hole (ids are holeId × 1,000,000 + this). */
  nextSeq: number;
  /** Bumps whenever someone arrives, leaves or moves to another stage, so counts can be cached. */
  rev?: number;
  /** Set when a home, a job or the layout changed since the routes were last worked out. */
  routesStale?: boolean;
  /** The layout version the routes were worked out for. */
  routesAt?: number;
  /** The tick beds last got closer to work (once a day). */
  improvedAt?: number;
};

/** Who someone is, carried with them when they leave for another hole. An id below 0: someone not made yet (an old save's traveller), made on arrival. */
export interface Member {
  id: number;
  stage: number;
  born: number;
  until: number;
  gen: number;
  first: number;
  last: number;
  traitA: number;
  traitB: number;
  household: number;
  partner: number;
  parentA: number;
  parentB: number;
  mourned: number;
}

const MEMBER_KEYS = ["id", "stage", "born", "until", "gen", "first", "last", "traitA", "traitB", "household", "partner", "parentA", "parentB", "mourned"] as const;

export const NONE = -1;

export function createColonists(): Colonists {
  const c = { nextSeq: 1, rev: 0 } as Colonists;
  for (const k of Object.keys(SAVED) as SavedKey[]) c[k] = [];
  for (const k of DERIVED) c[k] = [];
  return c;
}

/** The hole's people (an empty list for a hole that has none yet). */
export function colonistsOf(state: SimState): Colonists {
  return (state.colonists ??= createColonists());
}

/** How many people there are. */
export function headCount(state: SimState): number {
  return state.colonists?.id.length ?? 0;
}

const ALL_KEYS = [...(Object.keys(SAVED) as SavedKey[]), ...DERIVED];

/** Something about who's here changed: counts are worked out again, and so are the routes. */
function bump(c: Colonists): void {
  c.rev = (c.rev ?? 0) + 1;
  c.routesStale = true;
}

function addRow(c: Colonists, m: Member): void {
  const row: Record<SavedKey | DerivedKey, number> = {
    ...m,
    home: NONE,
    job: NONE,
    gainDays: 0,
    gainWith: NONE,
    food: NONE,
    workM: 0,
    foodM: 0,
    comfort: 0,
    fed: 0,
    health: 0,
    happiness: 50,
  };
  for (const k of ALL_KEYS) c[k].push(row[k]);
  bump(c);
}

/** Keep only the rows marked to stay, in order. */
function compact(c: Colonists, keep: boolean[]): void {
  for (const k of ALL_KEYS) {
    const col = c[k];
    let j = 0;
    for (let i = 0; i < col.length; i++) if (keep[i]) col[j++] = col[i]!;
    col.length = j;
  }
  bump(c);
}

/** Who person i is, as they'd travel. */
export function memberAt(c: Colonists, i: number): Member {
  const m = {} as Member;
  for (const k of MEMBER_KEYS) m[k] = c[k][i]!;
  return m;
}

const names = notableData as { firstNames: string[]; lastNames: string[]; traits: string[] };

/** A new person here: an id, a name and two traits rolled from the hole and the id; their family and ages as given. */
export function newPerson(
  state: SimState,
  o: { stage: Stage; born: number; until: number; gen?: number; last?: number; household?: number; parentA?: number; parentB?: number },
): Member {
  const c = colonistsOf(state);
  const id = state.holeId * ID_SPAN + c.nextSeq++;
  const pick = (n: number, salt: number) => Math.floor(hash01(state.holeId, id, salt) * n) % n;
  const traitA = pick(names.traits.length, 3);
  const traitB = (traitA + 1 + pick(names.traits.length - 1, 4)) % names.traits.length;
  return {
    id,
    stage: stageNo(o.stage),
    born: o.born,
    until: o.until,
    gen: o.gen ?? 1,
    first: pick(names.firstNames.length, 1),
    last: o.last ?? pick(names.lastNames.length, 2),
    traitA,
    traitB,
    household: o.household ?? id,
    partner: NONE,
    parentA: o.parentA ?? NONE,
    parentB: o.parentB ?? NONE,
    mourned: NONE,
  };
}

/** Ticks from now until an adult retires, or an elder passes away, rolled from their id. */
export function stageSpan(state: SimState, cfg: SimConfig, id: number, stage: Stage): number {
  const span = stage === "adult" ? P.adult.workSpanDays : P.elder.days;
  return Math.round((span[0] + (span[1] - span[0]) * hash01(state.holeId, id, stage === "adult" ? 11 : 17)) * cfg.ticksPerDay);
}

/** Days old, rolled from the id, for someone arriving as an adult or an elder. */
function arrivalAge(state: SimState, cfg: SimConfig, id: number, stage: Stage): number {
  const span = stage === "elder" ? C.elderAgeDays : C.arrivalAgeDays;
  return Math.round((span[0] + (span[1] - span[0]) * hash01(state.holeId, id, 5)) * cfg.ticksPerDay);
}

/**
 * New working adults (from Earth, an event, a new game): each with their own
 * working span, and some arriving as couples (`couples` of them paired with
 * the one before, in one household).
 */
export function arriveAdults(state: SimState, cfg: SimConfig, n: number): void {
  const c = colonistsOf(state);
  let single: Member | null = null;
  for (let k = 0; k < n; k++) {
    const m = newPerson(state, { stage: "adult", born: 0, until: 0 });
    m.born = state.tick - arrivalAge(state, cfg, m.id, "adult");
    m.until = state.tick + stageSpan(state, cfg, m.id, "adult");
    if (single && hash01(state.holeId, m.id, 21) < C.family.coupleShare) {
      m.household = single.household;
      m.partner = single.id;
      c.partner[c.id.length - 1] = m.id;
      single = null;
    } else single = m;
    addRow(c, m);
  }
}

/** n single people at a stage (tests and the console): their next stage at `until`, or rolled as usual. */
export function addAtStage(state: SimState, cfg: SimConfig, stage: Stage, n: number, until?: number, gen = 1): number[] {
  const c = colonistsOf(state);
  const ids: number[] = [];
  for (let k = 0; k < n; k++) {
    const m = newPerson(state, { stage, born: 0, until: 0, gen });
    m.born = stage === "child" ? state.tick : state.tick - arrivalAge(state, cfg, m.id, stage);
    m.until = until ?? (stage === "child" ? state.tick + P.child.days * cfg.ticksPerDay : state.tick + stageSpan(state, cfg, m.id, stage));
    addRow(c, m);
    ids.push(m.id);
  }
  return ids;
}

/** People arriving from another hole, as themselves (an old save's travellers, with no id yet, are made now). */
export function welcomeMembers(state: SimState, cfg: SimConfig, members: Member[]): void {
  const c = colonistsOf(state);
  for (const m of members) {
    if (m.id >= 0) {
      addRow(c, m);
      continue;
    }
    const stage = STAGES[m.stage] ?? "adult";
    const made = newPerson(state, { stage, born: 0, until: m.until, gen: m.gen });
    made.born = stage === "child" ? m.born : state.tick - arrivalAge(state, cfg, made.id, stage);
    addRow(c, made);
  }
}

/** Person rows by id (cached until someone arrives or leaves). */
const indexes = new WeakMap<Colonists, { rev: number; at: Map<number, number> }>();
export function rowOf(c: Colonists, id: number): number {
  if (id < 0) return NONE;
  let hit = indexes.get(c);
  if (!hit || hit.rev !== (c.rev ?? 0) || hit.at.size !== c.id.length) {
    hit = { rev: c.rev ?? 0, at: new Map(c.id.map((x, i) => [x, i])) };
    indexes.set(c, hit);
  }
  return hit.at.get(id) ?? NONE;
}

/**
 * Take people out of the hole (leaving, passed away): who they are goes with
 * them. Anyone left behind whose partner went is single again.
 */
export function removeRows(state: SimState, rows: Iterable<number>): Member[] {
  const c = state.colonists;
  if (!c) return [];
  const gone = new Set(rows);
  if (!gone.size) return [];
  const out = [...gone].sort((a, b) => a - b).map((i) => memberAt(c, i));
  const ids = new Set(out.map((m) => m.id));
  const keep: boolean[] = c.id.map((_, i) => !gone.has(i));
  for (let i = 0; i < c.id.length; i++) if (keep[i] && ids.has(c.partner[i]!)) c.partner[i] = NONE;
  compact(c, keep);
  return out;
}

/** Are rows i and j family: the same household, partners, or parent and child? */
export function isKin(c: Colonists, i: number, j: number): boolean {
  if (i === j) return false;
  const a = c.id[i]!;
  const b = c.id[j]!;
  return (
    c.household[i] === c.household[j] ||
    c.partner[i] === b ||
    c.parentA[j] === a ||
    c.parentB[j] === a ||
    c.parentA[i] === b ||
    c.parentB[i] === b
  );
}

/** Everyone in the hole who is family to row i, by row. */
export function kinOf(c: Colonists, i: number): number[] {
  const out: number[] = [];
  for (let j = 0; j < c.id.length; j++) if (isKin(c, i, j)) out.push(j);
  return out;
}

/** Someone has died: their family here starts to grieve. */
function mourn(c: Colonists, dead: number, tick: number): void {
  for (const j of kinOf(c, dead)) c.mourned[j] = tick;
}

/** Comfort person i loses to grief for kin: hard at first, fading over `griefDays`. */
export function kinGriefComfort(c: Colonists, i: number, tick: number, cfg: SimConfig): number {
  const at = c.mourned[i]!;
  if (at < 0) return 0;
  const days = (tick - at) / cfg.ticksPerDay;
  if (days >= C.family.griefDays) return 0;
  return C.family.griefComfort * (1 - days / C.family.griefDays);
}

/** People by stage (cached until someone arrives, leaves or moves on). */
const stageCache = new WeakMap<Colonists, { rev: number; n: number; counts: Record<Stage, number>; weight: number; due: number }>();
function tally(c: Colonists) {
  let hit = stageCache.get(c);
  if (!hit || hit.rev !== (c.rev ?? 0) || hit.n !== c.id.length) {
    const counts: Record<Stage, number> = { child: 0, adult: 0, elder: 0 };
    let due = Infinity;
    for (let i = 0; i < c.id.length; i++) {
      counts[STAGES[c.stage[i]!]!] += 1;
      if (c.until[i]! < due) due = c.until[i]!;
    }
    const weight = counts.child * P.child.needsFactor + counts.adult + counts.elder * P.elder.needsFactor;
    hit = { rev: c.rev ?? 0, n: c.id.length, counts, weight, due };
    stageCache.set(c, hit);
  }
  return hit;
}

/** People by stage. */
export function colonistStages(state: SimState): Record<Stage, number> {
  const c = state.colonists;
  return c ? { ...tally(c).counts } : { child: 0, adult: 0, elder: 0 };
}

/** People weighted by what they eat, drink and breathe. */
export function colonistWeight(state: SimState): number {
  return state.colonists ? tally(state.colonists).weight : 0;
}

/** What happened as people moved on to their next stage. */
export interface Aged {
  grown: number;
  retired: number;
  /** Who passed away, by name. */
  passed: string[];
}

/**
 * Everyone whose time has come moves on: children grow up, adults retire into
 * elders, elders pass away (and their kin grieve).
 */
export function ageColonists(state: SimState, cfg: SimConfig): Aged {
  const out: Aged = { grown: 0, retired: 0, passed: [] };
  const c = state.colonists;
  if (!c || tally(c).due > state.tick) return out;
  const dead: number[] = [];
  for (let i = 0; i < c.id.length; i++) {
    if (c.until[i]! > state.tick) continue;
    const stage = STAGES[c.stage[i]!];
    if (stage === "child") {
      c.stage[i] = ADULT;
      c.until[i] = state.tick + stageSpan(state, cfg, c.id[i]!, "adult");
      out.grown++;
    } else if (stage === "adult") {
      c.stage[i] = stageNo("elder");
      c.until[i] = state.tick + stageSpan(state, cfg, c.id[i]!, "elder");
      if (c.job[i] !== NONE) c.job[i] = NONE;
      out.retired++;
    } else {
      dead.push(i);
      out.passed.push(nameOf(c, i));
    }
  }
  for (const i of dead) mourn(c, i, state.tick);
  removeRows(state, dead);
  bump(c);
  return out;
}

// --- Families (#527) ---------------------------------------------------------

/** Couples who could have a child: two adults who are each other's partners (row of each, lower id first). */
export function couples(c: Colonists): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < c.id.length; i++) {
    if (c.stage[i] !== ADULT || c.partner[i] === NONE || c.partner[i]! < c.id[i]!) continue;
    const j = rowOf(c, c.partner[i]!);
    if (j !== NONE && c.stage[j] === ADULT) out.push([i, j]);
  }
  return out;
}

/**
 * A child is born to one of the couples: happier ones, and those with a free
 * bed at home, likelier. They join their parents' household, with the first
 * parent's last name, a generation after the later of them. Returns their row.
 */
export function bornTo(state: SimState, cfg: SimConfig, roll: number): number {
  const c = colonistsOf(state);
  const pairs = couples(c);
  if (!pairs.length) return NONE;
  const used = new Map<number, number>();
  for (const h of c.home) used.set(h, (used.get(h) ?? 0) + 1);
  const room = (h: number) => {
    if (h === NONE) return 0;
    const r = state.layout.rooms.find((x) => x.id === h);
    return r ? Math.max(0, (roomDef(r.type).houses ?? 0) - (used.get(h) ?? 0)) : 0;
  };
  const weights = pairs.map(([a, b]) => Math.max(1, c.happiness[a]! + c.happiness[b]!) * (1 + Math.min(1, room(c.home[a]!)) * C.family.roomyBirthWeight));
  let x = roll * weights.reduce((s, w) => s + w, 0);
  let k = 0;
  while (k < pairs.length - 1 && (x -= weights[k]!) > 0) k++;
  const [a, b] = pairs[k]!;
  const today = Math.floor(state.tick / cfg.ticksPerDay);
  const baby = newPerson(state, {
    stage: "child",
    born: state.tick,
    // Everyone born the same day grows up together.
    until: today * cfg.ticksPerDay + P.child.days * cfg.ticksPerDay,
    gen: 1 + Math.max(c.gen[a]!, c.gen[b]!),
    last: c.last[a]!,
    household: c.household[a]!,
    parentA: c.id[a]!,
    parentB: c.id[b]!,
  });
  addRow(c, baby);
  return c.id.length - 1;
}

/**
 * Once a day, two single adults sharing a home may pair up (`pairChancePerDay`):
 * they make a household of their own, and their children come with them.
 */
function pairUp(state: SimState, cfg: SimConfig, c: Colonists): void {
  const day = Math.floor(state.tick / cfg.ticksPerDay);
  const singles = new Map<number, number[]>();
  for (let i = 0; i < c.id.length; i++) {
    if (c.stage[i] !== ADULT || c.partner[i] !== NONE || c.home[i] === NONE) continue;
    const list = singles.get(c.home[i]!);
    if (list) list.push(i);
    else singles.set(c.home[i]!, [i]);
  }
  for (const list of singles.values()) {
    for (let k = 0; k + 1 < list.length; k += 2) {
      const a = list[k]!;
      const b = list[k + 1]!;
      // Not with a parent, child or sibling.
      if (isKin(c, a, b) || (c.parentA[a] !== NONE && (c.parentA[a] === c.parentA[b] || c.parentA[a] === c.parentB[b]))) continue;
      if (hash01(state.holeId, c.id[a]!, c.id[b]!, day) >= C.family.pairChancePerDay) continue;
      const hh = Math.min(c.id[a]!, c.id[b]!);
      const ids = new Set([c.id[a]!, c.id[b]!]);
      c.partner[a] = c.id[b]!;
      c.partner[b] = c.id[a]!;
      c.household[a] = c.household[b] = hh;
      for (let j = 0; j < c.id.length; j++) {
        if (c.stage[j] === 0 && (ids.has(c.parentA[j]!) || ids.has(c.parentB[j]!))) c.household[j] = hh;
      }
    }
  }
}

/**
 * Households leave together (#527). Takes whole households, in the order of
 * `order` (rows), until `max` people have gone; one bigger than what's left
 * of `max` waits, unless nobody has gone yet and it fits in `firstMax`.
 */
export function takeHouseholds(state: SimState, order: number[], max: number, firstMax = max): Member[] {
  const c = state.colonists;
  if (!c || max <= 0) return [];
  const members = new Map<number, number[]>();
  for (let i = 0; i < c.id.length; i++) {
    const list = members.get(c.household[i]!);
    if (list) list.push(i);
    else members.set(c.household[i]!, [i]);
  }
  const take: number[] = [];
  const seen = new Set<number>();
  for (const i of order) {
    const hh = c.household[i]!;
    if (seen.has(hh)) continue;
    seen.add(hh);
    const rows = members.get(hh)!;
    if (take.length + rows.length > max && !(take.length === 0 && rows.length <= firstMax)) continue;
    take.push(...rows);
    if (take.length >= max) break;
  }
  return removeRows(state, take);
}

/** The adults, unhappiest first (ties: the older id): who leaves an unhappy hole. */
export function unhappiestAdults(c: Colonists): number[] {
  const rows: number[] = [];
  for (let i = 0; i < c.id.length; i++) if (c.stage[i] === ADULT) rows.push(i);
  return rows.sort((a, b) => c.happiness[a]! - c.happiness[b]! || c.id[a]! - c.id[b]!);
}

/** Volunteers for a new hole: n adults, singles first, then the youngest (the longest working span left). */
export function takeVolunteers(state: SimState, n: number): Member[] {
  const c = state.colonists;
  if (!c || n <= 0) return [];
  const rows: number[] = [];
  for (let i = 0; i < c.id.length; i++) if (c.stage[i] === ADULT) rows.push(i);
  rows.sort((a, b) => Number(c.partner[a] !== NONE) - Number(c.partner[b] !== NONE) || c.until[b]! - c.until[a]! || c.id[a]! - c.id[b]!);
  const out = removeRows(state, rows.slice(0, n));
  // They set off as a household of their own, each.
  for (const m of out) {
    m.household = m.id;
    m.partner = NONE;
  }
  return out;
}

/** For tests and the console: exactly n adults. Those already here stay, the newest going first if there are too many; anyone else stays. */
export function replaceAdults(state: SimState, cfg: SimConfig, n: number): void {
  const c = colonistsOf(state);
  const rows: number[] = [];
  for (let i = 0; i < c.id.length; i++) if (c.stage[i] === ADULT) rows.push(i);
  if (rows.length > n) removeRows(state, rows.slice(n));
  else arriveAdults(state, cfg, n - rows.length);
}

/** A cohort as saves before v27 kept them (#529): a life stage, a head count and when they move on. */
export interface LegacyCohort {
  stage: Stage;
  count: number;
  until: number;
  gen?: number;
  id?: number;
  members?: Partial<Member>[];
}

/** Old saves (before #523): people made from the hole's cohorts, each with their cohort's stage and timing, single. */
export function colonistsFromCohorts(state: SimState, cfg: SimConfig, cohorts: LegacyCohort[]): Colonists {
  state.colonists = createColonists();
  for (const k of cohorts) {
    for (let n = 0; n < k.count; n++) {
      const m = newPerson(state, { stage: k.stage, born: 0, until: k.until, gen: k.gen ?? 1 });
      m.born = k.stage === "child" ? k.until - P.child.days * cfg.ticksPerDay : state.tick - arrivalAge(state, cfg, m.id, k.stage);
      addRow(state.colonists, m);
    }
  }
  return state.colonists;
}

/** Travellers in an old save's convoy or migration: who they are if they carried it, else people to be made on arrival. */
export function membersFromCohorts(cohorts: LegacyCohort[]): Member[] {
  const out: Member[] = [];
  for (const k of cohorts) {
    for (let n = 0; n < k.count; n++) {
      const m = k.members?.[n];
      out.push({
        id: m?.id ?? NONE,
        stage: m?.stage ?? stageNo(k.stage),
        born: m?.born ?? 0,
        until: m?.until ?? k.until,
        gen: m?.gen ?? k.gen ?? 1,
        first: m?.first ?? 0,
        last: m?.last ?? 0,
        traitA: m?.traitA ?? 0,
        traitB: m?.traitB ?? 1,
        household: m?.household ?? m?.id ?? NONE,
        partner: NONE,
        parentA: NONE,
        parentB: NONE,
        mourned: NONE,
      });
    }
  }
  return out;
}

/** The full name of person i (from the notables' name pools). */
export function nameOf(c: Colonists, i: number): string {
  return `${names.firstNames[c.first[i]!]} ${names.lastNames[c.last[i]!]}`;
}

/** Two traits of person i, by name. */
export function traitsOf(c: Colonists, i: number): string[] {
  return [names.traits[c.traitA[i]!]!, names.traits[c.traitB[i]!]!];
}

// --- Walking distances ----------------------------------------------------

/** Each room's metres on foot to every room it can reach, kept until the layout changes. */
const routes = new WeakMap<
  Layout,
  { version: number; from: Map<number, Map<number, number>>; homes: Map<number, number[]>; food: Map<number, number>; doors: Map<number, number | null> }
>();

function routeCache(layout: Layout) {
  let hit = routes.get(layout);
  if (!hit || hit.version !== layout.version) {
    hit = { version: layout.version, from: new Map(), homes: new Map(), food: new Map(), doors: doorsOf(layout) };
    routes.set(layout, hit);
  }
  return hit;
}

/** Where each room is walked to from: itself, or for one on the surface (the landing pod) the entrance. */
function doorsOf(layout: Layout): Map<number, number | null> {
  const entrance = layout.rooms.find((r) => r.at.kind === "ring" && roomDef(r.type).surfaceLink && !roomDef(r.type).cargoShaft)?.id ?? null;
  return new Map(layout.rooms.map((r) => [r.id, r.at.kind === "surface" ? entrance : r.id]));
}

function doorOf(layout: Layout, roomId: number): number | null {
  return routeCache(layout).doors.get(roomId) ?? null;
}

/** Metres on foot from a room to every room it can reach, however far. One search per room, never per person. */
export function routesFrom(layout: Layout, roomId: number): Map<number, number> {
  const hit = routeCache(layout);
  let d = hit.from.get(roomId);
  if (!d) {
    const door = doorOf(layout, roomId);
    d = door === null ? new Map() : distancesFrom(pathsFor(layout), door, "walk");
    hit.from.set(roomId, d);
  }
  return d;
}

/** Metres on foot between two rooms (Infinity if there's no way). */
export function walkM(layout: Layout, from: number, to: number): number {
  if (from === to) return 0;
  const target = doorOf(layout, to);
  if (target === null) return Infinity;
  const d = routesFrom(layout, from).get(target);
  return d === undefined ? Infinity : d;
}

/** The working homes nearest a room, nearest first (at most `nearestHomes`): where a swap looks. */
function nearestHomes(layout: Layout, roomId: number): number[] {
  const hit = routeCache(layout);
  let list = hit.homes.get(roomId);
  if (!list) {
    list = layout.rooms
      .filter((r) => isActive(r) && (roomDef(r.type).houses ?? 0) > 0)
      .map((r) => ({ id: r.id, m: walkM(layout, roomId, r.id) }))
      .filter((h) => Number.isFinite(h.m))
      .sort((a, b) => a.m - b.m || a.id - b.id)
      .slice(0, C.assign.nearestHomes)
      .map((h) => h.id);
    hit.homes.set(roomId, list);
  }
  return list;
}

/** The galley or canteen nearest a home on foot, if any. */
function nearestFood(layout: Layout, homeId: number): number {
  const hit = routeCache(layout);
  let food = hit.food.get(homeId);
  if (food === undefined) {
    food = NONE;
    let best = Infinity;
    for (const r of layout.rooms) {
      if (!isActive(r) || !roomDef(r.type).serves) continue;
      const m = walkM(layout, homeId, r.id);
      if (m < best || (m === best && r.id < food)) {
        best = m;
        food = r.id;
      }
    }
    hit.food.set(homeId, food);
  }
  return food;
}

// --- Jobs and homes (#524) --------------------------------------------------

/**
 * Jobs follow the staffing (economy.ts decides how many each room gets, by
 * priority): those already working somewhere stay; a room that needs fewer
 * lets go of whoever lives furthest; a room that needs more takes the
 * unemployed adults who live nearest.
 */
function assignJobs(state: SimState, c: Colonists): void {
  const layout = state.layout;
  const want = new Map<number, number>();
  for (const [id, st] of Object.entries(state.roomStatus)) if (st.staff > 0) want.set(Number(id), st.staff);
  const holders = new Map<number, number[]>();
  const adult = ADULT;
  for (let i = 0; i < c.id.length; i++) {
    const j = c.job[i]!;
    if (j === NONE) continue;
    if (c.stage[i] !== adult || !want.has(j)) {
      c.job[i] = NONE;
      c.routesStale = true;
      continue;
    }
    const list = holders.get(j);
    if (list) list.push(i);
    else holders.set(j, [i]);
  }
  for (const [room, list] of holders) {
    const over = list.length - want.get(room)!;
    if (over <= 0) continue;
    const far = list
      .map((i) => ({ i, m: c.home[i] === NONE ? Infinity : walkM(layout, room, c.home[i]!) }))
      .sort((a, b) => b.m - a.m || c.id[b.i]! - c.id[a.i]!);
    for (const { i } of far.slice(0, over)) c.job[i] = NONE;
    holders.set(room, list.filter((i) => c.job[i] === room));
    c.routesStale = true;
  }
  let free: number[] = [];
  for (let i = 0; i < c.id.length; i++) if (c.stage[i] === adult && c.job[i] === NONE) free.push(i);
  if (!free.length) return;
  const rooms = [...want.keys()].sort((a, b) => a - b);
  for (const room of rooms) {
    const vacancies = want.get(room)! - (holders.get(room)?.length ?? 0);
    if (vacancies <= 0 || !free.length) continue;
    const d = routesFrom(layout, room);
    const door = (h: number) => doorOf(layout, h);
    const dist = (i: number) => {
      const h = c.home[i]!;
      if (h === NONE) return Infinity;
      if (h === room) return 0;
      const t = door(h);
      return t === null ? Infinity : (d.get(t) ?? Infinity);
    };
    const picked = free
      .map((i) => ({ i, m: dist(i) }))
      .sort((a, b) => a.m - b.m || c.id[a.i]! - c.id[b.i]!)
      .slice(0, vacancies);
    for (const { i } of picked) c.job[i] = room;
    const taken = new Set(picked.map((p) => p.i));
    free = free.filter((i) => !taken.has(i));
    c.routesStale = true;
  }
}

/** Working homes, with their beds. */
function homeBeds(state: SimState): Map<number, number> {
  const beds = new Map<number, number>();
  for (const r of state.layout.rooms) {
    const houses = roomDef(r.type).houses ?? 0;
    if (houses > 0 && isActive(r)) beds.set(r.id, houses);
  }
  return beds;
}

/** How nice each home is, in happiness points, as of the last happiness update: its own target, before its residents' walks (0 for a home that's new since). */
function niceness(state: SimState): Map<number, number> {
  return new Map(state.happiness.pools.map((p) => [p.roomId, p.base ?? p.target]));
}

/** How many of each household sleep in each home: kin under one roof (#527). */
type KinBeds = Map<number, Map<number, number>>;

function kinBeds(c: Colonists): KinBeds {
  const out: KinBeds = new Map();
  for (let i = 0; i < c.id.length; i++) {
    const h = c.home[i]!;
    if (h === NONE) continue;
    const hh = c.household[i]!;
    let at = out.get(hh);
    if (!at) out.set(hh, (at = new Map()));
    at.set(h, (at.get(h) ?? 0) + 1);
  }
  return out;
}

function moveKin(kin: KinBeds, hh: number, from: number, to: number): void {
  let at = kin.get(hh);
  if (!at) kin.set(hh, (at = new Map()));
  if (from !== NONE) at.set(from, (at.get(from) ?? 1) - 1);
  if (to !== NONE) at.set(to, (at.get(to) ?? 0) + 1);
}

/**
 * What a bed is worth to person i, in happiness points: how nice the home is,
 * less their walk to work at `metresPerPoint` (a worker will walk that much
 * further for each point nicer), and `kinPoints` more where some of their
 * household sleeps. Without a job, the walk doesn't count.
 */
function bedScore(layout: Layout, c: Colonists, i: number, home: number, nice: Map<number, number>, kin: KinBeds): number {
  const j = c.job[i]!;
  const walk = j === NONE ? 0 : walkM(layout, j, home);
  const others = (kin.get(c.household[i]!)?.get(home) ?? 0) - (c.home[i] === home ? 1 : 0);
  return (nice.get(home) ?? 0) - walk / C.assign.metresPerPoint + (others > 0 ? C.family.kinPoints : 0);
}

/** Free beds by home, and the homes with one, nicest first (ties: the older room). */
function freeBeds(state: SimState, c: Colonists, nice: Map<number, number>): { left: Map<number, number>; open: number[] } {
  const left = new Map<number, number>();
  for (const r of state.layout.rooms) {
    const houses = roomDef(r.type).houses ?? 0;
    if (houses > 0 && isActive(r)) left.set(r.id, houses);
  }
  for (let i = 0; i < c.id.length; i++) {
    const h = c.home[i]!;
    if (h === NONE) continue;
    const n = left.get(h);
    // A closed home, or one over its beds (those listed last go): homeless.
    if (n === undefined || n <= 0) {
      c.home[i] = NONE;
      c.routesStale = true;
      continue;
    }
    left.set(h, n - 1);
  }
  const open = [...left.keys()].filter((h) => left.get(h)! > 0).sort((a, b) => (nice.get(b) ?? 0) - (nice.get(a) ?? 0) || a - b);
  return { left, open };
}

/** The free bed worth most to person i, and what it's worth (the nicest first among equals). */
function bestFreeBed(layout: Layout, c: Colonists, i: number, open: number[], left: Map<number, number>, nice: Map<number, number>, kin: KinBeds, except = NONE): { home: number; score: number } {
  let home = NONE;
  let score = -Infinity;
  for (const h of open) {
    if (h === except || left.get(h)! <= 0) continue;
    const v = bedScore(layout, c, i, h, nice, kin);
    if (v > score) {
      score = v;
      home = h;
    }
  }
  return { home, score };
}

function takeBed(c: Colonists, i: number, home: number, open: number[], left: Map<number, number>, kin: KinBeds): void {
  const was = c.home[i]!;
  moveKin(kin, c.household[i]!, was, home);
  if (was !== NONE) left.set(was, (left.get(was) ?? 0) + 1);
  left.set(home, left.get(home)! - 1);
  c.home[i] = home;
  c.routesStale = true;
  if (was !== NONE && !open.includes(was)) open.push(was);
}

/**
 * Beds: whoever's home closed is homeless, and the homeless take free beds,
 * oldest first, each the one worth most to them (bedScore). Nobody is ever
 * turned out of a bed to make room.
 */
export function assignHomes(state: SimState, c: Colonists): void {
  if (!c.home.includes(NONE) && c.id.length) {
    // Quick check: nobody's homeless, so only closed homes matter.
    const beds = homeBeds(state);
    const used = new Map<number, number>();
    let ok = true;
    for (const h of c.home) {
      const n = (used.get(h) ?? 0) + 1;
      used.set(h, n);
      if (n > (beds.get(h) ?? 0)) {
        ok = false;
        break;
      }
    }
    if (ok) return;
  }
  const nice = niceness(state);
  const { left, open } = freeBeds(state, c, nice);
  if (!open.length) return;
  const kin = kinBeds(c);
  for (let i = 0; i < c.id.length; i++) {
    if (c.home[i] !== NONE) continue;
    const { home } = bestFreeBed(state.layout, c, i, open, left, nice, kin);
    if (home === NONE) break;
    takeBed(c, i, home, open, left, kin);
  }
}

/** Metres from person i's bed to their job (0 without one of them). */
function commuteOf(layout: Layout, c: Colonists, i: number, home = c.home[i]!): number {
  const j = c.job[i]!;
  if (j === NONE || home === NONE) return 0;
  return walkM(layout, j, home);
}

/**
 * Once a day, people trade up. Anyone moves into a free bed worth at least
 * `moveGainPoints` more to them (bedScore: a nicer home, a shorter walk to
 * work, or both, at `metresPerPoint`). Then each worker looks at a few homes
 * worth more to them (from the nearest to their job, and the nicest) for
 * someone who'd gain as much by trading beds; a pair who'd both have gained
 * `swapGainPoints` for `swapAfterDays` days running swap. Nobody else moves.
 */
export function improveHomes(state: SimState, c: Colonists): void {
  const layout = state.layout;
  const a = C.assign;
  const nice = niceness(state);
  const { left, open } = freeBeds(state, c, nice);
  const kin = kinBeds(c);
  // Free beds worth more.
  for (let i = 0; i < c.id.length && open.length; i++) {
    const h = c.home[i]!;
    if (h === NONE) continue;
    const now = bedScore(layout, c, i, h, nice, kin);
    const best = bestFreeBed(layout, c, i, open, left, nice, kin, h);
    if (best.home === NONE || best.score - now < a.moveGainPoints) continue;
    takeBed(c, i, best.home, open, left, kin);
    c.gainDays[i] = 0;
    c.gainWith[i] = NONE;
  }
  // Pairs who'd both gain by trading beds.
  const byHome = new Map<number, number[]>();
  for (let i = 0; i < c.id.length; i++) {
    const h = c.home[i]!;
    if (h === NONE) continue;
    const list = byHome.get(h);
    if (list) list.push(i);
    else byHome.set(h, [i]);
  }
  const nicest = [...byHome.keys()].sort((x, y) => (nice.get(y) ?? 0) - (nice.get(x) ?? 0) || x - y).slice(0, a.swapLooks);
  const paired = new Set<number>();
  const swaps: [number, number][] = [];
  for (let i = 0; i < c.id.length; i++) {
    if (paired.has(i)) continue;
    const h = c.home[i]!;
    const j = c.job[i]!;
    if (h === NONE || j === NONE) continue;
    const now = bedScore(layout, c, i, h, nice, kin);
    // Where to look: the homes worth most to them, from those nearest their job and the nicest.
    const looks = [...new Set([...nearestHomes(layout, j), ...nicest])]
      .filter((x) => x !== h && byHome.has(x))
      .map((x) => ({ x, gain: bedScore(layout, c, i, x, nice, kin) - now }))
      .filter((x) => x.gain >= a.swapGainPoints)
      .sort((p, q) => q.gain - p.gain || p.x - q.x)
      .slice(0, a.swapLooks);
    let partner = NONE;
    let bestGain = 0;
    for (const { x, gain: gainA } of looks) {
      for (const k of byHome.get(x)!) {
        if (paired.has(k) || k === i) continue;
        const gainB = bedScore(layout, c, k, h, nice, kin) - bedScore(layout, c, k, x, nice, kin);
        if (!(gainB >= a.swapGainPoints)) continue;
        if (gainA + gainB > bestGain || (gainA + gainB === bestGain && c.id[k]! < c.id[partner]!)) {
          bestGain = gainA + gainB;
          partner = k;
        }
      }
    }
    if (partner === NONE) continue;
    paired.add(i);
    paired.add(partner);
    const again = c.gainWith[i] === c.id[partner] && c.gainWith[partner] === c.id[i];
    const days = again ? Math.min(c.gainDays[i]!, c.gainDays[partner]!) + 1 : 1;
    c.gainDays[i] = c.gainDays[partner] = Math.min(255, days);
    c.gainWith[i] = c.id[partner]!;
    c.gainWith[partner] = c.id[i]!;
    if (days >= a.swapAfterDays) swaps.push([i, partner]);
  }
  // Anyone who wasn't gaining today starts counting again.
  for (let i = 0; i < c.id.length; i++) {
    if (paired.has(i)) continue;
    c.gainDays[i] = 0;
    c.gainWith[i] = NONE;
  }
  for (const [i, k] of swaps) {
    const h = c.home[i]!;
    c.home[i] = c.home[k]!;
    c.home[k] = h;
    c.gainDays[i] = c.gainDays[k] = 0;
    c.gainWith[i] = c.gainWith[k] = NONE;
    c.routesStale = true;
  }
}

// --- Routes (#525) ---------------------------------------------------------------

/** Each person's walk to work and to the nearest galley, worked out again only when a home, a job or the layout changes. */
export function refreshRoutes(state: SimState, c: Colonists): void {
  const layout = state.layout;
  if (!c.routesStale && c.routesAt === layout.version) return;
  for (let i = 0; i < c.id.length; i++) {
    const h = c.home[i]!;
    c.workM[i] = commuteOf(layout, c, i);
    const food = h === NONE ? NONE : nearestFood(layout, h);
    c.food[i] = food;
    c.foodM[i] = food === NONE ? 0 : walkM(layout, h, food);
  }
  c.routesStale = false;
  c.routesAt = layout.version;
}

/**
 * A walk's pull on comfort (a factor, −3..+3): nothing up to `freeM`, then a
 * little for every step past it, down to `worst`. No way there at all counts
 * as the worst.
 */
export function walkComfort(m: number, w: { freeM: number; comfortPerStep: number; worstComfort: number }): number {
  if (m <= w.freeM) return 0;
  if (!Number.isFinite(m)) return w.worstComfort;
  return Math.max(w.worstComfort, ((m - w.freeM) / STEP_M) * w.comfortPerStep);
}

/** Comfort a person's commute costs them. */
export function commuteComfort(m: number): number {
  return walkComfort(m, C.commute);
}

/** Comfort a person's walk to the galley costs them. */
export function foodWalkComfort(m: number): number {
  return walkComfort(m, C.foodWalk);
}

// --- Each tick ---------------------------------------------------------------

/** Give the people jobs and beds, let them pair up and trade up once a day, and keep their routes current. */
export function syncColonists(state: SimState, cfg: SimConfig): void {
  const c = colonistsOf(state);
  assignJobs(state, c);
  assignHomes(state, c);
  if (state.tick > 0 && state.tick % cfg.ticksPerDay === 0 && c.improvedAt !== state.tick) {
    c.improvedAt = state.tick;
    pairUp(state, cfg, c);
    improveHomes(state, c);
  }
  refreshRoutes(state, c);
}

// --- Saves ---------------------------------------------------------------------

/** The people as a save holds them: each saved column packed (base64 of its typed array). */
export interface PackedColonists {
  nextSeq: number;
  columns: Record<SavedKey, string>;
}

/**
 * Straight after a load, before the first tick works them out again: each
 * person's happiness and needs as their home's (saved with the hole), so a
 * paused game's people panel doesn't read 50 for everyone.
 */
export function seedFromHomes(state: SimState): void {
  const c = state.colonists;
  if (!c) return;
  refreshRoutes(state, c);
  const pools = new Map(state.happiness.pools.map((p) => [p.roomId, p]));
  for (let i = 0; i < c.id.length; i++) {
    const p = pools.get(c.home[i]!);
    c.happiness[i] = p?.happiness ?? state.happiness.average;
    c.comfort[i] = p?.factors.comfort ?? 0;
    c.health[i] = p?.factors.health ?? 0;
  }
}

export function packColonists(c: Colonists): PackedColonists {
  const columns = {} as Record<SavedKey, string>;
  for (const [k, type] of Object.entries(SAVED) as [SavedKey, (typeof SAVED)[SavedKey]][]) {
    columns[k] = packColumn((type as unknown as { from(xs: number[]): Column }).from(c[k]));
  }
  return { nextSeq: c.nextSeq, columns };
}

export function unpackColonists(p: PackedColonists): Colonists {
  const c = createColonists();
  c.nextSeq = p.nextSeq;
  const n = p.columns.id ? unpackColumn(p.columns.id, Int32Array as never).length : 0;
  for (const [k, type] of Object.entries(SAVED) as [SavedKey, (typeof SAVED)[SavedKey]][]) {
    // A column a save from before #527 didn't have: everyone their own household, with no partner, parents or loss.
    if (p.columns[k] === undefined) c[k] = k === "household" ? [...c.id] : new Array(n).fill(NONE);
    else c[k] = Array.from(unpackColumn(p.columns[k], type as never) as unknown as ArrayLike<number>);
  }
  for (const k of DERIVED) c[k] = new Array(n).fill(k === "happiness" ? 50 : k === "food" ? NONE : 0);
  c.routesStale = true;
  return c;
}

// --- For the views (#528) ---------------------------------------------------------

const viewCache = new WeakMap<Colonists, { key: string; upcoming: { stage: Stage; count: number; daysLeft: number }[]; walkers: number[] }>();

function views(state: SimState, cfg: SimConfig) {
  const c = colonistsOf(state);
  const day = Math.floor(state.tick / cfg.ticksPerDay);
  const key = `${c.rev ?? 0}:${c.id.length}:${day}`;
  let hit = viewCache.get(c);
  if (hit?.key === key) return hit;
  // Who moves on next, a line per stage and day.
  const groups = new Map<string, { stage: Stage; count: number; until: number }>();
  for (let i = 0; i < c.id.length; i++) {
    const stage = STAGES[c.stage[i]!]!;
    const k = `${stage}:${Math.floor(c.until[i]! / cfg.ticksPerDay)}`;
    const g = groups.get(k);
    if (g) {
      g.count++;
      g.until = Math.min(g.until, c.until[i]!);
    } else groups.set(k, { stage, count: 1, until: c.until[i]! });
  }
  const upcoming = [...groups.values()]
    .sort((a, b) => a.until - b.until || a.stage.localeCompare(b.stage))
    .slice(0, 5)
    .map((g) => ({ stage: g.stage, count: g.count, daysLeft: Math.max(0, (g.until - state.tick) / cfg.ticksPerDay) }));
  // The people behind the walkers in the 3D view: picked again once a day, the same for everyone who looks.
  const walkers = c.id
    .map((id) => ({ id, h: hash01(state.holeId, id, day, 41) }))
    .sort((a, b) => a.h - b.h || a.id - b.id)
    .slice(0, WALKERS)
    .map((w) => w.id);
  hit = { key, upcoming, walkers };
  viewCache.set(c, hit);
  return hit;
}

/** The most people the views draw walking about (render3d/people3d.ts). */
export const WALKERS = 60;

/** Who moves on to their next stage soonest: at most five lines. */
export function upcomingStages(state: SimState, cfg: SimConfig): { stage: Stage; count: number; daysLeft: number }[] {
  return views(state, cfg).upcoming;
}

/** The ids of the people the walkers are (at most WALKERS), picked again each day. */
export function walkerIds(state: SimState, cfg: SimConfig): number[] {
  return views(state, cfg).walkers;
}
