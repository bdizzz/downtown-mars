import { CONDITION, conditionOf } from "../sim/condition";
import type { RoomInstance } from "../sim/placement";
import { roomFloor, roomName } from "../sim/roomName";
import { roomDef } from "../sim/rooms";
import type { Snapshot } from "../sim/snapshot";
import { CATEGORY_NAMES, CATEGORY_ORDER } from "./buildCatalog";
import { SIZE_NAMES } from "./roomCard";
import { isProblem, limitText } from "./roomState";
import { troubleOf } from "./roomTrouble";

// The floor directory (Charts → Directory, T-149): every floor from the surface
// down, and the rooms on each, with a dot for how each is doing. Built here, out
// of React, so the Godot viewer can list it the same way later.

/** How a room is doing, as the directory's dot: fine, building, worn, or stalled. */
export type DirStatus = "ok" | "building" | "worn" | "stalled";

export interface DirRoom {
  id: number;
  name: string;
  /** Its kind's category ("food"), for the filter. */
  category: string;
  size: string;
  status: DirStatus;
  /** What the dot means, in words ("" when fine). */
  why: string;
}

export interface DirFloor {
  /** null: the surface. */
  floor: number | null;
  rooms: DirRoom[];
}

export interface DirFilter {
  /** A category id, or null for every kind. */
  category: string | null;
  /** Only rooms with a problem (worn or stalled). */
  problems: boolean;
  /** Part of a room's name, matched case-blind; "" matches all. */
  text: string;
}

export const NO_FILTER: DirFilter = { category: null, problems: false, text: "" };

/** A room's dot: building first, then stalled (stopped or short of something), then worn. */
export function dirStatus(s: Snapshot, room: RoomInstance): { status: DirStatus; why: string } {
  if (room.planned) return { status: "building", why: "Blueprint: builds when its floor is dug" };
  if (room.building) return { status: "building", why: "Under construction" };
  if (!room.connected) return { status: "stalled", why: "Cut off: no way in" };
  const st = s.roomStatus[room.id];
  // Slowed by wear counts as worn, below; anything else holding it back is a stall.
  const trouble = troubleOf(st);
  if (st?.limit !== "worn" && (trouble.level === "bad" || trouble.level === "warn" || isProblem(room, st))) return { status: "stalled", why: limitText(st?.limit) || "Running slow" };
  const c = s.conditions[room.id] ?? conditionOf(room);
  if (c < CONDITION.unhappyBelow) return { status: "worn", why: `Worn: ${Math.round(c * 100)}% condition` };
  return { status: "ok", why: "" };
}

/** Each floor that has rooms, the surface first and then down, rooms in ring and slot order. */
export function directory(s: Snapshot, filter: DirFilter = NO_FILTER): DirFloor[] {
  const text = filter.text.trim().toLowerCase();
  const floors = new Map<number | null, { room: RoomInstance; row: DirRoom }[]>();
  for (const room of s.layout.rooms) {
    const def = roomDef(room.type);
    const name = roomName(room);
    const { status, why } = dirStatus(s, room);
    if (filter.category && def.category !== filter.category) continue;
    if (filter.problems && status !== "worn" && status !== "stalled") continue;
    if (text && !name.toLowerCase().includes(text) && !def.name.toLowerCase().includes(text)) continue;
    const f = roomFloor(room);
    const list = floors.get(f) ?? [];
    list.push({ room, row: { id: room.id, name, category: def.category, size: SIZE_NAMES[def.size] ?? def.size, status, why } });
    floors.set(f, list);
  }
  const key = (r: RoomInstance) => (r.at.kind === "ring" ? r.at.ring * 1000 + r.at.slot : r.at.slot);
  return [...floors.entries()]
    .sort(([a], [b]) => (a ?? 0) - (b ?? 0))
    .map(([floor, list]) => ({ floor, rooms: list.sort((a, b) => key(a.room) - key(b.room) || a.room.id - b.room.id).map((x) => x.row) }));
}

/** The kinds of room the hole has, in the build palette's order, for the filter. */
export function directoryCategories(s: Snapshot): { id: string; name: string }[] {
  const have = new Set(s.layout.rooms.map((r) => roomDef(r.type).category));
  return CATEGORY_ORDER.filter((c) => have.has(c)).map((id) => ({ id, name: CATEGORY_NAMES[id] ?? id }));
}
