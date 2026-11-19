import notableData from "../../data/notables.json";
import type { SimConfig } from "./config";
import { isActive } from "./economy";
import { packColumn, unpackColumn, type Column } from "./pack";
import { distancesFrom, pathsFor, STEP_M } from "./paths";
import type { Layout } from "./placement";
import peopleData from "../../data/people.json";
import { hash01, type Cohort, type Stage } from "./people";
import { roomDef } from "./rooms";
import type { SimState } from "./state";

// Individual colonists (#521, docs/PLAN-PEOPLE.md), beside the cohorts for now
// (shadow mode, #523): the cohorts still decide how many people there are at
// each life stage, and every tick the people are brought in step with them.
// Each person keeps who they are (an id for life, a name, two traits, when
// they were born) and, on top (#524–#526): a job, a bed, their walks to work
// and to the galley, and their own needs.
//
// People are columns, not objects: one array per field, indexed by person.
// In memory they're plain number arrays (so a state copies and clones like
// any other); in a save each saved column is packed into a typed array.
//
// Homes and jobs assign themselves (decided Nov 18): a job first, then the
// free bed nearest to it; nobody is turned out of a bed; and two people swap
// beds only after both would have gained from it for a few days in a row.
//
// Routes are distances, never walks: one search per room (cached until the
// layout changes), and each person reads their two distances from those.
// Deterministic throughout: rolls come from hash01 of the hole and the
// person's id, and ties break by id.

// Read straight from the data, not through people.ts, which imports this file.
const P = peopleData as unknown as Pick<typeof import("./people").people, "colonists" | "child">;
const C = P.colonists;

/** Life stages as the stage column stores them. */
export const STAGES: readonly Stage[] = ["child", "adult", "elder"];
const stageNo = (s: Stage) => STAGES.indexOf(s);

/** Ids are unique across the network: the hole they first appeared in, then a count. */
const ID_SPAN = 1_000_000;

/** What's saved for each person, with the type it packs into. Everything else is worked out again. */
const SAVED = {
  id: Int32Array,
  cohort: Int32Array,
  stage: Uint8Array,
  born: Int32Array,
  until: Int32Array,
  gen: Uint8Array,
  first: Uint16Array,
  last: Uint16Array,
  traitA: Uint8Array,
  traitB: Uint8Array,
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
  /** Set when a home, a job or the layout changed since the routes were last worked out. */
  routesStale?: boolean;
  /** The layout version the routes were worked out for. */
  routesAt?: number;
  /** The tick beds last got closer to work (once a day). */
  improvedAt?: number;
  /** The cohorts as they were when the people were last brought in step with them: unchanged, there's nothing to do. */
  syncedTo?: string;
};

/** Who someone is, carried with them when they leave for another hole. */
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
}

const NONE = -1;

export function createColonists(): Colonists {
  const c = { nextSeq: 1 } as Colonists;
  for (const k of Object.keys(SAVED) as SavedKey[]) c[k] = [];
  for (const k of DERIVED) c[k] = [];
  return c;
}

/** The hole's people, made from its cohorts if it has none yet (a new game, an old save). */
export function colonistsOf(state: SimState): Colonists {
  return (state.colonists ??= createColonists());
}

/** How many people there are. */
export function headCount(state: SimState): number {
  return state.colonists?.id.length ?? 0;
}

const ALL_KEYS = [...(Object.keys(SAVED) as SavedKey[]), ...DERIVED];

