import { isActive } from "./economy";
import { countStage, griefComfort, people } from "./people";
import { roomDef } from "./rooms";
import type { SimState } from "./state";

// Schools and elder care: how many children and elders have a place, and
// what it does to everyone else when they don't.

export interface Coverage {
  /** Children (or elders) in the hole. */
  who: number;
  /** Places in working rooms. */
  places: number;
  /** Without a place. */
  missing: number;
}

function places(state: SimState, per: (type: string) => number): number {
  let n = 0;
  for (const r of state.layout.rooms) {
    const k = per(r.type);
    if (k && isActive(r)) n += k * (state.roomStatus[r.id]?.rate ?? 0);
  }
  return n;
}

export function schoolCoverage(state: SimState): Coverage {
  const who = countStage(state, "child");
  const p = places(state, (t) => roomDef(t).teaches ?? 0);
  return { who, places: p, missing: Math.max(0, who - p) };
}

export function elderCoverage(state: SimState): Coverage {
  const who = countStage(state, "elder");
  const p = places(state, (t) => roomDef(t).caresForElders ?? 0);
  return { who, places: p, missing: Math.max(0, who - p) };
}

/** Hole-wide comfort and health factors from children and elders without a place. */
export function careFactors(state: SimState): { comfort: number; health: number } {
  const pop = state.population.count;
  if (pop <= 0) return { comfort: 0, health: 0 };
  const s = people.school;
  const e = people.elderCare;
  const families = Math.min(1, (schoolCoverage(state).missing * s.familySize) / pop);
  const burdened = Math.min(1, (elderCoverage(state).missing * e.affectedPerElder) / pop);
  return { comfort: families * s.unschooledComfort + griefComfort(state), health: burdened * e.uncaredHealth };
}
