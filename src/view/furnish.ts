import raw from "../../data/layouts.json";
import { corridors } from "../sim/corridors";
import { edgeById } from "../sim/edges";
import type { Cell, Layout, RoomInstance } from "../sim/placement";
import { roomDef } from "../sim/rooms";
import { floorSpan, ringRadii, slotAngles } from "../render3d/cylinder";
import { doorways } from "./doors";
import { isFurnished, isMounted, itemDef } from "./furniture";

// Laying furniture out in a room. A template (data/layouts.json) is a list of
// placements for one room type and shape, in priority order. Each is pinned
// to a wall (back, front, left, right) or the room's centre, with offsets in
// metres, so it keeps its size and stays against its wall as the room
// stretches from ring 1 to ring 6. Items that don't fit (outside the walls,
// too close to another, in the doorway, or past the crowding cap) are left
// out, and the rest carry on. No Three.js here: it's tested on its own.

export type Wall = "back" | "front" | "left" | "right" | "center";

export interface Placement {
  item: string;
  wall: Wall;
  /**
   * Along the wall from its middle, metres. Front, back and centre: toward
   * larger angles (clockwise seen from above). Left and right: toward the back.
   */
  x?: number;
  /** Out from the wall to the item's back, metres. Centre: from the room's middle toward the back. */
  y?: number;
  /** An extra turn, degrees, on top of facing away from the wall (the centre faces the front). */
  turn?: number;
  /** Repeat along the wall every so many metres (out from x both ways), up to max copies. */
  repeat?: { every: number; max?: number };
  /** Goes with its neighbours (chairs at a desk, stools at a table): it only has to not overlap them, not keep an aisle. */
  snug?: boolean;
}

export type Template = Placement[];

/** A placed item: where its footprint's centre stands and which way its front faces (radians about y; 0 faces +z). */
export interface Placed {
  item: string;
  x: number;
  y: number;
  z: number;
  turn: number;
}

/** A placed item with what the editor needs: which placement made it, and its footprint's corners on the floor. */
export interface Fitted extends Placed {
  placement: number;
  corners: [number, number][];
  /** The wall its placement is against (or the centre). */
  wall: Wall;
  /** The floor it's on. */
  floor: number;
}

export const layouts = raw as unknown as { templates: Record<string, Template> };

/** Fitting rules. */
export const FIT = {
  /** Kept clear between an item and a wall. */
  wallGap: 0.15,
  /** Kept clear between two items: room to walk. */
  aisle: 0.5,
  /** Kept between a snug item (a chair at its desk) and its neighbours. */
  snug: 0.05,
  /** Kept between copies in one repeated row (planters, racks, tables): a row can stand closer than the aisle. */
  row: 0.3,
  /** The doorway kept clear on a ring-1 room's shaft face: width along the wall, depth into the room. */
  door: { width: 1.8, depth: 1.6 },
  /** Items stop once their footprints cover this share of the floor. */
  crowding: 0.35,
  /** The most copies a repeat makes, if its placement doesn't say. */
  maxRepeat: 12,
  /** Items no taller than this (rugs) lie on the floor: others stand on them, and they don't count toward crowding. */
  flat: 0.1,
  /** Furniture stands this far above the floor: models dip up to 3 cm below their base, and must not show through the floor from below. */
  lift: 0.035,
  /** Kept between two wall hangings. */
  hangingGap: 0.25,
  /** How far off the wall a hanging's back is, so the two never share a plane. */
  hangingOff: 0.01,
};

export const isFlat = (item: string) => itemDef(item).size[2] <= FIT.flat;

/** What a room gives up on a side: half a corridor where one runs, else the walls' hairline (as in 3D). */
const HALL = corridors.widthM / 2;
const INSET = 0.06;

/** A room's floor as furniture sees it: an annular sector with walls, on one floor. */
export interface Frame {
  y: number;
  rIn: number;
  rOut: number;
  /** Angles of the left and right walls at radius r (they stand parallel to their borders). */
  left: (r: number) => number;
  right: (r: number) => number;
  /** The borders' angles, and how far the left and right walls stand from them (metres): each wall is the straight line that far in. */
  a0: number;
  a1: number;
  dLeft: number;
  dRight: number;
  /** The doorway on the front wall, if any: its angle. */
  door: number | null;
  area: number;
  /** The floor it's on. */
  floor: number;
  /**
   * Which walls stand solid, for hanging things on: not a public room's open
   * sides (onto the gallery or a corridor), nor ring 1's glass front.
   */
  solid: Record<"back" | "front" | "left" | "right", boolean>;
}

