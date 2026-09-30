import { assignNearest, reachOf, walkFrom } from "./amenities";
import { isActive } from "./economy";
import { STEP_M } from "./paths";
import { countStage, griefComfort, people } from "./people";
import { roomDef } from "./rooms";
import type { SimState } from "./state";

// Clinics, schools and elder care: who has a place, home by home, and what it
// does to the rest of the household when they don't. Places go to the homes
// nearest them first, within each service's reach on foot (milestone 11); a
// home too far from any, or last in line at a full one, goes without. Homes
// don't know which of their people are children or elders, so each is taken
// to hold the hole's mix, in proportion to its residents. The homeless get
// whatever places are left anywhere.

export interface Coverage {
  /** Children (or elders, or everyone for clinic care) in the hole. */
  who: number;
  /** Places in working rooms. */
  places: number;
  /** Without a place within reach. */
  missing: number;
}

/** A home's share of each need met, 0..1: clinic care for everyone, school for its children, elder care for its elders. */
export interface HomeCare {
  care: number;
  school: number;
  elders: number;
}

export interface CareState {
  byHome: Record<number, HomeCare>;
  homeless: HomeCare;
  care: Coverage;
  school: Coverage;
  elders: Coverage;
}

type Kind = keyof HomeCare;
const CAPACITY: Record<Kind, (type: string) => number> = {
  care: (t) => roomDef(t).cares ?? 0,
  school: (t) => roomDef(t).teaches ?? 0,
  elders: (t) => roomDef(t).caresForElders ?? 0,
};

/** Places each working room offers, as far as it's staffed and running. */
function offers(state: SimState, kind: Kind): { id: number; capacity: number; reachM: number }[] {
  const out: { id: number; capacity: number; reachM: number }[] = [];
  for (const r of state.layout.rooms) {
    const k = CAPACITY[kind](r.type);
    if (!k || !isActive(r)) continue;
    out.push({ id: r.id, capacity: k * (state.roomStatus[r.id]?.rate ?? 0), reachM: reachOf(r.type) * STEP_M });
  }
  return out;
}

/** Share out clinic, school and elder-care places, nearest first, by last update's residents. */
export function updateCare(state: SimState): void {
  const pop = state.population.count;
  const kids = countStage(state, "child");
  const elders = countStage(state, "elder");
  const homes = state.happiness.pools.filter((p) => p.residents > 0);
  const homeless = state.happiness.homeless;
  const share = (n: number) => (pop > 0 ? n / pop : 0);
  const need: Record<Kind, (residents: number) => number> = {
    care: (r) => r,
    school: (r) => r * share(kids),
    elders: (r) => r * share(elders),
  };
  const walk = (id: number) => walkFrom(state.layout, id);
  const byHome: Record<number, HomeCare> = {};
  for (const h of homes) byHome[h.roomId] = { care: 1, school: 1, elders: 1 };
  const homelessCare: HomeCare = { care: 1, school: 1, elders: 1 };
  const totals = {} as Record<Kind, Coverage>;
  for (const kind of ["care", "school", "elders"] as Kind[]) {
    const o = offers(state, kind);
    const wants = homes.map((h) => ({ id: h.roomId, need: need[kind](h.residents) }));
    const { got, gave } = assignNearest(wants, o, walk);
    const places = o.reduce((s, x) => s + x.capacity, 0);
    const spare = Math.max(0, places - [...gave.values()].reduce((a, b) => a + b, 0));
    const homelessNeed = need[kind](homeless);
    let placed = Math.min(spare, homelessNeed);
    for (const w of wants) {
      byHome[w.id]![kind] = w.need > 0 ? Math.min(1, (got.get(w.id) ?? 0) / w.need) : 1;
      placed += got.get(w.id) ?? 0;
    }
    homelessCare[kind] = homelessNeed > 0 ? Math.min(1, spare / homelessNeed) : 1;
    const who = kind === "care" ? pop : kind === "school" ? kids : elders;
    totals[kind] = { who, places, missing: Math.max(0, who - placed) };
  }
  state.population.care = { byHome, homeless: homelessCare, ...totals };
}

/** Places anywhere in the hole, ignoring reach: for before the first update (and old saves). */
function holeWide(state: SimState, kind: Kind, who: number): Coverage {
  const places = offers(state, kind).reduce((s, x) => s + x.capacity, 0);
  return { who, places, missing: Math.max(0, who - places) };
}

export function schoolCoverage(state: SimState): Coverage {
  return state.population.care?.school ?? holeWide(state, "school", countStage(state, "child"));
}

export function elderCoverage(state: SimState): Coverage {
  return state.population.care?.elders ?? holeWide(state, "elders", countStage(state, "elder"));
}

/** Share of colonists with a clinic place within reach, 0..1. */
export function careCoverage(state: SimState): number {
  const c = state.population.care?.care ?? holeWide(state, "care", state.population.count);
  return c.who > 0 ? Math.min(1, (c.who - c.missing) / c.who) : 1;
}

/** A home's share of each need met (the homeless for null; the hole's shares before the first update). */
export function homeCare(state: SimState, homeId: number | null | undefined): HomeCare {
  const c = state.population.care;
  if (c && homeId === null) return c.homeless;
  if (c && homeId !== undefined && homeId !== null && c.byHome[homeId]) return c.byHome[homeId]!;
  const met = (x: Coverage) => (x.who > 0 ? Math.min(1, (x.who - x.missing) / x.who) : 1);
  return { care: careCoverage(state), school: met(schoolCoverage(state)), elders: met(elderCoverage(state)) };
}

/**
 * Comfort and health for a home from its care: families with a child
 * unschooled, elders without care (and whoever looks after them), and no
 * clinic within reach. Grief for the unburied weighs on everyone. With no
 * home given, the hole as a whole.
 */
export function careFactors(state: SimState, homeId?: number | null): { comfort: number; health: number; clinic: number } {
  const pop = state.population.count;
  if (pop <= 0) return { comfort: 0, health: 0, clinic: 0 };
  const s = people.school;
  const e = people.elderCare;
  const c = homeCare(state, homeId);
  const kids = countStage(state, "child") / pop;
  const elders = countStage(state, "elder") / pop;
  const families = Math.min(1, kids * (1 - c.school) * s.familySize);
  const burdened = Math.min(1, elders * (1 - c.elders) * e.affectedPerElder);
  return { comfort: families * s.unschooledComfort + griefComfort(state), health: burdened * e.uncaredHealth, clinic: c.care };
}
