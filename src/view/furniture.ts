import raw from "../../data/furniture.json";
import { roomDef } from "../sim/rooms";

// The furniture catalogue (data/furniture.json): code-built low-poly items,
// and which items each room type may hold. Pure data and helpers, no
// Three.js, so layouts can be fitted and tested without a renderer.

export type PartShape = "box" | "cyl" | "sph";

export interface Part {
  s: PartShape;
  /** Centre, metres: x across the item, y up from the floor, z out from its back (−z) to its front (+z). */
  p: [number, number, number];
  /** Box [x, y, z]; cylinder [diameter, height]; sphere [diameter]. */
  z: number[];
  /** A colour name from the catalogue, or "accent" for the room's category colour. */
  c: string;
  /** Rotation in degrees [x, y, z]. */
  r?: [number, number, number];
  /** Lights up at night. */
  glow?: boolean;
}

export interface ItemDef {
  name: string;
  /** Width (x), depth (z), height (y), metres. The footprint is centred on the item's origin. */
  size: [number, number, number];
  parts: Part[];
  /** Hung on a wall: how high its bottom is above the floor, metres. */
  mount?: number;
  /** A hole in the floor (a stair well), not something standing on it: it takes no floor space. */
  opening?: boolean;
  /** A flight of stairs: walked up from its foot (its front) to its head, a floor higher. */
  climb?: boolean;
  /** It gives light: its colour, where from (in its own frame), how far it reaches (metres), and how strong. */
  light?: { color: string; at: [number, number, number]; reach: number; strength: number };
  /** Where people go: a seat, a bed or a work post, in its own frame, and which way they face (degrees; 0 is its front). */
  spots?: { kind: "seat" | "bed" | "post"; at: [number, number, number]; turn?: number }[];
}

export const furniture = raw as unknown as {
  colors: Record<string, string>;
  items: Record<string, ItemDef>;
  rooms: Record<string, string[]>;
};

export function itemDef(id: string): ItemDef {
  const def = furniture.items[id];
  if (!def) throw new Error(`unknown furniture item "${id}"`);
  return def;
}

/** A wall hanging (a painting, a lamp, a readout): hung at a height, not standing on the floor. */
export function isMounted(id: string): boolean {
  return (itemDef(id).mount ?? 0) > 0;
}

export function isItem(id: string): boolean {
  return id in furniture.items;
}

/** The items a room type may hold (none for rooms that aren't furnished). */
export function itemsFor(roomType: string): string[] {
  return furniture.rooms[roomType] ?? [];
}

/** Rooms that get furniture: built inside the hole, and not an empty room (which leaves only empty space). Stairs and elevators are furnished floor by floor. */
export function isFurnished(roomType: string): boolean {
  const def = roomDef(roomType);
  return def.size !== "surface" && !def.excavationOnly;
}

/** A part's colour as a hex string: its named colour, or the room's accent. */
export function partColor(part: Part, accent: string): string {
  return part.c === "accent" ? accent : (furniture.colors[part.c] ?? "#ff00ff");
}

/** A part's extent before rotation, as half-sizes [x, y, z]. */
export function partHalf(part: Part): [number, number, number] {
  if (part.s === "box") return [part.z[0]! / 2, part.z[1]! / 2, part.z[2]! / 2];
  if (part.s === "cyl") return [part.z[0]! / 2, part.z[1]! / 2, part.z[0]! / 2];
  return [part.z[0]! / 2, part.z[0]! / 2, part.z[0]! / 2];
}

/** The half-sizes of the box around a part once rotated (Euler XYZ, as Three.js): |R| times its own half-sizes. */
export function partBounds(part: Part): [number, number, number] {
  const h = partHalf(part);
  if (!part.r) return h;
  const [rx, ry, rz] = part.r.map((a) => (a * Math.PI) / 180) as [number, number, number];
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(rx), Math.sin(rx), Math.cos(ry), Math.sin(ry), Math.cos(rz), Math.sin(rz)];
  const R = [
    [cy * cz, -cy * sz, sy],
    [cx * sz + sx * sy * cz, cx * cz - sx * sy * sz, -sx * cy],
    [sx * sz - cx * sy * cz, sx * cz + cx * sy * sz, cx * cy],
  ];
  return R.map((row) => row.reduce((n, v, j) => n + Math.abs(v) * h[j]!, 0)) as [number, number, number];
}
