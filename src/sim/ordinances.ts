import raw from "../../data/ordinances.json";
import { isActive } from "./economy";
import { roomDef } from "./rooms";
import type { SimState } from "./state";

export interface OrdinanceDef {
  id: string;
  name: string;
  description: string;
  /** Multiplies the noise factor colonists feel at home. */
  noiseFactor?: number;
  /** Multiplies output of rooms that make noise. */
  noisyRoomOutput?: number;
  /** Multiplies colonists' daily needs. */
  needsMultiplier?: Record<string, number>;
  /** Added to every home's comfort and health factors. */
  comfort?: number;
  health?: number;
  /** Turns away colonists moving from other holes. */
  closedBorders?: boolean;
  /** Nudges the hole's culture target while enacted. */
  culture?: Partial<Record<"work" | "order" | "identity" | "openness", number>>;
}

export const ordinanceDefs: OrdinanceDef[] = raw.ordinances as OrdinanceDef[];
const byId = new Map(ordinanceDefs.map((o) => [o.id, o]));

export function ordinanceDef(id: string): OrdinanceDef {
  const def = byId.get(id);
  if (!def) throw new Error(`unknown ordinance "${id}"`);
  return def;
}

export function isOrdinance(id: string): boolean {
  return byId.has(id);
}

/** Slots come from the biggest admin room: the pod's desk gives 1, an admin office 2. */
export function ordinanceSlots(state: SimState): number {
  return state.layout.rooms.filter(isActive).reduce((m, r) => Math.max(m, roomDef(r.type).ordinanceSlots ?? 0), 0);
}

export interface Modifiers {
  noiseFactor: number;
  noisyRoomOutput: number;
  needsMultiplier: Record<string, number>;
  comfort: number;
  health: number;
}

/** Combined effect of every enacted ordinance. */
export function modifiers(state: SimState): Modifiers {
  const m: Modifiers = { noiseFactor: 1, noisyRoomOutput: 1, needsMultiplier: {}, comfort: 0, health: 0 };
  for (const id of state.ordinances) {
    const o = ordinanceDef(id);
    m.noiseFactor *= o.noiseFactor ?? 1;
    m.noisyRoomOutput *= o.noisyRoomOutput ?? 1;
    m.comfort += o.comfort ?? 0;
    m.health += o.health ?? 0;
    for (const [k, v] of Object.entries(o.needsMultiplier ?? {})) m.needsMultiplier[k] = (m.needsMultiplier[k] ?? 1) * v;
  }
  return m;
}

export function enact(state: SimState, id: string): { ok: true } | { ok: false; reason: string } {
  if (!isOrdinance(id)) return { ok: false, reason: `Unknown ordinance "${id}"` };
  if (state.ordinances.includes(id)) return { ok: true };
  if (state.ordinances.length >= ordinanceSlots(state)) return { ok: false, reason: "No free ordinance slot: a bigger admin office adds more" };
  state.ordinances.push(id);
  return { ok: true };
}

export function repeal(state: SimState, id: string): void {
  state.ordinances = state.ordinances.filter((o) => o !== id);
}