const key = (c: Cell) => `${c.floor}:${c.ring}:${c.slot}`;

/**
 * A room's frame on one of its floors (by default the one it's furnished on:
 * its own, or a cargo elevator's stop), or null for rooms that aren't
 * furnished (or not in a ring).
 */
export function frameOf(layout: Layout, room: RoomInstance, onFloor?: number): Frame | null {
  if (room.at.kind !== "ring" || !isFurnished(room.type)) return null;
  const hole = layout.hole;
  const floor = onFloor ?? (roomDef(room.type).cargoShaft ? Math.max(...room.cells.map((c) => c.floor)) : room.at.floor);
  const cells = room.cells.filter((c) => c.floor === floor);
  const own = new Set(cells.map(key));
  const rings = cells.map((c) => c.ring);
  const inner = Math.min(...rings);
  const outer = Math.max(...rings);
  const n = hole.ringSlots[room.at.ring - 1]!;
  const a0 = slotAngles(room.at.slot, n)[0];
  const a1 = a0 + (room.at.w / n) * Math.PI * 2;
  // What runs along each side: a corridor pulls that wall back by half its width.
  const hall = (id: string) => !!layout.corridors?.[id];
  let left = INSET;
  let right = INSET;
  let front = INSET;
  let back = INSET;
  for (const c of cells) {
    const m = hole.ringSlots[c.ring - 1]!;
    if (!own.has(key({ ...c, slot: (c.slot - 1 + m) % m })) && hall(`R${floor}.${c.ring}.${c.slot}`)) left = HALL;
    if (!own.has(key({ ...c, slot: (c.slot + 1) % m })) && hall(`R${floor}.${c.ring}.${(c.slot + 1) % m}`)) right = HALL;
  }
  for (const id of Object.keys(layout.corridors ?? {})) {
    const e = id.startsWith(`A${floor}.`) ? edgeById(hole, id) : null;
    if (!e || e.kind !== "arc" || !overlaps(e.a0 * TAU, e.a1 * TAU, a0, a1)) continue;
    if (e.circle === inner - 1) front = HALL;
    if (e.circle === outer) back = HALL;
  }
  const g = FIT.wallGap;
  const rIn = ringRadii(hole, inner)[0] + front + g;
  const rOut = ringRadii(hole, outer)[1] - back - g;
  const side = (d: number, r: number) => Math.asin(Math.min(0.99, d / r));
  // The door on this floor, if it has one (as the 3D view cuts it).
  const door = doorways(layout, room).find((d) => d.floor === floor)?.angle ?? null;
  const open = !!roomDef(room.type).public;
  return {
    // On the room's floor, which stands the walls' hairline above the floor's base (as the 3D view draws it).
    y: floorSpan(floor)[0] + INSET,
    rIn,
    rOut,
    left: (r) => a0 + side(left + g, r),
    right: (r) => a1 - side(right + g, r),
    a0,
    a1,
    dLeft: left + g,
    dRight: right + g,
    door: door === null ? null : unwrap(door, a0),
    area: ((rOut * rOut - rIn * rIn) / 2) * (a1 - a0),
    floor,
    solid: {
      // Ring 1's front is the shaft face: glass on a private room, nothing at all on a public one.
      front: inner > 1 && !(open && front === HALL),
      back: !(open && back === HALL),
      left: !(open && left === HALL),
      right: !(open && right === HALL),
    },
  };
}

/** Do two angle ranges (radians, each start ≤ end) overlap, allowing for wrapping past a full turn? */
function overlaps(b0: number, b1: number, a0: number, a1: number): boolean {
  const s = unwrap(b0, a0);
  // It starts inside [a0, a1), or it starts before a0 (a turn back) and runs past it.
  return s < a1 - 1e-9 || s - TAU + (b1 - b0) > a0 + 1e-9;
}

const TAU = Math.PI * 2;

/** An angle brought to within one turn at or above a0, so ranges that wrap past 0 compare simply. */
function unwrap(a: number, a0: number): number {
  return a0 + ((((a - a0) % TAU) + TAU) % TAU);
}

