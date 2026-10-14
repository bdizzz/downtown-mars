import raw from "../../data/storage.json";
import { LABELS, record } from "./ledger";
import { takeMade } from "./origins";
import { distancesFrom, pathsFor } from "./paths";
import type { Layout, RoomInstance } from "./placement";
import { resourceDefs } from "./resources";
import { roomDef } from "./rooms";
import type { SimState } from "./state";

// Storage for dry goods. Every storage room (and the landing pod) has so
// many units of space and a list of the goods it allows (everything, unless
// the player says otherwise). The space isn't shared out in advance: goods
// take it first come, first served, each going to the allowing room nearest
// to where it was made, then the next nearest. What finds no room is lost.
// Each room keeps its own contents; the hole's stock of a good is the sum.
// Water, air, waste and power keep their own storage (tanks, batteries,
// a base capacity).

export const storage = raw as unknown as { unlimited: boolean; groups: string[]; except: string[] };

/** Goods that live in storage rooms. */
export const STORABLE = resourceDefs.filter((r) => storage.groups.includes(r.group) && !storage.except.includes(r.id)).map((r) => r.id);
const storable = new Set(STORABLE);

/** Below this, an amount is nothing (rounding left over from many small moves). */
const EPS = 1e-9;

export function isStorable(id: string): boolean {
  return storable.has(id);
}

/** A room's storage space, in units. */
export function spaceOf(room: RoomInstance): number {
  return room.storageUnits ?? roomDef(room.type).storage ?? 0;
}

/** Whether a room takes in this good: everything, unless the player has chosen. */
export function allows(room: RoomInstance, id: string): boolean {
  return !room.allows || room.allows.includes(id);
}

/** What a room holds now, by good. */
export function contentsOf(room: RoomInstance): Record<string, number> {
  return room.contents ?? {};
}

/** Units of a room's space in use. */
export function usedSpace(room: RoomInstance): number {
  return Object.values(contentsOf(room)).reduce((a, b) => a + b, 0);
}

export function freeSpace(room: RoomInstance): number {
  return Math.max(0, spaceOf(room) - usedSpace(room));
}

/** A room counts once it's built. */
const holds = (room: RoomInstance) => !room.planned && !room.building && spaceOf(room) > 0;

/** The hole's storage rooms. */
export function storageRooms(layout: Layout): RoomInstance[] {
  return layout.rooms.filter(holds);
}

/** How much of each good the storage rooms hold now. */
export function storedTotals(state: SimState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const room of state.layout.rooms) for (const [id, v] of Object.entries(contentsOf(room))) out[id] = (out[id] ?? 0) + v;
  return out;
}

/**
 * The hole's capacity for each storable good: what's stored of it, plus the
 * free space in the rooms that allow it. Goods share that free space, so the
 * capacities overlap; storage settles who gets it at the end of the tick.
 */
export function storageCaps(state: SimState): Record<string, number> {
  const caps: Record<string, number> = {};
  for (const id of STORABLE) caps[id] = storage.unlimited ? Infinity : 0;
  if (storage.unlimited) return caps;
  const stored = storedTotals(state);
  for (const id of STORABLE) caps[id] = stored[id] ?? 0;
  for (const room of storageRooms(state.layout)) {
    const free = freeSpace(room);
    if (free > 0) for (const id of STORABLE) if (allows(room, id)) caps[id]! += free;
  }
  return caps;
}

/** How full a room is: what it holds, in all and by good. */
export function roomFill(_state: SimState, room: RoomInstance): { units: number; byGood: Record<string, number> } {
  const byGood = { ...contentsOf(room) };
  return { units: usedSpace(room), byGood };
}

/** Why this room can't be set to allow these goods, or null if it can. */
export function allowsRefusal(room: RoomInstance, ids: string[]): string | null {
  if (!spaceOf(room)) return `The ${roomDef(room.type).name.toLowerCase()} doesn't store goods`;
  const bad = ids.find((id) => !storable.has(id));
  return bad ? `${bad} doesn't go in storage rooms` : null;
}

/** Set what a room allows; everything storable is stored as "everything". */
export function setAllows(room: RoomInstance, ids: string[]): void {
  const set = new Set(ids);
  if (STORABLE.every((id) => set.has(id))) delete room.allows;
  else room.allows = STORABLE.filter((id) => set.has(id));
}

// ---- distances ----

const dists = new WeakMap<Layout, { version: number; from: Map<number, Map<number, number>> }>();

/** Where goods come in from outside: the cargo lift if there is one, else the entrance, else the pod. */
function door(layout: Layout): RoomInstance | undefined {
  const built = layout.rooms.filter((r) => !r.planned && !r.building);
  return (
    built.find((r) => roomDef(r.type).cargoShaft) ??
    built.find((r) => r.at.kind === "ring" && roomDef(r.type).surfaceLink) ??
    built.find((r) => r.at.kind === "surface")
  );
}

/** A surface room (the pod) is reached through the entrance. */
function onFoot(layout: Layout, room: RoomInstance): number {
  if (room.at.kind !== "surface") return room.id;
  const entrance = layout.rooms.find((r) => r.at.kind === "ring" && roomDef(r.type).surfaceLink && !roomDef(r.type).cargoShaft);
  return entrance?.id ?? room.id;
}

