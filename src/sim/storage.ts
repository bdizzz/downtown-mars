import raw from "../../data/storage.json";
import type { RoomInstance } from "./placement";
import { resourceDefs } from "./resources";
import { roomDef } from "./rooms";
import type { SimState } from "./state";

// Storage for dry goods. Every storage room (and the landing pod) has so
// many units of space, shared out among the goods the player chooses for it;
// none by default. A hole can hold as much of a good as its rooms have
// allocated to it, and no more: the rest is lost, or never unloaded.
// Water, air, waste and power keep their own storage (tanks, batteries,
// a base capacity).

export const storage = raw as unknown as { unlimited: boolean; groups: string[]; except: string[] };

/** Goods that live in storage rooms. */
export const STORABLE = resourceDefs.filter((r) => storage.groups.includes(r.group) && !storage.except.includes(r.id)).map((r) => r.id);
const storable = new Set(STORABLE);

export function isStorable(id: string): boolean {
  return storable.has(id);
}

/** A room's storage space, in units. */
export function spaceOf(room: RoomInstance): number {
  return room.storageUnits ?? roomDef(room.type).storage ?? 0;
}

/** How much of each good a room holds space for. */
export function allocationOf(room: RoomInstance): Record<string, number> {
  return room.allocation ?? {};
}

export function allocated(room: RoomInstance): number {
  return Object.values(allocationOf(room)).reduce((a, b) => a + b, 0);
}

/** A room counts once it's built. */
const holds = (room: RoomInstance) => !room.planned && !room.building && spaceOf(room) > 0;

/** The hole's capacity for each storable good: the sum of what its storage rooms allocate to it. */
export function storageCaps(state: SimState): Record<string, number> {
  const caps: Record<string, number> = {};
  for (const id of STORABLE) caps[id] = storage.unlimited ? Infinity : 0;
  if (storage.unlimited) return caps;
  for (const room of state.layout.rooms) {
    if (!holds(room)) continue;
    for (const [id, units] of Object.entries(allocationOf(room))) if (storable.has(id)) caps[id] = (caps[id] ?? 0) + units;
  }
  return caps;
}

/** How full a room is: its share of the hole's stock of each good it holds space for. */
export function roomFill(state: SimState, room: RoomInstance): { units: number; byGood: Record<string, number> } {
  const caps = storageCaps(state);
  const byGood: Record<string, number> = {};
  let units = 0;
  for (const [id, space] of Object.entries(allocationOf(room))) {
    const cap = caps[id] ?? 0;
    const share = cap > 0 && Number.isFinite(cap) ? Math.min(space, ((state.resources[id] ?? 0) * space) / cap) : 0;
    byGood[id] = share;
    units += share;
  }
  return { units, byGood };
}

/** Why this allocation can't be set on this room, or null if it can. */
export function allocationRefusal(room: RoomInstance, allocation: Record<string, number>): string | null {
  const space = spaceOf(room);
  if (!space) return `The ${roomDef(room.type).name.toLowerCase()} doesn't store goods`;
  let total = 0;
  for (const [id, units] of Object.entries(allocation)) {
    if (!storable.has(id)) return `${id} doesn't go in storage rooms`;
    if (!(units >= 0) || !Number.isFinite(units)) return "Space must be zero or more";
    total += units;
  }
  if (total > space + 1e-9) return `It only holds ${space}`;
  return null;
}