/** How deep an item stands out from its wall once turned: a bed turned head-to-wall reaches out by its length. */
function depthOf(p: Placement): number {
  const [w, d] = itemDef(p.item).size;
  const t = ((p.turn ?? 0) * Math.PI) / 180;
  return Math.abs(Math.cos(t)) * d + Math.abs(Math.sin(t)) * w;
}

/** Where a placement (with repeat offset dx) puts an item: its centre on the floor, facing, and footprint corners. */
export function place(frame: Frame, p: Placement, dx = 0): Omit<Fitted, "placement"> {
  // The item's own size (for its footprint, which turns with it), and how far it stands out from its wall.
  const [w, dItem] = itemDef(p.item).size;
  const d = depthOf(p);
  const x = (p.x ?? 0) + dx;
  const y = p.y ?? 0;
  const mid = (r: number) => (frame.left(r) + frame.right(r)) / 2;
  const rMid = (frame.rIn + frame.rOut) / 2;
  let r: number;
  let a: number;
  // Which way the item's front faces, in the room's terms: out (+r), in (−r), or round (±angle).
  let face: "in" | "out";
  if (p.wall === "back") {
    // The back wall curves away from a straight item: set it in until its back corners touch the curve.
    r = Math.sqrt(frame.rOut * frame.rOut - (w * w) / 4) - y - d / 2;
    a = mid(r) + x / r;
    face = "in";
  } else if (p.wall === "front") {
    r = frame.rIn + y + d / 2;
    a = mid(r) + x / r;
    face = "out";
  } else if (p.wall === "left" || p.wall === "right") {
    // Side walls are straight, parallel to their borders: stand the item against the line itself.
    const left = p.wall === "left";
    const b = left ? frame.a0 : frame.a1;
    const u: [number, number] = [Math.cos(b), Math.sin(b)];
    // Into the room from the border: toward larger angles on the left, smaller on the right.
    const n: [number, number] = left ? [-u[1], u[0]] : [u[1], -u[0]];
    const out = (left ? frame.dLeft : frame.dRight) + y + d / 2;
    const along = rMid + x;
    const cx = along * u[0] + out * n[0];
    const cz = along * u[1] + out * n[1];
    return finish(p, cx, cz, n, frame, w, dItem);
  } else {
    r = rMid + y;
    a = mid(r) + x / r;
    face = "in";
  }
  // Facing as a direction on the floor: out or in along the radius.
  const radial: [number, number] = [Math.cos(a), Math.sin(a)];
  return finish(p, r * Math.cos(a), r * Math.sin(a), face === "out" ? radial : [-radial[0], -radial[1]], frame, w, dItem);
}

/** An item centred at (px, pz) facing direction f (plus its placement's extra turn), with its footprint's corners. */
function finish(p: Placement, px: number, pz: number, f: [number, number], frame: Frame, w: number, d: number): Omit<Fitted, "placement"> {
  const turn = Math.atan2(f[0], f[1]) + ((p.turn ?? 0) * Math.PI) / 180;
  // Footprint: local +z maps to (sin t, cos t), local +x to (cos t, −sin t).
  const Z: [number, number] = [Math.sin(turn), Math.cos(turn)];
  const X: [number, number] = [Math.cos(turn), -Math.sin(turn)];
  const corners = ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([sx, sz]): [number, number] => [
    px + (sx * w * X[0]) / 2 + (sz * d * Z[0]) / 2,
    pz + (sx * w * X[1]) / 2 + (sz * d * Z[1]) / 2,
  ]);
  // A hair above the floor (so nothing pokes through it, seen from the floor below); a wall hanging at its height.
  return { item: p.item, x: px, y: frame.y + FIT.lift + (itemDef(p.item).mount ?? 0), z: pz, turn, corners, wall: p.wall, floor: frame.floor };
}

/**
 * The other way round, for dragging in the editor: the offsets (x along the
 * wall, y out from it) that put a placement's item centre at a point on the
 * floor. Undoes `place` for the placement's wall.
 */
