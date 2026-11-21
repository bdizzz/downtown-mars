import raw from "../../data/notables.json";
import { colonistsOf, nameOf, NONE, rowOf, traitsOf } from "./colonists";
import { hash01 } from "./people";
import { roomDef } from "./rooms";
import type { SimState } from "./state";

// Notables (#529): the people the office hears from and the newsletter quotes,
// up to `maxCount` a hole. They're real colonists (colonists.ts), flagged:
// their name and traits are the person's own, their role comes from where
// they work, and they stay notable as long as they live in the hole. The
// first is the deputy, who writes the newsletter.

export interface Notable {
  id: number;
  /** The colonist they are (colonists.ts id). Missing in saves from before #529: they get one on the next day. */
  personId?: number;
  name: string;
  role: string;
  traits: string[];
  /** 0..100: how much they trust you. */
  loyalty: number;
}

export const notableData = raw as typeof raw & { rolesByCategory: Record<string, string> };

/** A role for person i: what their work makes them, or rolled from their id. */
function roleOf(state: SimState, i: number): string {
  const c = colonistsOf(state);
  const job = c.job[i]!;
  const room = job === NONE ? undefined : state.layout.rooms.find((r) => r.id === job);
  const byWork = room ? notableData.rolesByCategory[roomDef(room.type).category] : undefined;
  return byWork ?? raw.roles[Math.floor(hash01(state.holeId, c.id[i]!, 51) * raw.roles.length)]!;
}

/**
 * A new notable from among the hole's people: an adult who isn't one yet, the
 * newest first (someone who's just arrived, or just grown up). Null if the
 * hole has all it can, or nobody left to pick.
 */
export function addNotable(state: SimState): Notable | null {
  if (state.notables.length >= raw.maxCount) return null;
  const c = colonistsOf(state);
  const taken = new Set(state.notables.map((n) => n.personId));
  let pick = NONE;
  for (let i = c.id.length - 1; i >= 0; i--) {
    if (taken.has(c.id[i]!) || c.stage[i] === 0) continue;
    if (pick === NONE || c.stage[i] === 1) pick = i;
    if (c.stage[i] === 1) break;
  }
  if (pick === NONE) return null;
  const notable: Notable = {
    // The person's own id: never used again, even after they're gone.
    id: c.id[pick]!,
    personId: c.id[pick]!,
    name: nameOf(c, pick),
    role: roleOf(state, pick),
    traits: traitsOf(c, pick),
    loyalty: raw.startLoyalty,
  };
  state.notables.push(notable);
  return notable;
}

export function createNotables(state: SimState): void {
  for (let i = 0; i < raw.startCount; i++) addNotable(state);
}

/**
 * Once a day: notables who have left or passed away aren't notables any more,
 * and the hole picks new ones until it has `startCount` again. Notables from
 * an old save, made up rather than real, become the people they're nearest
 * to: whoever has their name, else the next person free.
 */
export function refreshNotables(state: SimState): void {
  const c = colonistsOf(state);
  const taken = new Set(state.notables.flatMap((n) => (n.personId !== undefined ? [n.personId] : [])));
  for (const n of state.notables) {
    if (n.personId !== undefined) continue;
    let pick = NONE;
    for (let i = 0; i < c.id.length; i++) {
      if (taken.has(c.id[i]!) || c.stage[i] === 0) continue;
      if (nameOf(c, i) === n.name) {
        pick = i;
        break;
      }
      if (pick === NONE) pick = i;
    }
    if (pick === NONE) continue;
    n.personId = c.id[pick]!;
    n.name = nameOf(c, pick);
    n.traits = traitsOf(c, pick);
    taken.add(n.personId);
  }
  state.notables = state.notables.filter((n) => n.personId !== undefined && rowOf(c, n.personId) !== NONE);
  while (state.notables.length < raw.startCount && addNotable(state)) {
    // picked one more
  }
}

/** The notable a person is, if they are one. */
export function notableOf(state: SimState, personId: number): Notable | undefined {
  return state.notables.find((n) => n.personId === personId);
}