function addRow(c: Colonists, m: Member, cohort: number): void {
  const row: Record<SavedKey | DerivedKey, number> = {
    ...m,
    cohort,
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
  c.routesStale = true;
}

/** Keep only the rows marked to stay, in order. */
function compact(c: Colonists, keep: boolean[]): void {
  for (const k of ALL_KEYS) {
    const col = c[k];
    let j = 0;
    for (let i = 0; i < col.length; i++) if (keep[i]) col[j++] = col[i]!;
    col.length = j;
  }
  c.routesStale = true;
}

const names = notableData as { firstNames: string[]; lastNames: string[]; traits: string[] };

/** A new person for a cohort: their name, traits and age rolled from the hole and their id. */
function newMember(state: SimState, cfg: SimConfig, c: Colonists, k: Cohort): Member {
  const id = state.holeId * ID_SPAN + c.nextSeq++;
  const h = (salt: number) => hash01(state.holeId, id, salt);
  const pick = (n: number, salt: number) => Math.floor(h(salt) * n) % n;
  const traitA = pick(names.traits.length, 3);
  const traitB = (traitA + 1 + pick(names.traits.length - 1, 4)) % names.traits.length;
  const stage = stageNo(k.stage);
  const ageDays = (span: [number, number]) => span[0] + (span[1] - span[0]) * h(5);
  // A child was born on the day its cohort was; adults and elders arrived (or turned up in an old save) with an age.
  const born =
    k.stage === "child"
      ? k.until - P.child.days * cfg.ticksPerDay
      : state.tick - Math.round(ageDays(k.stage === "adult" ? C.arrivalAgeDays : C.elderAgeDays) * cfg.ticksPerDay);
  return { id, stage, born, until: k.until, gen: k.gen ?? 1, first: pick(names.firstNames.length, 1), last: pick(names.lastNames.length, 2), traitA, traitB };
}

/** Give every cohort an id, so its people can find it. */
function idCohorts(state: SimState): void {
  const pop = state.population;
  let next = pop.nextCohortId ?? 1;
  for (const k of pop.cohorts) if (k.id !== undefined) next = Math.max(next, k.id + 1);
  for (const k of pop.cohorts) if (k.id === undefined) k.id = next++;
  pop.nextCohortId = next;
}

/**
 * Bring the people in step with the cohorts: a cohort that moved on takes its
 * people with it (grown up, retired), one that shrank loses its newest, one
 * that's gone (passed away, or emptied by hand) takes them all, and one that
 * grew (a birth, arrivals) gains new people.
 */
export function reconcileColonists(state: SimState, cfg: SimConfig): void {
  idCohorts(state);
  const c = colonistsOf(state);
  // A few dozen cohorts at most: cheap to compare, where the people may be thousands.
  const sig = `${c.id.length}|${state.population.cohorts.map((k) => `${k.id}:${k.count}:${k.stage}:${k.until}:${k.gen ?? 1}`).join(",")}`;
  if (sig === c.syncedTo) return;
  const byId = new Map(state.population.cohorts.map((k) => [k.id!, k]));
  const have = new Map<number, number>();
  for (const k of c.cohort) have.set(k, (have.get(k) ?? 0) + 1);
  const n = c.id.length;
  let dropped = false;
  const keep: boolean[] = new Array(n).fill(true);
  for (let i = n - 1; i >= 0; i--) {
    const k = byId.get(c.cohort[i]!);
    const left = have.get(c.cohort[i]!)!;
    if (!k || left > k.count) {
      keep[i] = false;
      dropped = true;
      have.set(c.cohort[i]!, left - 1);
      continue;
    }
    const stage = stageNo(k.stage);
    if (c.stage[i] !== stage) {
      c.stage[i] = stage;
      c.routesStale = true;
    }
    c.until[i] = k.until;
    c.gen[i] = k.gen ?? 1;
  }
  if (dropped) compact(c, keep);
  for (const k of state.population.cohorts) {
    for (let i = have.get(k.id!) ?? 0; i < k.count; i++) addRow(c, newMember(state, cfg, c, k), k.id!);
  }
  c.syncedTo = `${c.id.length}|${state.population.cohorts.map((k) => `${k.id}:${k.count}:${k.stage}:${k.until}:${k.gen ?? 1}`).join(",")}`;
}

/** Take up to n people of a cohort, newest first, out of the hole: who they are goes with them. */
export function takeMembers(state: SimState, cohortId: number, n: number): Member[] {
  const c = state.colonists;
  if (!c || n <= 0) return [];
  const out: Member[] = [];
  const keep: boolean[] = new Array(c.id.length).fill(true);
  for (let i = c.id.length - 1; i >= 0 && out.length < n; i--) {
    if (c.cohort[i] !== cohortId) continue;
    keep[i] = false;
    out.push({ id: c.id[i]!, stage: c.stage[i]!, born: c.born[i]!, until: c.until[i]!, gen: c.gen[i]!, first: c.first[i]!, last: c.last[i]!, traitA: c.traitA[i]!, traitB: c.traitB[i]! });
  }
  if (out.length) compact(c, keep);
  return out;
}

/** People arriving from another hole join a cohort here, as themselves. */
export function addMembers(state: SimState, cohortId: number, members: Member[]): void {
  const c = colonistsOf(state);
  for (const m of members) addRow(c, m, cohortId);
}

/** The full name of person i (from the notables' name pools). */
export function nameOf(c: Colonists, i: number): string {
  return `${names.firstNames[c.first[i]!]} ${names.lastNames[c.last[i]!]}`;
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
  const adult = stageNo("adult");
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

/**
 * What a bed is worth to person i, in happiness points: how nice the home is,
 * less their walk to work at `metresPerPoint` (a worker will walk that much
 * further for each point nicer). Without a job, only the home counts.
 */
function bedScore(layout: Layout, c: Colonists, i: number, home: number, nice: Map<number, number>): number {
  const j = c.job[i]!;
  const walk = j === NONE ? 0 : walkM(layout, j, home);
  return (nice.get(home) ?? 0) - walk / C.assign.metresPerPoint;
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
function bestFreeBed(layout: Layout, c: Colonists, i: number, open: number[], left: Map<number, number>, nice: Map<number, number>, except = NONE): { home: number; score: number } {
  let home = NONE;
  let score = -Infinity;
  for (const h of open) {
    if (h === except || left.get(h)! <= 0) continue;
    // Without a job, the nicest free one is the best: open is nicest first.
    if (c.job[i] === NONE) return { home: h, score: nice.get(h) ?? 0 };
    const v = bedScore(layout, c, i, h, nice);
    if (v > score) {
      score = v;
      home = h;
    }
  }
  return { home, score };
}

function takeBed(c: Colonists, i: number, home: number, open: number[], left: Map<number, number>): void {
  const was = c.home[i]!;
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
function assignHomes(state: SimState, c: Colonists): void {
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
  for (let i = 0; i < c.id.length; i++) {
    if (c.home[i] !== NONE) continue;
    const { home } = bestFreeBed(state.layout, c, i, open, left, nice);
    if (home === NONE) break;
    takeBed(c, i, home, open, left);
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
  // Free beds worth more.
  for (let i = 0; i < c.id.length && open.length; i++) {
    const h = c.home[i]!;
    if (h === NONE) continue;
    const now = bedScore(layout, c, i, h, nice);
    const best = bestFreeBed(layout, c, i, open, left, nice, h);
    if (best.home === NONE || best.score - now < a.moveGainPoints) continue;
    takeBed(c, i, best.home, open, left);
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
    const now = bedScore(layout, c, i, h, nice);
    // Where to look: the homes worth most to them, from those nearest their job and the nicest.
    const looks = [...new Set([...nearestHomes(layout, j), ...nicest])]
      .filter((x) => x !== h && byHome.has(x))
      .map((x) => ({ x, gain: bedScore(layout, c, i, x, nice) - now }))
      .filter((x) => x.gain >= a.swapGainPoints)
      .sort((p, q) => q.gain - p.gain || p.x - q.x)
      .slice(0, a.swapLooks);
    let partner = NONE;
    let bestGain = 0;
    for (const { x, gain: gainA } of looks) {
      for (const k of byHome.get(x)!) {
        if (paired.has(k) || k === i) continue;
        const gainB = bedScore(layout, c, k, h, nice) - bedScore(layout, c, k, x, nice);
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

/** Keep the people in step with the cohorts, give them jobs and beds, and keep their routes current. */
export function syncColonists(state: SimState, cfg: SimConfig): void {
  reconcileColonists(state, cfg);
  const c = colonistsOf(state);
  assignJobs(state, c);
  assignHomes(state, c);
  if (state.tick > 0 && state.tick % cfg.ticksPerDay === 0 && c.improvedAt !== state.tick) {
    c.improvedAt = state.tick;
    improveHomes(state, c);
  }
  refreshRoutes(state, c);
}

/** People by stage, counted from the people themselves (for the shadow check against the cohorts). */
export function colonistStages(state: SimState): Record<Stage, number> {
  const out: Record<Stage, number> = { child: 0, adult: 0, elder: 0 };
  for (const s of state.colonists?.stage ?? []) out[STAGES[s]!] += 1;
  return out;
}

// --- Saves ---------------------------------------------------------------------

/** The people as a save holds them: each saved column packed (base64 of its typed array). */
export interface PackedColonists {
  nextSeq: number;
  columns: Record<SavedKey, string>;
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
  for (const [k, type] of Object.entries(SAVED) as [SavedKey, (typeof SAVED)[SavedKey]][]) {
    c[k] = Array.from(unpackColumn(p.columns[k], type as never) as unknown as ArrayLike<number>);
  }
  const n = c.id.length;
  for (const k of DERIVED) c[k] = new Array(n).fill(k === "happiness" ? 50 : k === "food" ? NONE : 0);
  c.routesStale = true;
  return c;
}