/** Metres on foot between two rooms (Infinity with no way between). */
function metres(layout: Layout, from: RoomInstance, to: RoomInstance): number {
  if (from.id === to.id) return 0;
  const a = onFoot(layout, from);
  const b = onFoot(layout, to);
  if (a === b) return 0;
  let hit = dists.get(layout);
  if (!hit || hit.version !== layout.version) {
    hit = { version: layout.version, from: new Map() };
    dists.set(layout, hit);
  }
  let d = hit.from.get(a);
  if (!d) {
    d = distancesFrom(pathsFor(layout), a, "walk");
    hit.from.set(a, d);
  }
  return d.get(b) ?? Infinity;
}

/** The storage rooms, nearest to `from` first (ties, and rooms with no way there, by id). */
function nearestFirst(layout: Layout, rooms: RoomInstance[], from: RoomInstance | undefined): RoomInstance[] {
  if (!from) return [...rooms].sort((a, b) => a.id - b.id);
  const d = new Map(rooms.map((r) => [r.id, metres(layout, from, r)]));
  return [...rooms].sort((a, b) => d.get(a.id)! - d.get(b.id)! || a.id - b.id);
}

/** Put up to `amount` of a good into the allowing rooms nearest `from`; returns what found no room. */
function placeNear(layout: Layout, rooms: RoomInstance[], id: string, amount: number, from: RoomInstance | undefined, moving = false): number {
  let left = amount;
  for (const room of nearestFirst(layout, rooms, from)) {
    if (left <= EPS) break;
    if ((moving && room.id === from?.id) || !allows(room, id)) continue;
    const take = Math.min(left, freeSpace(room));
    if (take <= 0) continue;
    room.contents = { ...contentsOf(room), [id]: (room.contents?.[id] ?? 0) + take };
    left -= take;
  }
  return Math.max(0, left);
}

function takeOut(room: RoomInstance, id: string, amount: number): void {
  const next = { ...contentsOf(room) };
  const v = (next[id] ?? 0) - amount;
  if (v > EPS) next[id] = v;
  else delete next[id];
  if (Object.keys(next).length) room.contents = next;
  else delete room.contents;
}

/**
 * Bring the storage rooms in line with the hole's stock, once a tick. What
 * was used comes out of the rooms (those that no longer allow it first); what
 * arrived goes in, nearest to where it was made (or the door, for deliveries
 * and the drill); goods a room no longer allows move out as space allows.
 * Past the space there is (and any the console made), the rest is lost.
 */
export function settleStorage(state: SimState): void {
  const made = takeMade(state);
  if (storage.unlimited) return;
  const layout = state.layout;
  const rooms = storageRooms(layout);
  const byId = new Map(layout.rooms.map((r) => [r.id, r]));
  // A room that's gone (demolished, say) takes nothing with it: its goods arrive again.
  for (const room of layout.rooms) if (room.contents && !holds(room)) delete room.contents;
  const stored = storedTotals(state);
  const entry = door(layout);

  for (const id of STORABLE) {
    const have = state.resources[id] ?? 0;
    let diff = have - (stored[id] ?? 0);
    if (diff < -EPS) {
      // Used: from rooms that don't allow it first, then evenly from the rest.
      let left = -diff;
      for (const room of rooms) {
        if (allows(room, id) || left <= EPS) continue;
        const take = Math.min(left, contentsOf(room)[id] ?? 0);
        if (take > 0) takeOut(room, id, take);
        left -= take;
      }
      const holding = rooms.filter((r) => (contentsOf(r)[id] ?? 0) > 0);
      const total = holding.reduce((n, r) => n + contentsOf(r)[id]!, 0);
      if (total > 0 && left > EPS) for (const room of holding) takeOut(room, id, Math.min(contentsOf(room)[id]!, (left * contentsOf(room)[id]!) / total));
      continue;
    }
    if (diff <= EPS) continue;
    // Arrived: each maker's share to the rooms nearest it, the rest from the door.
    const makers = made.get(id);
    const madeTotal = makers ? [...makers.values()].reduce((a, b) => a + b, 0) : 0;
    let lost = 0;
    if (makers && madeTotal > 0) {
      const scale = Math.min(1, diff / madeTotal);
      for (const [roomId, amount] of makers) lost += placeNear(layout, rooms, id, amount * scale, byId.get(roomId));
      diff -= madeTotal * scale;
    }
    if (diff > EPS) lost += placeNear(layout, rooms, id, diff, entry);
    // The console's extra room keeps what it gave; the rest is thrown away.
    const keep = Math.min(lost, Math.max(0, state.consoleSpace?.[id] ?? 0));
    if (lost - keep > EPS) {
      record(state, id, "out", LABELS.lost, lost - keep);
      state.resources[id] = have - (lost - keep);
    }
  }

  // Goods a room no longer allows move to rooms that do, nearest first.
  for (const room of rooms) {
    for (const [id, v] of Object.entries(contentsOf(room))) {
      if (allows(room, id)) continue;
      const left = placeNear(layout, rooms, id, v, room, true);
      if (left < v - EPS) takeOut(room, id, v - left);
    }
  }
}
