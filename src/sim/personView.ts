import type { SimConfig } from "./config";
import { colonistsOf, commuteComfort, foodWalkComfort, isKin, kinGriefComfort, nameOf, NONE, rowOf, STAGES, traitsOf, type Colonists } from "./colonists";
import { DIAGNOSIS } from "./diagnosis";
import { notableOf } from "./notables";
import type { Stage } from "./people";
import { roomFloor, roomName } from "./roomName";
import type { SimState } from "./state";

// The people, one at a time (#528): a person's card and a page of the people
// list, worked out in the worker when the player asks (a click on a walker, a
// row, the people panel open), never carried in the snapshot. The Godot
// bridge answers the same questions. The words are view/personCard.ts's.

/** A room as a person's card names it: its id (to show it) and its name with its floor. */
export interface RoomRef {
  id: number;
  name: string;
}

export interface FamilyRef {
  id: number;
  name: string;
  relation: "partner" | "parent" | "child" | "sibling" | "family";
  /** They're a child, an adult or an elder. */
  stage: Stage;
}

/** One person, as their card shows them. */
export interface PersonView {
  id: number;
  name: string;
  /** Whole years old (a game day is a month). */
  age: number;
  /** Whole months old. */
  months: number;
  stage: Stage;
  /** Arrivals are the first generation, their children the second. */
  gen: number;
  home: RoomRef | null;
  job: RoomRef | null;
  /** Metres on foot, home to work and home to the galley (0: no such walk). */
  commuteM: number;
  foodM: number;
  /** 0..100. */
  happiness: number;
  /** Comfort, fed and health factors, −3..+3. */
  needs: { comfort: number; fed: number; health: number };
  traits: string[];
  family: FamilyRef[];
  /** Their role, if they're a notable (the office hears from them). */
  notable: string | null;
  /** They lost family lately. */
  mourning: boolean;
  /** What lifts and weighs on their happiness most, in points, biggest first. */
  reasons: { id: string; label: string; points: number }[];
}

export type PeopleSort = "happiness" | "age" | "commute" | "name";
export type PeopleFilter = "all" | "unhappy" | "homeless" | "jobless" | "children" | "elders" | "mourning";

export interface PeopleQuery {
  sort: PeopleSort;
  filter: PeopleFilter;
  /** Part of a name, any case. */
  search: string;
  offset: number;
}

export interface PersonRow {
  id: number;
  name: string;
  age: number;
  months: number;
  stage: Stage;
  happiness: number;
  home: string | null;
  job: string | null;
  commuteM: number;
}

export interface PeoplePage {
  /** Everyone the filter and search let through. */
  total: number;
  offset: number;
  pageSize: number;
  rows: PersonRow[];
}

export const PAGE_SIZE = 50;
/** Below this, someone counts as unhappy in the list's filter. */
export const UNHAPPY_BELOW = 45;

function roomRef(state: SimState, id: number): RoomRef | null {
  if (id === NONE) return null;
  const room = state.layout.rooms.find((r) => r.id === id);
  if (!room) return null;
  const f = roomFloor(room);
  return { id, name: `${roomName(room)} (${f === null ? "surface" : `F${f}`})` };
}

const monthsOld = (c: Colonists, i: number, state: SimState, cfg: SimConfig) => Math.max(0, Math.floor((state.tick - c.born[i]!) / cfg.ticksPerDay));
const yearsOld = (c: Colonists, i: number, state: SimState, cfg: SimConfig) => Math.floor(monthsOld(c, i, state, cfg) / 12);

function relation(c: Colonists, i: number, j: number): FamilyRef["relation"] {
  const a = c.id[i]!;
  const b = c.id[j]!;
  if (c.partner[i] === b) return "partner";
  if (c.parentA[i] === b || c.parentB[i] === b) return "parent";
  if (c.parentA[j] === a || c.parentB[j] === a) return "child";
  const parents = [c.parentA[i], c.parentB[i]].filter((p) => p !== NONE);
  if (parents.some((p) => p === c.parentA[j] || p === c.parentB[j])) return "sibling";
  return "family";
}

const ORDER: Record<FamilyRef["relation"], number> = { partner: 0, parent: 1, child: 2, sibling: 3, family: 4 };

