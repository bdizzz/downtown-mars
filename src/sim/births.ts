import type { SimConfig } from "./config";
import { beds } from "./earth";
import { isActive } from "./economy";
import { postMessage } from "./messages";
import { bornTo, colonistsOf, couples, nameOf } from "./colonists";
import { countStage, hash01, people, syncCount, unlock } from "./people";
import { roomDef } from "./rooms";
import type { SimState } from "./state";

// Births: colonists have children once a hole can look after them. A working
// clinic, a happy enough hole, a free bed and a couple; then adults have
// children at a steady rate, each born to one of the couples (colonists.ts).

/** Why births are held back right now, if they are. Empty when they're on. */
export function birthBlockers(state: SimState): string[] {
  const out: string[] = [];
  const clinic = state.layout.rooms.some(
    (r) => isActive(r) && roomDef(r.type).enablesBirths && (state.roomStatus[r.id]?.rate ?? 0) > 0,
  );
  if (!clinic) out.push("No working clinic");
  const happy = state.happiness.average;
  if (happy < people.births.minHappiness) out.push(`Happiness ${Math.round(happy)} is below ${people.births.minHappiness}`);
  if (beds(state) <= state.population.count) out.push("No free beds");
  if (countStage(state, "adult") < 2) out.push("Too few adults");
  else if (!couples(colonistsOf(state)).length) out.push("No couples yet");
  return out;
}

/** Expected births a day while nothing holds them back. */
export function birthsPerDay(state: SimState): number {
  return countStage(state, "adult") * people.births.perAdultPerDay;
}

/** A newborn is a generation after the adults: after the latest of them, if any were born here. */
export function newbornGeneration(state: SimState): number {
  const c = colonistsOf(state);
  let gen = 1;
  for (let i = 0; i < c.id.length; i++) if (c.stage[i] === 1) gen = Math.max(gen, c.gen[i]!);
  return 1 + gen;
}

export function stepBirths(state: SimState, cfg: SimConfig): void {
  const pop = state.population;
  if (birthBlockers(state).length) return;
  pop.birthProgress = (pop.birthProgress ?? 0) + birthsPerDay(state) / cfg.ticksPerDay;
  if (pop.birthProgress < 1) return;
  pop.birthProgress -= 1;
  const row = bornTo(state, cfg, hash01(state.holeId, state.tick, pop.born ?? 0, 31));
  if (row < 0) return;
  const c = colonistsOf(state);
  pop.generation = Math.max(pop.generation ?? 1, c.gen[row]!);
  syncCount(state);
  pop.born = (pop.born ?? 0) + 1;
  unlock(state, "children");
  if (pop.born === 1) {
    postMessage(state, cfg, `The first child is born in ${state.name}: ${nameOf(c, row)}! Children don't work; they'll want a school.`, "good");
  }
}