export function unplace(frame: Frame, p: Placement, [px, pz]: [number, number]): { x: number; y: number } {
  const d = depthOf(p);
  const r = Math.hypot(px, pz);
  const a = unwrap(Math.atan2(pz, px), frame.left(r) - Math.PI);
  const mid = (frame.left(r) + frame.right(r)) / 2;
  const rMid = (frame.rIn + frame.rOut) / 2;
  const [w] = itemDef(p.item).size;
  if (p.wall === "back") return { x: (a - mid) * r, y: Math.sqrt(frame.rOut * frame.rOut - (w * w) / 4) - r - d / 2 };
  if (p.wall === "front") return { x: (a - mid) * r, y: r - frame.rIn - d / 2 };
  if (p.wall === "left" || p.wall === "right") {
    // Along the border line, and out from it: the point's components in the wall's own frame.
    const left = p.wall === "left";
    const b = left ? frame.a0 : frame.a1;
    const u: [number, number] = [Math.cos(b), Math.sin(b)];
    const n: [number, number] = left ? [-u[1], u[0]] : [u[1], -u[0]];
    return { x: px * u[0] + pz * u[1] - rMid, y: px * n[0] + pz * n[1] - (left ? frame.dLeft : frame.dRight) - d / 2 };
  }
  return { x: (a - mid) * r, y: r - rMid };
}

/** Is a point on the room's floor, inside its walls? */
export function inside(frame: Frame, [x, z]: [number, number]): boolean {
  const r = Math.hypot(x, z);
  if (r < frame.rIn - 1e-6 || r > frame.rOut + 1e-6) return false;
  const a = unwrap(Math.atan2(z, x), frame.left(r) - 1e-6);
  return a <= frame.right(r) + 1e-6;
}

/** Do two footprints (convex quads) come within `gap` of each other? Separating axes, with the gap added. */
export function tooClose(a: [number, number][], b: [number, number][], gap: number): boolean {
  for (const quad of [a, b]) {
    for (let i = 0; i < quad.length; i++) {
      const [x0, z0] = quad[i]!;
      const [x1, z1] = quad[(i + 1) % quad.length]!;
      const len = Math.hypot(x1 - x0, z1 - z0) || 1;
      const nx = -(z1 - z0) / len;
      const nz = (x1 - x0) / len;
      const project = (q: [number, number][]) => q.map(([x, z]) => x * nx + z * nz);
      const pa = project(a);
      const pb = project(b);
      if (Math.max(...pa) + gap <= Math.min(...pb) || Math.max(...pb) + gap <= Math.min(...pa)) return false;
    }
  }
  return true;
}

/** The doorway's keep-clear zone, as a footprint. */
function doorway(frame: Frame): [number, number][] | null {
  if (frame.door === null) return null;
  const { width, depth } = FIT.door;
  const r0 = frame.rIn - FIT.wallGap;
  const r1 = r0 + depth;
  const a = frame.door;
  const h = width / 2 / r0;
  return [
    [r0 * Math.cos(a - h), r0 * Math.sin(a - h)],
    [r1 * Math.cos(a - h), r1 * Math.sin(a - h)],
    [r1 * Math.cos(a + h), r1 * Math.sin(a + h)],
    [r0 * Math.cos(a + h), r0 * Math.sin(a + h)],
  ];
}

