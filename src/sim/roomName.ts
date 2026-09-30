import type { RoomInstance } from "./placement";
import { cropDef, isCrop } from "./resources";
import { roomDef } from "./rooms";

// What a room is called: the player's own name for it if they've given one;
// otherwise a farm goes by what it grows ("Potato farm"), and anything else
// by its kind ("Galley").

/** Longest name a player can give a room. */
export const ROOM_NAME_MAX = 32;

export function roomName(room: RoomInstance): string {
  if (room.name) return room.name;
  const def = roomDef(room.type);
  const crop = def.growsCrops ? (room.crop ?? def.defaultCrop) : undefined;
  if (crop && isCrop(crop)) return cropDef(crop).farmName;
  return def.name;
}

/** A room's label on the map views: its own name, a farm's crop, or its kind's short name ("Dorm"). */
export function roomLabel(room: RoomInstance): string {
  if (room.name) return room.name;
  const def = roomDef(room.type);
  const crop = def.growsCrops ? (room.crop ?? def.defaultCrop) : undefined;
  if (crop && isCrop(crop)) return cropDef(crop).farmName;
  return def.short;
}

/** The floor a room is on (its top floor), or null on the surface. */
export function roomFloor(room: RoomInstance): number | null {
  return room.at.kind === "ring" ? room.at.floor : null;
}

/**
 * A room named in a message: a token the UI shows as the room's name with its
 * floor badge (and as it's named now, if renamed since). The name and floor
 * travel with it, for when the room is gone.
 */
export function roomRef(room: RoomInstance): string {
  const floor = roomFloor(room);
  return `[[room:${room.id}|${roomName(room).replace(/[|\]]/g, "")}|${floor ?? "S"}]]`;
}
