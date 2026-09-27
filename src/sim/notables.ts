import raw from "../../data/notables.json";
import { nextRandom } from "./rng";
import type { SimState } from "./state";

export interface Notable {
  id: number;
  name: string;
  role: string;
  traits: string[];
  /** 0..100: how much they trust you. */
  loyalty: number;
}

export const notableData = raw;

function pick<T>(state: SimState, list: T[]): T {
  return list[Math.floor(nextRandom(state) * list.length)]!;
}

/** A new notable with a name nobody has yet, a role and two different traits. */
export function addNotable(state: SimState): Notable | null {
  if (state.notables.length >= raw.maxCount) return null;
  const taken = new Set(state.notables.map((n) => n.name));
  let name = "";
  for (let tries = 0; tries < 50 && (!name || taken.has(name)); tries++) {
    name = `${pick(state, raw.firstNames)} ${pick(state, raw.lastNames)}`;
  }
  const first = pick(state, raw.traits);
  let second = pick(state, raw.traits);
  while (second === first) second = pick(state, raw.traits);
  const notable: Notable = {
    id: state.notables.reduce((m, n) => Math.max(m, n.id), 0) + 1,
    name,
    role: pick(state, raw.roles),
    traits: [first, second],
    loyalty: raw.startLoyalty,
  };
  state.notables.push(notable);
  return notable;
}

export function createNotables(state: SimState): void {
  for (let i = 0; i < raw.startCount; i++) addNotable(state);
}