/** A template's items fitted into a room, in priority order: what fits, and nothing else. */
export function fit(frame: Frame, template: Template): Fitted[] {
  const out: Fitted[] = [];
  const door = doorway(frame);
  let covered = 0;
  const cap = frame.area * FIT.crowding;
  const tryPlace = (p: Placement, i: number, dx: number): "ok" | "outside" | "blocked" | "full" => {
    if (isMounted(p.item)) return hang(p, i, dx);
    const [w, d] = itemDef(p.item).size;
    const flat = isFlat(p.item);
    if (!flat && covered + w * d > cap) return "full";
    const f = place(frame, p, dx);
    if (!f.corners.every((c) => inside(frame, c))) return "outside";
    // A rug lies under whatever stands on it: only standing items keep apart, and out of the doorway.
    if (!flat && door && tooClose(f.corners, door, 0)) return "blocked";
    const gap = p.snug ? FIT.snug : FIT.aisle;
    const between = (o: Fitted) => (o.placement === i ? Math.min(gap, FIT.row) : gap);
    if (!flat && out.some((o) => !isFlat(o.item) && !isMounted(o.item) && tooClose(f.corners, o.corners, between(o)))) return "blocked";
    if (flat && out.some((o) => isFlat(o.item) && tooClose(f.corners, o.corners, 0))) return "blocked";
    out.push({ ...f, placement: i });
    if (!flat) covered += w * d;
    return "ok";
  };
  // A wall hanging: only on a solid wall, clear of the doorway and of other hangings, and not
  // behind anything standing taller than it hangs (a painting over a bed, not behind a wardrobe).
  // It takes no floor, so it doesn't count toward crowding.
  const hang = (p: Placement, i: number, dx: number): "ok" | "outside" | "blocked" => {
    if (p.wall === "center" || !frame.solid[p.wall]) return "outside";
    const f = place(frame, p, dx);
    if (!f.corners.every((c) => inside(frame, c))) return "outside";
    if (door && tooClose(f.corners, door, 0)) return "blocked";
    const mount = itemDef(p.item).mount!;
    const clash = (o: Fitted) =>
      isMounted(o.item) ? tooClose(f.corners, o.corners, FIT.hangingGap) : !isFlat(o.item) && itemDef(o.item).size[2] > mount && tooClose(f.corners, o.corners, 0);
    if (out.some(clash)) return "blocked";
    // Checked where standing things go; hung flat on the wall itself, which stands the fitting gap further out.
    out.push({ ...place(frame, { ...p, y: (p.y ?? 0) - FIT.wallGap + FIT.hangingOff }, dx), placement: i });
    return "ok";
  };
  template.forEach((p, i) => {
    if (!p.repeat) {
      tryPlace(p, i, 0);
      return;
    }
    // Out from x both ways, one step at a time, until the walls stop each side or there are enough.
    const max = p.repeat.max ?? FIT.maxRepeat;
    let placed = 0;
    const open = { plus: true, minus: true };
    if (tryPlace(p, i, 0) === "ok") placed++;
    for (let k = 1; placed < max && (open.plus || open.minus); k++) {
      for (const dir of ["plus", "minus"] as const) {
        if (!open[dir] || placed >= max) continue;
        const r = tryPlace(p, i, (dir === "plus" ? 1 : -1) * k * p.repeat.every);
        if (r === "ok") placed++;
        else if (r === "outside" || r === "full") open[dir] = false;
      }
    }
  });
  return out;
}

/** Which floor of a stairwell or elevator: its shallowest ("top"), its deepest ("bottom"), or one between. */
export type FloorRole = "top" | "bottom" | "middle";

/**
 * The template for a room type and shape ("bunk_dorm:2x1"), if there is one.
 * A floor of a stairwell or elevator looks for its role's own first
 * ("stairwell:1x1:top"), then the plain one.
 */
export function templateFor(type: string, w: number, d: number, templates: Record<string, Template> = layouts.templates, role?: FloorRole): Template | null {
  const key = `${type}:${w}x${d}`;
  return (role && templates[`${key}:${role}`]) || templates[key] || null;
}

/** The floors a room is furnished on, each with its role: every built floor of a stairwell or elevator, otherwise just the one. */
export function furnishedFloors(room: RoomInstance): { floor: number; role?: FloorRole }[] {
  if (!roomDef(room.type).stacks) return [{ floor: roomDef(room.type).cargoShaft ? Math.max(...room.cells.map((c) => c.floor)) : room.at.kind === "ring" ? room.at.floor : 1 }];
  const floors = [...new Set(room.cells.map((c) => c.floor))].sort((a, b) => a - b);
  return floors.map((floor, i) => ({ floor, role: i === 0 ? "top" : i === floors.length - 1 ? "bottom" : "middle" }));
}

/** A built room's furniture: its template fitted into it, floor by floor (nothing for blueprints, rooms under construction, or rooms without a template). */
export function furnish(layout: Layout, room: RoomInstance, templates: Record<string, Template> = layouts.templates): Fitted[] {
  if (room.planned || room.building || room.at.kind !== "ring") return [];
  const out: Fitted[] = [];
  for (const { floor, role } of furnishedFloors(room)) {
    const template = templateFor(room.type, room.at.w, room.at.d, templates, role);
    const frame = template && frameOf(layout, room, floor);
    if (frame && template) out.push(...fit(frame, template));
  }
  return out;
}
