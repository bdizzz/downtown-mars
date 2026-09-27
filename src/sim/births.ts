import type { SimConfig } from "./config";
import { beds } from "./earth";
import { isActive } from "./economy";
import { postMessage } from "./messages";
import { countStage, people, syncCount, unlock } from "./people";
import { roomDef } from "./rooms";
import type { SimState } from "./state";

// Births: colonists have children once a hole can look after them. A working
// clinic, a happy enough hole and a free bed; then adults have children at a
// steady rate, gathered into one cohort per day.

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
  return out;
}

/** Expected births a day while nothing holds them back. */
export function birthsPerDay(state: SimState): number {
  return countStage(state, "adult") * people.births.perAdultPerDay;
}

export function stepBirths(state: SimState, cfg: SimConfig): void {
  const pop = state.population;
  if (birthBlockers(state).length) return;
  pop.birthProgress = (pop.birthProgress ?? 0) + birthsPerDay(state) / cfg.ticksPerDay;
  if (pop.birthProgress < 1) return;
  pop.birthProgress -= 1;
  // Everyone born the same day grows up together.
  const today = Math.floor(state.tick / cfg.ticksPerDay);
  const until = (today * cfg.ticksPerDay) + people.child.days * cfg.ticksPerDay;
  const cohort = pop.cohorts.find((c) => c.stage === "child" && c.until === until);
  if (cohort) cohort.count += 1;
  else pop.cohorts.push({ stage: "child", count: 1, until });
  syncCount(state);
  pop.born = (pop.born ?? 0) + 1;
  unlock(state, "children");
  if (pop.born === 1) {
    postMessage(state, cfg, `The first child is born in ${state.name}! Children don't work; they'll want a school.`, "good");
  }
}