/** Person `id`'s card, or null if they aren't in this hole (left, or passed away). */
export function personView(state: SimState, cfg: SimConfig, id: number): PersonView | null {
  const c = colonistsOf(state);
  const i = rowOf(c, id);
  if (i === NONE) return null;
  const w = cfg.happiness.weights;
  const family: FamilyRef[] = [];
  for (let j = 0; j < c.id.length; j++) {
    if (!isKin(c, i, j)) continue;
    family.push({ id: c.id[j]!, name: nameOf(c, j), relation: relation(c, i, j), stage: STAGES[c.stage[j]!]! });
  }
  family.sort((x, y) => ORDER[x.relation] - ORDER[y.relation] || x.id - y.id);
  // Their home's parts, with the home's average walks and grief swapped for their own.
  const pool = state.happiness.pools.find((p) => p.roomId === c.home[i]);
  const points: Record<string, number> = { ...(pool?.points ?? {}) };
  delete points.commute;
  delete points.foodWalk;
  delete points.kinGrief;
  const own = { commute: commuteComfort(c.workM[i]!), foodWalk: foodWalkComfort(c.foodM[i]!), kinGrief: kinGriefComfort(c, i, state.tick, cfg) };
  for (const [k, v] of Object.entries(own)) if (v) points[k] = v * w.comfort;
  const reasons = Object.entries(points)
    .filter(([k, v]) => k !== "base" && Math.abs(v) >= 0.5)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]) || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([k, v]) => ({ id: k, label: DIAGNOSIS.happiness[k]?.label ?? k, points: v }));
  return {
    id,
    name: nameOf(c, i),
    age: yearsOld(c, i, state, cfg),
    months: monthsOld(c, i, state, cfg),
    stage: STAGES[c.stage[i]!]!,
    gen: c.gen[i]!,
    home: roomRef(state, c.home[i]!),
    job: roomRef(state, c.job[i]!),
    commuteM: c.workM[i]!,
    foodM: c.foodM[i]!,
    happiness: c.happiness[i]!,
    needs: { comfort: c.comfort[i]!, fed: c.fed[i]!, health: c.health[i]! },
    traits: traitsOf(c, i),
    family,
    notable: notableOf(state, id)?.role ?? null,
    mourning: kinGriefComfort(c, i, state.tick, cfg) < 0,
    reasons,
  };
}

/** A page of the people list: filtered, searched, sorted (ties by id), PAGE_SIZE rows from `offset`. */
export function peoplePage(state: SimState, cfg: SimConfig, q: PeopleQuery): PeoplePage {
  const c = colonistsOf(state);
  const search = q.search.trim().toLowerCase();
  const rows: number[] = [];
  for (let i = 0; i < c.id.length; i++) {
    const ok =
      q.filter === "all" ||
      (q.filter === "unhappy" && c.happiness[i]! < UNHAPPY_BELOW) ||
      (q.filter === "homeless" && c.home[i] === NONE) ||
      (q.filter === "jobless" && c.stage[i] === 1 && c.job[i] === NONE) ||
      (q.filter === "children" && c.stage[i] === 0) ||
      (q.filter === "elders" && c.stage[i] === 2) ||
      (q.filter === "mourning" && kinGriefComfort(c, i, state.tick, cfg) < 0);
    if (!ok) continue;
    if (search && !nameOf(c, i).toLowerCase().includes(search)) continue;
    rows.push(i);
  }
  const by: Record<PeopleSort, (a: number, b: number) => number> = {
    happiness: (a, b) => c.happiness[a]! - c.happiness[b]!,
    age: (a, b) => c.born[a]! - c.born[b]!,
    commute: (a, b) => c.workM[b]! - c.workM[a]!,
    name: (a, b) => nameOf(c, a).localeCompare(nameOf(c, b)),
  };
  rows.sort((a, b) => by[q.sort](a, b) || c.id[a]! - c.id[b]!);
  const offset = Math.max(0, Math.min(q.offset, Math.max(0, rows.length - 1)));
  const homes = new Map<number, string | null>();
  const name = (id: number) => {
    if (!homes.has(id)) homes.set(id, roomRef(state, id)?.name ?? null);
    return homes.get(id)!;
  };
  return {
    total: rows.length,
    offset,
    pageSize: PAGE_SIZE,
    rows: rows.slice(offset, offset + PAGE_SIZE).map((i) => ({
      id: c.id[i]!,
      name: nameOf(c, i),
      age: yearsOld(c, i, state, cfg),
      months: monthsOld(c, i, state, cfg),
      stage: STAGES[c.stage[i]!]!,
      happiness: c.happiness[i]!,
      home: name(c.home[i]!),
      job: name(c.job[i]!),
      commuteM: c.workM[i]!,
    })),
  };
}
