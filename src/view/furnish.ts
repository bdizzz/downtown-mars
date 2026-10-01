import raw from "../../data/layouts.json";
import { corridors } from "../sim/corridors";
import { edgeById } from "../sim/edges";
import type { Cell, Layout, RoomInstance } from "../sim/placement";
import { roomDef } from "../sim/rooms";
import { floorSpan, ringRadii, slotAngles } from "../render3d/cylinder";
import { doorways, sideOf, type Doorway } from "./doors";
import { glazedWalls, ownSide } from "../sim/windows";
import { isFurnished, isItem, isMounted, itemDef, itemsFor } from "./furniture";

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
  /**
   * Mirrored on odd or even floors: x the other way, turned half round. Stairs
   * use it to switch back, each floor's flight beside the one below.
   */
  mirror?: "odd" | "even";
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
  /** A doorway's keep-clear zone, on whichever wall it's in: width along the wall, depth into the room. */
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
  /** Kept between two hangings, one above the other. */
  hangingAbove: 0.1,
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
  /** The doorways on this floor (on any wall), as the floor kept clear inside each: footprints. */
  doors: [number, number][][];
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
    // A gallery tube runs in the shaft, outside the room's front wall: it takes nothing from the room.
    if (e.circle === inner - 1 && e.circle > 0) front = HALL;
    if (e.circle === outer) back = HALL;
  }
  const g = FIT.wallGap;
  const rIn = ringRadii(hole, inner)[0] + front + g;
  const rOut = ringRadii(hole, outer)[1] - back - g;
  const side = (d: number, r: number) => Math.asin(Math.min(0.99, d / r));
  // The doors on this floor (as the 3D view cuts them), and the floor kept clear inside each.
  const doors = doorways(layout, room)
    .filter((d) => d.floor === floor)
    .map((d) => keepClear(d));
  const open = !!roomDef(room.type).public;
  // Which walls have windows in them on this floor.
  const glass = new Set(
    glazedWalls(layout, room)
      .filter(({ edge }) => edge.floor === floor)
      .map(({ edge }) => {
        const cell = ownSide(layout, edge, own);
        return cell ? sideOf(edge, cell) : null;
      }),
  );
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
    doors,
    area: ((rOut * rOut - rIn * rIn) / 2) * (a1 - a0),
    floor,
    solid: {
      // A public room's open sides, ring 1's front onto the shaft on a public room, and glazed walls aren't.
      front: !(open && (front === HALL || inner === 1)) && !glass.has("inner"),
      back: !(open && back === HALL) && !glass.has("outer"),
      left: !(open && left === HALL) && !glass.has("left"),
      right: !(open && right === HALL) && !glass.has("right"),
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
export function place(frame: Frame, placement: Placement, dx = 0): Omit<Fitted, "placement"> {
  // Mirrored on this floor: the other side, facing the other way.
  const flip = placement.mirror !== undefined && placement.mirror === (frame.floor % 2 === 0 ? "even" : "odd");
  const p = flip ? { ...placement, x: -((placement.x ?? 0) + dx), turn: (placement.turn ?? 0) + 180 } : placement;
  if (flip) dx = 0;
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

/** The floor kept clear inside a doorway, as a footprint: from just outside its wall, the doorway's width, some way into the room. */
function keepClear(d: Doorway): [number, number][] {
  const { width, depth } = FIT.door;
  const g = FIT.wallGap;
  const at = (r: number, a: number): [number, number] => [r * Math.cos(a), r * Math.sin(a)];
  if (d.side === "inner" || d.side === "outer") {
    // Into the room: outward from an inner wall, inward from an outer one.
    const [r0, r1] = d.side === "inner" ? [d.r - g, d.r + depth] : [d.r - depth, d.r + g];
    const h = width / 2 / d.r;
    return [at(r0, d.angle - h), at(r1, d.angle - h), at(r1, d.angle + h), at(r0, d.angle + h)];
  }
  // A side wall: along its line, and in from it (toward larger angles from a left wall, smaller from a right).
  const u: [number, number] = [Math.cos(d.angle), Math.sin(d.angle)];
  const n: [number, number] = d.side === "left" ? [-u[1], u[0]] : [u[1], -u[0]];
  const p = (along: number, out: number): [number, number] => [along * u[0] + out * n[0], along * u[1] + out * n[1]];
  const [lo, hi] = [d.r - width / 2, d.r + width / 2];
  return [p(lo, -g), p(hi, -g), p(hi, depth), p(lo, depth)];
}

/** A template's items fitted into a room, in priority order: what fits, and nothing else. */
export function fit(frame: Frame, template: Template): Fitted[] {
  const out: Fitted[] = [];
  const inDoorway = (corners: [number, number][]) => frame.doors.some((d) => tooClose(corners, d, 0));
  let covered = 0;
  const cap = frame.area * FIT.crowding;
  const tryPlace = (p: Placement, i: number, dx: number): "ok" | "outside" | "blocked" | "full" => {
    if (isMounted(p.item)) return hang(p, i, dx);
    const [w, d] = itemDef(p.item).size;
    const flat = isFlat(p.item);
    // An opening in the floor (a stair well) takes no floor space.
    const counts = !flat && !itemDef(p.item).opening;
    if (counts && covered + w * d > cap) return "full";
    const f = place(frame, p, dx);
    if (!f.corners.every((c) => inside(frame, c))) return "outside";
    // A rug lies under whatever stands on it: only standing items keep apart, and out of the doorway.
    if (!flat && inDoorway(f.corners)) return "blocked";
    const gap = p.snug ? FIT.snug : FIT.aisle;
    const between = (o: Fitted) => (o.placement === i ? Math.min(gap, FIT.row) : gap);
    if (!flat && out.some((o) => !isFlat(o.item) && !isMounted(o.item) && tooClose(f.corners, o.corners, between(o)))) return "blocked";
    if (flat && out.some((o) => isFlat(o.item) && tooClose(f.corners, o.corners, 0))) return "blocked";
    out.push({ ...f, placement: i });
    if (counts) covered += w * d;
    return "ok";
  };
  // A wall hanging: only on a solid wall, clear of the doorway and of other hangings, and not
  // behind anything standing taller than it hangs (a painting over a bed, not behind a wardrobe).
  // It takes no floor, so it doesn't count toward crowding.
  const hang = (p: Placement, i: number, dx: number): "ok" | "outside" | "blocked" => {
    if (p.wall === "center" || !frame.solid[p.wall]) return "outside";
    const f = place(frame, p, dx);
    if (!f.corners.every((c) => inside(frame, c))) return "outside";
    if (inDoorway(f.corners)) return "blocked";
    const mount = itemDef(p.item).mount!;
    // Two hangings can share a stretch of wall if one hangs clear above the other (a vent over a picture).
    const top = mount + itemDef(p.item).size[2];
    const level = (o: string) => itemDef(o).mount! < top + FIT.hangingAbove && mount < itemDef(o).mount! + itemDef(o).size[2] + FIT.hangingAbove;
    const clash = (o: Fitted) =>
      isMounted(o.item) ? level(o.item) && tooClose(f.corners, o.corners, FIT.hangingGap) : !isFlat(o.item) && itemDef(o.item).size[2] > mount && tooClose(f.corners, o.corners, 0);
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
    if (frame && template) out.push(...fit(frame, varied(template, room)));
  }
  // A farm shows what it grows: its planters and racks swap for that crop's (same footprints).
  const crop = room.crop ?? roomDef(room.type).defaultCrop;
  if (crop) for (const f of out) f.item = cropVariant(f.item, crop);
  return out;
}

// ---- variety: no two rooms of a kind quite alike ----

/**
 * Pieces that can stand in for one another. A room swaps some for others in
 * the same group (only ones its kind of room may have), so two dorms don't
 * hang the same pictures or light their corners the same way.
 */
const SWAPS: string[][] = [
  ["plant_pot", "floor_lamp"],
  ["painting", "poster", "earth_photo", "family_photos"],
  ["painting_wide", "wall_textile"],
  ["wall_clock", "intercom"],
  ["chart_board", "whiteboard", "notice_board"],
  ["gauge_panel", "readout_panel"],
  ["shelf_unit", "bookshelf"],
  ["wall_mirror", "wall_shelf"],
];

/** A room's own roll, 0..1, for a salt: the same room always varies the same way. */
export function roomRoll(roomId: number, salt: number): number {
  let h = Math.imul(roomId ^ 0x9e3779b9, 2654435761) ^ Math.imul(salt + 1, 40503);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * A room's own take on its template: mirrored side to side (about half of
 * rooms), with some pieces swapped for others that can stand in for them.
 * Stairs and elevators keep theirs exactly, as their flights and shafts line
 * up floor to floor.
 */
export function varied(template: Template, room: RoomInstance): Template {
  if (roomDef(room.type).stacks || template.some((p) => p.mirror || itemDef(p.item).climb || itemDef(p.item).opening)) return template;
  const allowed = new Set(itemsFor(room.type));
  const mirror = roomRoll(room.id, 0) < 0.5;
  return template.map((p, i) => {
    let item = p.item;
    const group = SWAPS.find((g) => g.includes(item));
    if (group) {
      const options = group.filter((id) => allowed.has(id) && isMounted(id) === isMounted(item));
      if (options.length > 1) item = options[Math.floor(roomRoll(room.id, i + 1) * options.length)]!;
    }
    if (!mirror) return item === p.item ? p : { ...p, item };
    // Mirrored: the left wall's things go on the right and back; along the others, x the other way.
    const wall: Wall = p.wall === "left" ? "right" : p.wall === "right" ? "left" : p.wall;
    const x = p.wall === "left" || p.wall === "right" ? p.x : p.x === undefined ? undefined : -p.x;
    return { ...p, item, wall, ...(x !== undefined ? { x } : {}), ...(p.turn ? { turn: -p.turn } : {}) };
  });
}

/** An item as it looks growing a crop ("planter_bed_wheat"), if it has such a look. */
export function cropVariant(item: string, crop: string): string {
  const id = `${item}_${crop}`;
  return isItem(id) ? id : item;
}
