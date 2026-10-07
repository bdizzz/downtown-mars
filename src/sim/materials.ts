import raw from "../../data/materials.json";
import conditionRaw from "../../data/condition.json";
import { isActive } from "./economy";
import type { RoomInstance } from "./placement";
import { roomDef } from "./rooms";
import type { SimState } from "./state";

// Room linings (docs/PLAN-M15.md): what a room's walls and floor are made of.
// Every room starts as bare rock, and absent fields mean just that, so old
// saves need nothing. A lining makes a room nicer to be in and slower to wear,
// by how much depending on the kind of room: homes feel the comfort in full,
// people rooms (the galley, restrooms, the clinic…) lift everyone's shared
// comfort, heavy rooms (industry, power, air, water) get none but wear slower
// still, and the rest only wear slower.

export type Material = "rock" | "brick" | "metal";
export type Finish = "base" | "fine";
export type LiningKind = "home" | "people" | "heavy" | "other";

export interface WallStep {
  material: Material;
  finish: Finish;
  name: string;
  /** Per cell; a fine finish's is on top of its base step's. */
  cost: Record<string, number>;
  work: number;
  comfort: number;
  wear: number;
}

export interface FlooringDef {
  id: string;
  name: string;
  cost: Record<string, number>;
  work: number;
  comfort: number;
}

export const MATERIALS = raw as unknown as {
  walls: WallStep[];
  floorings: FlooringDef[];
  kinds: Record<LiningKind, { comfort: number; wearBenefit: number }>;
  byCategory: Record<string, LiningKind>;
  byRoom: Record<string, LiningKind>;
  shared: { scale: number; max: number };
  leastWear: number;
  exempt: string[];
};

const cleanable = conditionRaw as unknown as { cleanable: { categories: string[]; rooms: string[] } };

/** The wall step for a material and finish (bare rock for anything unknown). */
export function wallStep(material: string | undefined, finish: string | undefined): WallStep {
  return MATERIALS.walls.find((w) => w.material === (material ?? "rock") && w.finish === (finish ?? "base")) ?? MATERIALS.walls[0]!;
}

export function flooringDef(id: string | undefined): FlooringDef | null {
  return id ? (MATERIALS.floorings.find((f) => f.id === id) ?? null) : null;
}

/** Can this room have a lining? Ring rooms with walls: not surface buildings, the entrance, stairs and lifts, or empty rooms. */
export function canLine(room: RoomInstance): boolean {
  return room.at.kind === "ring" && !MATERIALS.exempt.includes(room.type) && !roomDef(room.type).excavationOnly;
}

/** The room's walls: its material and finish (bare rock when it has none, or can't have one). */
export function liningOf(room: RoomInstance): WallStep {
  return canLine(room) ? wallStep(room.material, room.finish) : MATERIALS.walls[0]!;
}

/** The room's floor upgrade, if any (null: it matches the walls). */
export function flooringOf(room: RoomInstance): FlooringDef | null {
  return canLine(room) ? flooringDef(room.flooring) : null;
}

/** What kind of room this is, for what its lining does. */
export function liningKind(type: string): LiningKind {
  const def = roomDef(type);
  const own = MATERIALS.byRoom[type];
  if (own) return own;
  if ((def.houses ?? 0) > 0) return "home";
  if (cleanable.cleanable.rooms.includes(type) || cleanable.cleanable.categories.includes(def.category)) return "people";
  return MATERIALS.byCategory[def.category] ?? "other";
}

/** The comfort the room's walls and floor give, before its kind is taken into account. */
function rawComfort(room: RoomInstance): number {
  return liningOf(room).comfort + (flooringOf(room)?.comfort ?? 0);
}

/** The comfort a home's lining gives its own residents (0 for any other room). */
export function liningComfort(room: RoomInstance): number {
  const kind = liningKind(room.type);
  return kind === "home" ? rawComfort(room) * MATERIALS.kinds.home.comfort : 0;
}

/** What a room's walls do to its wear: a multiplier on its daily decay. */
export function liningWear(room: RoomInstance): number {
  const benefit = MATERIALS.kinds[liningKind(room.type)].wearBenefit;
  return Math.max(MATERIALS.leastWear, 1 - (1 - liningOf(room).wear) * benefit);
}

/** Everyone's comfort from the linings of the people rooms they share: their average, scaled, up to the most. */
export function sharedLiningComfort(state: SimState): number {
  let sum = 0;
  let n = 0;
  for (const r of state.layout.rooms) {
    if (!isActive(r) || r.building || !canLine(r) || liningKind(r.type) !== "people") continue;
    sum += rawComfort(r) * MATERIALS.kinds.people.comfort;
    n++;
  }
  return n ? Math.min(MATERIALS.shared.max, (sum / n) * MATERIALS.shared.scale) : 0;
}

/** "Brick: comfort +0.5, wears 15% slower", for the room panel. */
export function liningText(room: RoomInstance): string {
  const walls = liningOf(room);
  const floor = flooringOf(room);
  const kind = liningKind(room.type);
  const comfort = kind === "home" || kind === "people" ? rawComfort(room) * MATERIALS.kinds[kind].comfort : 0;
  const slower = Math.round((1 - liningWear(room)) * 100);
  const gives = [
    comfort > 0 ? `comfort +${Math.round(comfort * 100) / 100}${kind === "people" ? " (shared)" : ""}` : "",
    slower > 0 ? `wears ${slower}% slower` : "",
  ].filter(Boolean);
  return `${walls.name}${floor ? `, ${floor.name.toLowerCase()} floor` : ""}${gives.length ? `: ${gives.join(", ")}` : ""}`;
}
