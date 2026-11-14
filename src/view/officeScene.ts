import raw from "../../data/office.json";
import { flooringOf } from "../sim/materials";
import type { Layout } from "../sim/placement";
import type { Placed } from "./furnish";
import { itemDef } from "./furniture";
import { roomLook, type Finish } from "./roomFinish";

// The office scene: what stands in the administrator's office, shown as a still 3D room in place
// of the hole while the office panel is open (render3d/office3d.ts draws it). The room, the camera
// and every piece are in data/office.json. The furniture that's always there is its `base`; the
// rest are keepsakes, each of which turns up once the hole has a finished room of the right kind,
// so the office fills as the hole grows. Its walls and floor are the admin office's own (bare rock
// until one is built). Pure data and helpers, no Three.js, so it can be tested without a renderer.

type Wall = "back" | "left" | "right" | "floor";

/** One piece, as data/office.json writes it (see its `_about`). */
export interface OfficePlacement {
  item: string;
  wall: Wall;
  /** Against a wall: where along it (x for the back wall, z for the side walls), and how far out from it. */
  along?: number;
  out?: number;
  /** On the floor: where, and which way it faces (degrees; 0 faces the camera). */
  x?: number;
  z?: number;
  turn?: number;
  /** A wall hanging: metres above its usual height. */
  lift?: number;
}

export interface Keepsake {
  name: string;
  /** Room types: a finished one of any of them brings it. */
  rooms: string[];
  items: OfficePlacement[];
}

export const office = raw as unknown as {
  room: { width: number; depth: number; height: number; front: number; wallGap: number };
  camera: { at: [number, number, number]; look: [number, number, number]; fov: number; aspect: number };
  lights: {
    sky: string;
    ground: string;
    fill: number;
    ambient: number;
    key: { color: string; strength: number; at: [number, number, number]; shadowMap: number };
    lamps: { strength: number; reach: number };
    exposure: number;
    background: string;
  };
  base: OfficePlacement[];
  keepsakes: Keepsake[];
};

const RAD = Math.PI / 180;

/** A piece's place in the room's frame: against its wall (by its own depth), or where it's put on the floor. */
export function placeInOffice(p: OfficePlacement): Placed {
  const def = itemDef(p.item);
  const { width, depth, wallGap } = office.room;
  const off = def.size[1] / 2 + wallGap + (p.out ?? 0);
  const y = def.mount !== undefined ? def.mount + (p.lift ?? 0) : 0;
  if (p.wall === "back") return { item: p.item, x: p.along ?? 0, y, z: -depth / 2 + off, turn: 0 };
  if (p.wall === "left") return { item: p.item, x: -width / 2 + off, y, z: p.along ?? 0, turn: 90 * RAD };
  if (p.wall === "right") return { item: p.item, x: width / 2 - off, y, z: p.along ?? 0, turn: -90 * RAD };
  return { item: p.item, x: p.x ?? 0, y, z: p.z ?? 0, turn: (p.turn ?? 0) * RAD };
}

/** The room types the hole has finished rooms of (not plans, not ones still in the construction queue). */
export function builtRoomTypes(layout: Pick<Layout, "rooms">): Set<string> {
  return new Set(layout.rooms.filter((r) => !r.planned && !r.building).map((r) => r.type));
}

/** The keepsakes a hole with these kinds of room has earned, in the catalogue's order. */
export function keepsakesFor(types: ReadonlySet<string>): Keepsake[] {
  return office.keepsakes.filter((k) => k.rooms.some((t) => types.has(t)));
}

/** What the office looks like for a hole: its walls and floor, and everything standing in it. */
export interface OfficeLook {
  /** What the walls and floor are made of: the admin office's lining, or bare rock without one. */
  finish: Finish;
  /** A floor upgrade laid in the admin office (data/materials.json floorings), if any. */
  flooring: string | null;
  items: Placed[];
  /** The keepsakes on show, by name. */
  keepsakes: string[];
  /** Changes when anything drawn does. */
  key: string;
}

export function officeLook(layout: Pick<Layout, "rooms">): OfficeLook {
  const types = builtRoomTypes(layout);
  const admin = layout.rooms.find((r) => r.type === "admin_office" && !r.planned && !r.building);
  const finish: Finish = admin ? roomLook(admin) : "rock";
  const flooring = admin ? (flooringOf(admin)?.id ?? null) : null;
  const earned = keepsakesFor(types);
  const items = [...office.base, ...earned.flatMap((k) => k.items)].map(placeInOffice);
  const keepsakes = earned.map((k) => k.name);
  return { finish, flooring, items, keepsakes, key: `${finish}|${flooring ?? ""}|${keepsakes.join(",")}` };
}

/** The box a placed piece fills in the room's frame: [x0, x1], [y0, y1], [z0, z1]. */
export function officeBox(p: Placed): [[number, number], [number, number], [number, number]] {
  const [w, d, h] = itemDef(p.item).size;
  const c = Math.abs(Math.cos(p.turn));
  const s = Math.abs(Math.sin(p.turn));
  const hx = (w * c + d * s) / 2;
  const hz = (w * s + d * c) / 2;
  return [
    [p.x - hx, p.x + hx],
    [p.y, p.y + h],
    [p.z - hz, p.z + hz],
  ];
}
