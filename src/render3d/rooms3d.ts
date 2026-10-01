import { UI_FONT } from "../view/font";
import { roomLabel } from "../sim/roomName";
import * as THREE from "three";
import { neighborCells, type Cell, type Layout, type RoomInstance } from "../sim/placement";
import { roomDef } from "../sim/rooms";
import { CATEGORY_COLORS } from "../render2d/palette";
import { FLOOR_H, floorSpan, LEDGE_THICKNESS, openShaftRadius, RAIL_HEIGHT, RING_D, ringRadii, slotAngles, TAU } from "./cylinder";
import { cellEdges, edgeById, edgeSides, edgeVertices, galleryEdges, isGalleryEdge, outsideEdges, vertexKey, type ArcEdge, type Edge } from "../sim/edges";
import { corridorJoints, corridors, finishDef } from "../sim/corridors";
import { isOpen } from "../sim/excavation";
import { FIT, frameOf, furnish, roomRoll, type Fitted } from "../view/furnish";
import { isMounted, itemDef } from "../view/furniture";
import { onCorridorAt } from "../view/walk";
import { DOOR, doorways, type Doorway } from "../view/doors";
import { tubeAt, tubeAtAngle } from "../view/gallery";
import { finishMaterial, withFloor, withFresnel, withGrime, withRock, type FloorKind } from "./surfaces";
import { roomFinish, type Finish } from "../view/roomFinish";
import { lampsOf, lightPools } from "./lights3d";
import { withCondensation } from "./details3d";
import { spotsOf, type RoomSpots } from "./people3d";

/** Room categories where people sit about (the rest only have staff at their posts, and beds). */
const SOCIAL = new Set(["housing", "public", "admin", "circulation"]);
/** Rooms outside those categories where people gather: they sit about in them, not only work. */
const SOCIAL_ROOMS = new Set(["galley", "canteen", "elder_care", "gym"]);
import { centreOf, disposeFurniture, disposeFurnitureMaterials, furnitureMeshes, setFurnitureGlow, type HangTag } from "./furniture3d";

// Rooms as solid wedges carved into the rock, plus the shaft wall wherever
// no room faces it, plus props on the surface. Rebuilt whenever the layout
// changes; everything here is plain geometry, no per-frame work.

const ARC_STEPS = 4;
const INSET = 0.06;
/** The window band on a ring-1 face (above the floor's base), how far in from the face's ends it stops, and its glass. */
const WINDOW = { bottom: 1.4, top: 3.0, inset: 0.03, margin: 0.02, color: 0x2d4f6e, opacity: 0.22 };
/** With no gallery tube in front, a ring-1 room's shaft face is a window wall, nearly floor to ceiling. */
const WINDOW_WALL = { bottom: 0.35, top: 3.55 };
/** The door's frame: how wide, and its colour. */
const DOOR_FRAME = { width: 0.12, color: 0x2a1a14 };
const SURFACE_RING_M = 16; // how far from the rim surface props stand
const LABEL = { px: 40, heightM: 1.1 };
const GLOW = { windowBoost: 5 };

export interface RoomColors {
  rock: number;
  stranded: number;
}

/** How faint the shaft wall and ring-1 rooms get in x-ray, so deeper rings show. */
const XRAY = { wall: 0.1, ring1: 0.28 };

/** Vertices for a curved face at radius r, or a flat radial side, as triangles. */
function push(pos: number[], ...pts: number[][]): void {
  for (const p of pts) pos.push(p[0]!, p[1]!, p[2]!);
}
const at = (r: number, a: number, y: number) => [r * Math.cos(a), y, r * Math.sin(a)];

/**
 * Walls down: which side of a wall the room (or shaft) it bounds lies on, and
 * the wall's full height, per vertex. With walls down, a wall seen from its
 * back (so it stands between the camera and what it bounds) drops to a stub.
 * `side` is +1 when that side is outward (curved faces) or toward larger
 * angles (radial sides), −1 the other way; `y0`/`y1` default to the face's own.
 */
export interface Cut {
  side: 1 | -1;
  y0?: number;
  y1?: number;
  /**
   * Something to see on the wall's other side (a neighbouring room, empty
   * space, a corridor, the gallery), not rock. Seen from its own side, such a
   * wall hides that neighbour, so with walls down it's lowered from either side.
   * A curved wall can face several cells: then it's asked per segment, by angle.
   */
  across?: boolean | ((angle: number) => boolean);
}
/** How a wall with something to see across it is tagged: its normal at this length instead of 1. */
const ACROSS = 2;
/** Vertex arrays that carry wall tags (`aWall`: interior normal x, z, then base and top y). */
const wallTags = new WeakMap<number[], number[]>();
function tagged(): number[] {
  const pos: number[] = [];
  wallTags.set(pos, []);
  return pos;
}
function tag(pos: number[], count: number, nx = 0, nz = 0, y0 = 0, y1 = 0): void {
  const t = wallTags.get(pos);
  if (t) for (let i = 0; i < count; i++) t.push(nx, nz, y0, y1);
}

function curvedFace(pos: number[], r: number, a0: number, a1: number, y0: number, y1: number, cut?: Cut): void {
  for (let i = 0; i < ARC_STEPS; i++) {
    const b0 = a0 + ((a1 - a0) * i) / ARC_STEPS;
    const b1 = a0 + ((a1 - a0) * (i + 1)) / ARC_STEPS;
    push(pos, at(r, b0, y0), at(r, b1, y0), at(r, b1, y1), at(r, b0, y0), at(r, b1, y1), at(r, b0, y1));
    // One normal per segment (at its middle), so all six corners agree on whether it's cut.
    const m = (b0 + b1) / 2;
    const across = typeof cut?.across === "function" ? cut.across(m) : cut?.across;
    const k = cut ? cut.side * (across ? ACROSS : 1) : 0;
    if (cut) tag(pos, 6, k * Math.cos(m), k * Math.sin(m), cut.y0 ?? y0, cut.y1 ?? y1);
    else tag(pos, 6);
  }
}

/** An opening in a curved wall: angles and heights. */
interface Opening {
  a0: number;
  a1: number;
  y0: number;
  y1: number;
}

/**
 * A curved wall with openings cut out of it: the wall is split into a grid at
 * the openings' edges, and every column keeps its solid runs. The wall tags
 * keep the whole wall's height, so it lowers as one.
 */
function curvedFaceWithOpenings(pos: number[], r: number, a0: number, a1: number, y0: number, y1: number, cut: Cut, openings: Opening[]): void {
  const holes = openings
    .map((o) => ({ a0: Math.max(o.a0, a0), a1: Math.min(o.a1, a1), y0: Math.max(o.y0, y0), y1: Math.min(o.y1, y1) }))
    .filter((o) => o.a1 - o.a0 > 1e-9 && o.y1 - o.y0 > 1e-9);
  const whole = { ...cut, y0: cut.y0 ?? y0, y1: cut.y1 ?? y1 };
  if (!holes.length) return curvedFace(pos, r, a0, a1, y0, y1, whole);
  const breaks = (list: number[]) => [...new Set(list)].sort((p, q) => p - q);
  const as = breaks([a0, a1, ...holes.flatMap((o) => [o.a0, o.a1])]);
  const ys = breaks([y0, y1, ...holes.flatMap((o) => [o.y0, o.y1])]);
  for (let i = 0; i + 1 < as.length; i++) {
    const am = (as[i]! + as[i + 1]!) / 2;
    const open = (ym: number) => holes.some((o) => am > o.a0 && am < o.a1 && ym > o.y0 && ym < o.y1);
    // Solid runs up the column, each drawn whole.
    let start: number | null = null;
    for (let j = 0; j + 1 < ys.length; j++) {
      const solid = !open((ys[j]! + ys[j + 1]!) / 2);
      if (solid && start === null) start = ys[j]!;
      if (!solid && start !== null) {
        curvedFace(pos, r, as[i]!, as[i + 1]!, start, ys[j]!, whole);
        start = null;
      }
    }
    if (start !== null) curvedFace(pos, r, as[i]!, as[i + 1]!, start, ys.at(-1)!, whole);
  }
}

function flatRing(pos: number[], r0: number, r1: number, a0: number, a1: number, y: number): void {
  for (let i = 0; i < ARC_STEPS; i++) {
    const b0 = a0 + ((a1 - a0) * i) / ARC_STEPS;
    const b1 = a0 + ((a1 - a0) * (i + 1)) / ARC_STEPS;
    push(pos, at(r0, b0, y), at(r1, b0, y), at(r1, b1, y), at(r0, b0, y), at(r1, b1, y), at(r0, b1, y));
    tag(pos, 6);
  }
}

function radialSide(pos: number[], r0: number, r1: number, a: number, y0: number, y1: number, cut?: Cut): void {
  push(pos, at(r0, a, y0), at(r1, a, y0), at(r1, a, y1), at(r0, a, y0), at(r1, a, y1), at(r0, a, y1));
  const across = typeof cut?.across === "function" ? cut.across(a) : cut?.across;
  const k = cut ? cut.side * (across ? ACROSS : 1) : 0;
  if (cut) tag(pos, 6, -k * Math.sin(a), k * Math.cos(a), cut.y0 ?? y0, cut.y1 ?? y1);
  else tag(pos, 6);
}

/** A floor between radii r0 and r1 whose ends stand at different angles inside ([i0, i1]) and out ([o0, o1]). */
function flatPiece(pos: number[], r0: number, r1: number, [i0, i1]: [number, number], [o0, o1]: [number, number], y: number): void {
  for (let i = 0; i < ARC_STEPS; i++) {
    const t0 = i / ARC_STEPS;
    const t1 = (i + 1) / ARC_STEPS;
    const bi0 = i0 + (i1 - i0) * t0;
    const bi1 = i0 + (i1 - i0) * t1;
    const bo0 = o0 + (o1 - o0) * t0;
    const bo1 = o0 + (o1 - o0) * t1;
    push(pos, at(r0, bi0, y), at(r1, bo0, y), at(r1, bo1, y), at(r0, bi0, y), at(r1, bo1, y), at(r0, bi1, y));
    tag(pos, 6);
  }
}

/**
 * A side wall from (r0, a0) to (r1, a1): straight, and not necessarily
 * radial (a side kept parallel to a corridor slants). Its wall tag is its true
 * perpendicular, turned toward larger angles for side +1.
 */
function sideWall(pos: number[], r0: number, a0: number, r1: number, a1: number, y0: number, y1: number, cut?: Cut): void {
  push(pos, at(r0, a0, y0), at(r1, a1, y0), at(r1, a1, y1), at(r0, a0, y0), at(r1, a1, y1), at(r0, a0, y1));
  if (!cut) {
    tag(pos, 6);
    return;
  }
  const [x0, , z0] = at(r0, a0, 0);
  const [x1, , z1] = at(r1, a1, 0);
  const len = Math.hypot(x1! - x0!, z1! - z0!) || 1;
  let nx = -(z1! - z0!) / len;
  let nz = (x1! - x0!) / len;
  // Toward larger angles: the direction a circle turns at the wall's middle.
  const m = (a0 + a1) / 2;
  if (nx * -Math.sin(m) + nz * Math.cos(m) < 0) [nx, nz] = [-nx, -nz];
  const across = typeof cut.across === "function" ? cut.across(m) : cut.across;
  const k = cut.side * (across ? ACROSS : 1);
  tag(pos, 6, k * nx, k * nz, cut.y0 ?? y0, cut.y1 ?? y1);
}

function geometry(pos: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  // Texture coordinates from position, so a pattern (construction stripes) tiles across walls and floors alike.
  const uv: number[] = [];
  for (let i = 0; i < pos.length; i += 3) uv.push((pos[i]! + pos[i + 2]!) * UV_SCALE, pos[i + 1]! * UV_SCALE);
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  const tags = wallTags.get(pos);
  if (tags) g.setAttribute("aWall", new THREE.Float32BufferAttribute(tags, 4));
  g.computeVertexNormals();
  return g;
}

const UV_SCALE = 0.35;

let stripeTexture: THREE.CanvasTexture | null = null;
/** Diagonal hazard stripes for rooms under construction. */
function stripes(): THREE.CanvasTexture {
  if (stripeTexture) return stripeTexture;
  const size = 32;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, size, size);
  g.fillStyle = "#e0a03a";
  for (const o of [-size, 0, size]) {
    g.beginPath();
    g.moveTo(o, 0);
    g.lineTo(o + size / 2, 0);
    g.lineTo(o + size * 1.5, size);
    g.lineTo(o + size, size);
    g.closePath();
    g.fill();
  }
  stripeTexture = new THREE.CanvasTexture(c);
  stripeTexture.wrapS = stripeTexture.wrapT = THREE.RepeatWrapping;
  stripeTexture.colorSpace = THREE.SRGBColorSpace;
  return stripeTexture;
}

/** One piece of a cell between corridor changes: its angles, and its inner and outer radius after carving. */
interface Piece {
  b0: number;
  b1: number;
  rr0: number;
  rr1: number;
  innerHall: boolean;
  outerHall: boolean;
}

/**
 * How a cell is carved by the corridors along it. Sides facing another cell
 * of the same group (`own`) aren't sides at all; outside sides are pulled
 * back by `inset`, or by half a corridor where one runs. The inner and outer
 * sides may be cut into pieces (outer rings have more slots), each with or
 * without a corridor, so the cell is split where that changes. Without
 * `carve`, corridors are ignored. `openInner` leaves the inner side where it
 * is (a public room onto the gallery).
 */
function carveCell(
  layout: Layout,
  c: Cell,
  own: Set<string>,
  inner: number,
  outer: number,
  inset: number,
  carve: boolean,
  openInner = false,
  joints: Set<string> = new Set(),
): {
  a0: number;
  a1: number;
  /** Where the left and right sides stand at radius r (see `sideAngle`). */
  left: (r: number) => number;
  right: (r: number) => number;
  pieces: Piece[];
  openLeft: boolean;
  openRight: boolean;
  hallLeft: boolean;
  hallRight: boolean;
} {
  const hole = layout.hole;
  const key = (x: Cell) => `${x.floor}:${x.ring}:${x.slot}`;
  const hall = (id: string) => carve && !!layout.corridors?.[id];
  const n = hole.ringSlots[c.ring - 1]!;
  const [s0, s1] = slotAngles(c.slot, n);
  const [r0, r1] = ringRadii(hole, c.ring);
  const rMid = (r0 + r1) / 2;
  const hallLeft = hall(`R${c.floor}.${c.ring}.${c.slot}`);
  const hallRight = hall(`R${c.floor}.${c.ring}.${(c.slot + 1) % n}`);
  const openLeft = !own.has(key({ ...c, slot: (c.slot - 1 + n) % n }));
  const openRight = !own.has(key({ ...c, slot: (c.slot + 1) % n }));
  // Each open side stands parallel to its border, pulled back by a fixed distance (half a corridor, or the inset).
  const left = (r: number) => s0 + (openLeft ? sideAngle(hallLeft ? HALL : inset, r) : 0);
  const right = (r: number) => s1 - (openRight ? sideAngle(hallRight ? HALL : inset, r) : 0);
  const a0 = left(rMid);
  const a1 = right(rMid);
  const arcs = cellEdges(hole, c).filter((e): e is ArcEdge => e.kind === "arc");
  // Where corridors turn, the joint's square fills the outer corner: a side piece without a corridor
  // gives up a half-corridor notch next to it (unless the cell's own side there is a corridor, which carves it anyway).
  const cornerHall = (angle: number) => (Math.abs(angle - s0) < 1e-9 ? hallLeft : Math.abs(angle - s1) < 1e-9 ? hallRight : false);
  const sides = (circle: number) => {
    const r = hole.shaftRadiusM + circle * (ringRadii(hole, 1)[1] - ringRadii(hole, 1)[0]);
    const notch = HALL / r;
    return arcs
      .filter((e) => e.circle === circle)
      .flatMap((e) => {
        const b0 = e.a0 * TAU;
        const b1 = e.a1 * TAU;
        if (hall(e.id) || !carve) return [{ b0, b1, hall: hall(e.id) }];
        const atStart = joints.has(vertexKey(c.floor, circle, e.from)) && !cornerHall(b0);
        const atEnd = joints.has(vertexKey(c.floor, circle, e.to)) && !cornerHall(b1);
        if (!atStart && !atEnd) return [{ b0, b1, hall: false }];
        const n0 = atStart ? Math.min(b1, b0 + notch) : b0;
        const n1 = atEnd ? Math.max(n0, b1 - notch) : b1;
        const out = [];
        if (n0 > b0) out.push({ b0, b1: n0, hall: true });
        if (n1 > n0) out.push({ b0: n0, b1: n1, hall: false });
        if (b1 > n1) out.push({ b0: n1, b1, hall: true });
        return out;
      });
  };
  const innerSides = c.ring > 1 ? sides(c.ring - 1) : [];
  const outerSides = sides(c.ring);
  // Only split where a corridor starts or stops; an uncarved side stays one piece.
  const carved = [...innerSides, ...outerSides].some((p) => p.hall);
  const cutAt = carved ? [...innerSides, ...outerSides].flatMap((p) => [p.b0, p.b1]) : [];
  const cuts = [...new Set([a0, a1, ...cutAt].filter((b) => b >= a0 && b <= a1))].sort((x, y) => x - y);
  const hallAt = (list: { b0: number; b1: number; hall: boolean }[], b: number) => list.some((p) => b >= p.b0 - 1e-9 && b < p.b1 - 1e-9 && p.hall);
  const pieces: Piece[] = [];
  for (let k = 0; k + 1 < cuts.length; k++) {
    const b0 = cuts[k]!;
    const b1 = cuts[k + 1]!;
    if (b1 - b0 < 1e-9) continue;
    const mid = (b0 + b1) / 2;
    const innerHall = hallAt(innerSides, mid);
    const outerHall = hallAt(outerSides, mid);
    const rr0 = r0 + (c.ring === inner && !openInner ? (innerHall ? HALL : inset) : 0);
    const rr1 = r1 - (c.ring === outer ? (outerHall ? HALL : inset) : 0);
    pieces.push({ b0, b1, rr0, rr1, innerHall, outerHall });
  }
  return { a0, a1, left, right, pieces, openLeft, openRight, hallLeft, hallRight };
}

/**
 * How far round (radians) to pull a side back so it stands `d` metres from a
 * radial border at radius r. A fixed angle would make a wedge: too close to
 * the border near the shaft and too far out at the back. This keeps a side
 * parallel to its border, so a corridor along it has the same width all the way.
 */
function sideAngle(d: number, r: number): number {
  return Math.asin(Math.min(0.99, d / r));
}

/** A piece's angles at radius r: its first and last pieces end where the cell's sides stand at that radius. */
function pieceAt(cut: ReturnType<typeof carveCell>, p: Piece, r: number): [number, number] {
  return [p === cut.pieces[0] ? cut.left(r) : p.b0, p === cut.pieces.at(-1) ? cut.right(r) : p.b1];
}

/** A hole in a room's floor on one floor (a stair well): radii and angles. */
export interface FloorHole {
  floor: number;
  r0: number;
  r1: number;
  a0: number;
  a1: number;
}

/**
 * A floor piece (as `flatPiece`), less a hole where one crosses it: the parts
 * nearer and further than the hole, and either side of it between.
 */
function floorPiece(pos: number[], r0: number, r1: number, inner: [number, number], outer: [number, number], y: number, hole?: FloorHole): void {
  if (!hole || hole.r1 <= r0 || hole.r0 >= r1) return flatPiece(pos, r0, r1, inner, outer, y);
  // The piece's sides at a radius, between its inner and outer ends.
  const sides = (r: number): [number, number] => {
    const t = (r - r0) / (r1 - r0);
    return [inner[0] + (outer[0] - inner[0]) * t, inner[1] + (outer[1] - inner[1]) * t];
  };
  // The hole's angles, brought round to the piece's.
  const mid = (inner[0] + inner[1]) / 2;
  const shift = Math.round((mid - (hole.a0 + hole.a1) / 2) / TAU) * TAU;
  const [ha0, ha1] = [hole.a0 + shift, hole.a1 + shift];
  if (ha1 <= Math.min(inner[0], outer[0]) || ha0 >= Math.max(inner[1], outer[1])) return flatPiece(pos, r0, r1, inner, outer, y);
  const h0 = Math.max(r0, hole.r0);
  const h1 = Math.min(r1, hole.r1);
  if (h0 > r0) flatPiece(pos, r0, h0, inner, sides(h0), y);
  if (r1 > h1) flatPiece(pos, h1, r1, sides(h1), outer, y);
  const [i, o] = [sides(h0), sides(h1)];
  if (ha0 > i[0]) flatPiece(pos, h0, h1, [i[0], Math.min(ha0, i[1])], [o[0], Math.min(ha0, o[1])], y);
  if (ha1 < i[1]) flatPiece(pos, h0, h1, [Math.max(ha1, i[0]), i[1]], [Math.max(ha1, o[0]), o[1]], y);
}

/** The wells in a stack's floors: where a flight from the floor below comes up (its well's footprint). */
export function stairWells(layout: Layout, room: RoomInstance): FloorHole[] {
  if (!roomDef(room.type).stacks) return [];
  return furnish(layout, room)
    .filter((f) => itemDef(f.item).opening)
    .map((f) => {
      const rs = f.corners.map(([x, z]) => Math.hypot(x, z));
      const centre = Math.atan2(f.z, f.x);
      const as = f.corners.map(([x, z]) => centre + Math.atan2(Math.sin(Math.atan2(z, x) - centre), Math.cos(Math.atan2(z, x) - centre)));
      return { floor: f.floor, r0: Math.min(...rs), r1: Math.max(...rs), a0: Math.min(...as), a1: Math.max(...as) };
    });
}

/** The glass in a ring-1 face: the usual band behind a gallery tube, a window wall where none runs. */
function windowSpan(tube: boolean): { bottom: number; top: number } {
  return tube ? WINDOW : WINDOW_WALL;
}

/**
 * The openings in a ring-1 cell's shaft face (from a0 to a1): its windows
 * (a band behind a tube, a wall of them with none), less a frame's width
 * either side of a door, and the door, if it's here.
 */
function frontage(c: Cell, a0: number, a1: number, doors: Doorway[], tube: boolean): Opening[] {
  const base = floorSpan(c.floor)[0];
  const door = doors.find((d) => d.floor === c.floor && d.angle > a0 && d.angle < a1);
  const span = windowSpan(tube);
  const band = { y0: base + span.bottom, y1: base + span.top };
  // The window stops a little further in than the glass, so the glass always covers it.
  const w0 = a0 + WINDOW.margin * 1.25;
  const w1 = a1 - WINDOW.margin * 1.25;
  if (!door) return [{ a0: w0, a1: w1, ...band }];
  const frame = DOOR_FRAME.width / door.r;
  return [
    { a0: w0, a1: door.angle - door.half - frame, ...band },
    { a0: door.angle + door.half + frame, a1: w1, ...band },
    { a0: door.angle - door.half, a1: door.angle + door.half, y0: base, y1: base + DOOR.height },
  ];
}

/**
 * One room: a floor and walls for every cell, without the faces its own cells
 * share, and no ceiling, so you can always see in. It's inset a few
 * centimetres on every outside face, so two rooms that touch never share a
 * plane (which would flicker) and a hairline of rock shows between them.
 * Where a corridor runs along an outside edge, the room gives up half the
 * corridor's width on that side instead, even along part of a side, so
 * corridors look carved out of the rooms they pass. A public room has no wall
 * where it opens onto the gallery or a corridor. With `carve` off (overlay
 * tints), corridors are ignored. With `doors`, the shaft face has its windows
 * and doors cut out of it.
 */
export function roomGeometry(layout: Layout, cells: Cell[], inset = INSET, carve = true, publicRoom = false, doors: Doorway[] | null = null, wells: FloorHole[] = []): THREE.BufferGeometry {
  const key = (c: Cell) => `${c.floor}:${c.ring}:${c.slot}`;
  const own = new Set(cells.map(key));
  const rings = cells.map((c) => c.ring);
  const inner = Math.min(...rings);
  const outer = Math.max(...rings);
  const joints = carve ? new Set(corridorJoints(layout).keys()) : new Set<string>();
  const pos = tagged();
  for (const c of cells) {
    let [y0, y1] = floorSpan(c.floor);
    y0 += inset;
    // Walls reach the floor above, whose rock (or on floor 1, the crust) closes the room over.
    // A public room on a gallery tube has no wall there: it runs right up to the tube. Without one, it's walled off from the shaft.
    const tube = galleryEdges(layout.hole, c.floor)[c.slot];
    const onGallery = publicRoom && c.ring === 1 && !!tube && !!layout.corridors?.[tube.id];
    const cut = carveCell(layout, c, own, inner, outer, inset, carve, onGallery, joints);
    // The floor runs out to the cell's edges (only the walls keep the hairline), so no gap shows between two rooms.
    const floorCut = carveCell(layout, c, own, inner, outer, 0, carve, onGallery, joints);
    // What's across each wall, looked for just past the cell's edge.
    const [cr0, cr1] = ringRadii(layout.hole, c.ring);
    const [s0, s1] = slotAngles(c.slot, layout.hole.ringSlots[c.ring - 1]!);
    const cMid = (cr0 + cr1) / 2;
    const across = (r: number, a: number) => seeThrough(layout, own, c.floor, r, a);
    let prev: Piece | null = null;
    for (const p of cut.pieces) {
      // Walls, except where a public room opens onto the gallery or a corridor. What's across is asked segment by segment.
      // A piece's ends move with radius where a side stands parallel to a corridor.
      const inside = pieceAt(cut, p, p.rr0);
      const outside = pieceAt(cut, p, p.rr1);
      if (c.ring === inner && !onGallery && !(publicRoom && p.innerHall)) {
        const wallCut: Cut = { side: 1, across: p.innerHall || ((a) => across(cr0 - 0.5, a)) };
        if (doors && c.ring === 1) curvedFaceWithOpenings(pos, p.rr0, ...inside, y0, y1, wallCut, frontage(c, cut.left(p.rr0), cut.right(p.rr0), doors, tubeAt(layout, c.floor, c.slot)));
        else curvedFace(pos, p.rr0, ...inside, y0, y1, wallCut);
      }
      if (c.ring === outer && !(publicRoom && p.outerHall)) curvedFace(pos, p.rr1, ...outside, y0, y1, { side: -1, across: p.outerHall || ((a) => across(cr1 + 0.5, a)) });
      // A step where a corridor starts or stops partway along a side.
      if (prev) {
        // The room is on the side of whichever piece reaches further in (or out).
        // Across a step is the corridor that carved it.
        if (prev.rr0 !== p.rr0) radialSide(pos, Math.min(prev.rr0, p.rr0), Math.max(prev.rr0, p.rr0), p.b0, y0, y1, { side: prev.rr0 < p.rr0 ? -1 : 1, across: true });
        if (prev.rr1 !== p.rr1) radialSide(pos, Math.min(prev.rr1, p.rr1), Math.max(prev.rr1, p.rr1), p.b0, y0, y1, { side: prev.rr1 > p.rr1 ? -1 : 1, across: true });
      }
      prev = p;
    }
    const first = cut.pieces[0];
    const last = cut.pieces.at(-1);
    if (cut.openLeft && first && !(publicRoom && cut.hallLeft)) {
      sideWall(pos, first.rr0, cut.left(first.rr0), first.rr1, cut.left(first.rr1), y0, y1, { side: 1, across: cut.hallLeft || across(cMid, s0 - 0.5 / cMid) });
    }
    if (cut.openRight && last && !(publicRoom && cut.hallRight)) {
      sideWall(pos, last.rr0, cut.right(last.rr0), last.rr1, cut.right(last.rr1), y0, y1, { side: -1, across: cut.hallRight || across(cMid, s1 + 0.5 / cMid) });
    }
    const well = wells.find((w) => w.floor === c.floor);
    for (const p of floorCut.pieces) floorPiece(pos, p.rr0, p.rr1, pieceAt(floorCut, p, p.rr0), pieceAt(floorCut, p, p.rr1), y0, well);
  }
  return geometry(pos);
}

/**
 * Solid rock, where it meets something you can see: its underside as the
 * ceiling over a room or empty space on the floor below, and its sides
 * facing rooms, empty space and the corridors carved into it. (Its top is
 * always under a floor, the ground, or a chosen floor's lid; its side onto
 * the gallery is the shaft wall.) Rock faces are tagged like walls whose
 * room is the open side, so with walls down they drop when they're in the way.
 */
function rockFaces(layout: Layout, topFloor: number | null): number[] {
  const hole = layout.hole;
  const pos = tagged();
  const joints = new Set(corridorJoints(layout).keys());
  const key = (c: Cell) => `${c.floor}:${c.ring}:${c.slot}`;
  const rock = (c: Cell | null) =>
    !c || c.floor < 1 || c.floor > hole.floors || (!layout.grid[c.floor - 1]?.[c.ring - 1]?.[c.slot] && !isOpen(layout, c));
  // The crust's underside: the ceiling over whatever's dug out on floor 1. Only with every floor
  // showing: with a floor picked, everything above it (the crust too) is lifted away to look in.
  if (hole.floors >= 1 && topFloor === null) {
    const y = floorSpan(1)[1];
    hole.ringSlots.forEach((n, ri) => {
      const [r0, r1] = ringRadii(hole, ri + 1);
      for (let slot = 0; slot < n; slot++) {
        if (rock({ floor: 1, ring: ri + 1, slot })) continue;
        const [s0, s1] = slotAngles(slot, n);
        flatRing(pos, r0, r1, s0, s1, y);
      }
    });
  }
  for (let floor = topFloor ?? 1; floor <= hole.floors; floor++) {
    const [y0, y1] = floorSpan(floor);
    hole.ringSlots.forEach((n, ri) => {
      const ring = ri + 1;
      const [r0, r1] = ringRadii(hole, ring);
      for (let slot = 0; slot < n; slot++) {
        const c = { floor, ring, slot };
        if (!rock(c)) continue;
        const [s0, s1] = slotAngles(slot, n);
        // A ceiling over whatever's been dug out below.
        if (floor < hole.floors && !rock({ floor: floor + 1, ring, slot })) flatRing(pos, r0, r1, s0, s1, y0);
        // Corridors carved into it: rock walls half a corridor back, facing the corridor.
        const cut = carveCell(layout, c, new Set([key(c)]), ring, ring, 0, true, false, joints);
        for (const p of cut.pieces) {
          if (p.innerHall) curvedFace(pos, p.rr0, ...pieceAt(cut, p, p.rr0), y0, y1, { side: -1 });
          if (p.outerHall) curvedFace(pos, p.rr1, ...pieceAt(cut, p, p.rr1), y0, y1, { side: 1 });
        }
        const first = cut.pieces[0];
        const last = cut.pieces.at(-1);
        if (cut.hallLeft && first) sideWall(pos, first.rr0, cut.left(first.rr0), first.rr1, cut.left(first.rr1), y0, y1, { side: -1 });
        if (cut.hallRight && last) sideWall(pos, last.rr0, cut.right(last.rr0), last.rr1, cut.right(last.rr1), y0, y1, { side: 1 });
        // A face on each border with something dug out beyond it (and no corridor there, which carves instead).
        for (const e of cellEdges(hole, c)) {
          if (layout.corridors?.[e.id]) continue;
          const [a, b] = edgeSides(hole, e);
          const beyondFirst = !!a && key(a) !== key(c);
          const other = beyondFirst ? a : b;
          if (!other || key(other) === key(c) || rock(other)) continue;
          // The open side is toward smaller angles (or inward) when it's the edge's first side.
          const side = beyondFirst ? -1 : 1;
          if (e.kind === "arc") curvedFace(pos, hole.shaftRadiusM + e.circle * RING_D, e.a0 * TAU, e.a1 * TAU, y0, y1, { side });
          else sideWall(pos, r0, e.turn * TAU, r1, e.turn * TAU, y0, y1, { side });
        }
      }
    });
  }
  return pos;
}

/**
 * A built room's furniture, fitted from its template (src/view/furnish.ts)
 * and merged into a few meshes. Cached like its shape: the room's shape key
 * already changes with everything the fit depends on (its cells, and the
 * corridors along it). Null when it has none.
 */
/**
 * A room's fitted furniture as meshes: what stands on the floor, and what
 * hangs on the walls, each hanging tagged with its wall so it vanishes when
 * walls down lowers that wall (rather than being cut to a stub like the wall).
 */
export function furnitureGroup(layout: Layout, room: RoomInstance, fitted: Fitted[], accent: string): THREE.Group {
  const standing = fitted.filter((f) => !isMounted(f.item));
  const hanging = fitted.filter((f) => isMounted(f.item));
  const g = furnitureMeshes(standing, accent);
  const hungAs = hanging.length ? { tags: hanging.map((f) => hangTag(layout, room, f)), key: "hung", material: withHangingDown } : null;
  if (hungAs) g.add(...furnitureMeshes(hanging, accent, hungAs).children);
  g.userData.centre = centreOf(fitted);
  // Where its people go, for the stage to fill by the hour.
  const def = roomDef(room.type);
  g.userData.people = { roomId: room.id, spots: spotsOf(fitted), accent, social: SOCIAL.has(def.category) || SOCIAL_ROOMS.has(room.type) } satisfies RoomSpots;
  // Its lamps: pooled on the floor always, and for the stage to light the nearest.
  const lamps = lampsOf(fitted);
  g.userData.lamps = lamps;
  const pools = lightPools(lamps);
  if (pools) g.add(pools);
  // Far away: coarser copies of both, made when first needed.
  g.userData.far = () => [...furnitureMeshes(standing, accent, undefined, "far").children, ...(hungAs ? furnitureMeshes(hanging, accent, hungAs, "far").children : [])];
  return g;
}

/** A wall hanging's tag: its wall's inward normal (longer when there's something to see across the wall), the wall's height, and the point on the wall behind it. */
function hangTag(layout: Layout, room: RoomInstance, f: Fitted): HangTag {
  const frame = frameOf(layout, room, f.floor)!;
  const a = Math.atan2(f.z, f.x);
  const r = Math.hypot(f.x, f.z);
  // Into the room, and how far the item's centre stands from the edge of the floor it's fitted in.
  let n: [number, number];
  let dist: number;
  if (f.wall === "back") {
    n = [-Math.cos(a), -Math.sin(a)];
    dist = frame.rOut - r;
  } else if (f.wall === "front") {
    n = [Math.cos(a), Math.sin(a)];
    dist = r - frame.rIn;
  } else if (f.wall === "left") {
    n = [-Math.sin(frame.a0), Math.cos(frame.a0)];
    dist = f.x * n[0] + f.z * n[1] - frame.dLeft;
  } else {
    n = [Math.sin(frame.a1), -Math.cos(frame.a1)];
    dist = f.x * n[0] + f.z * n[1] - frame.dRight;
  }
  // The wall stands the fitting gap beyond the fitted floor's edge. Just past it: what's there?
  const wall = dist + FIT.wallGap;
  const past = wall + HANG.probe;
  const px = f.x - n[0] * past;
  const pz = f.z - n[1] * past;
  const own = new Set(room.cells.map((c) => `${c.floor}:${c.ring}:${c.slot}`));
  const across = seeThrough(layout, own, f.floor, Math.hypot(px, pz), Math.atan2(pz, px)) || onCorridorAt(layout, f.floor, px, pz);
  const k = across ? ACROSS : 1;
  const [y0, y1] = floorSpan(f.floor);
  return { nx: n[0] * k, nz: n[1] * k, y0, y1, ax: f.x - n[0] * wall, az: f.z - n[1] * wall };
}

/** How far past a room's wall to look for what's across it: past the wall's hairline, or into a corridor alongside. */
const HANG = { probe: 0.15 };

/** Solar panels: dark glass, dulled by dust in a storm (see `setPanelDust`). */
const PANEL = { clean: 0x1d2a4a, dusty: 0x8a6048, roughness: [0.3, 0.9] as const, metalness: [0.5, 0.1] as const };
let panels: THREE.MeshStandardMaterial | null = null;
function panelMaterial(): THREE.MeshStandardMaterial {
  panels ??= new THREE.MeshStandardMaterial({ color: PANEL.clean, metalness: PANEL.metalness[0], roughness: PANEL.roughness[0] });
  return panels;
}

/** Dust on the solar panels: 0 clean to 1 caked. */
export function setPanelDust(level: number): void {
  const m = panelMaterial();
  m.color.set(PANEL.clean).lerp(new THREE.Color(PANEL.dusty), level);
  m.roughness = PANEL.roughness[0] + (PANEL.roughness[1] - PANEL.roughness[0]) * level;
  m.metalness = PANEL.metalness[0] + (PANEL.metalness[1] - PANEL.metalness[0]) * level;
}

/** A room's own shade of its category's colour, for its furnishings: a touch lighter or darker, warmer or cooler. */
function roomAccent(color: number, roomId: number): number {
  const c = new THREE.Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL((hsl.h + (roomRoll(roomId, 101) - 0.5) * 0.06 + 1) % 1, hsl.s * (0.85 + roomRoll(roomId, 102) * 0.3), Math.min(0.85, Math.max(0.15, hsl.l + (roomRoll(roomId, 103) - 0.5) * 0.16)));
  return c.getHex();
}

const furnitureCache = new Map<string, THREE.Group>();
function roomFurniture(layout: Layout, room: RoomInstance, shapeKey: string, color: number, topFloor: number | null): THREE.Group | null {
  // Stairs and elevators are furnished on several floors: above a chosen floor, theirs go too.
  // A farm's crop changes what grows in its planters.
  // Each room varies its template its own way (furnish.ts), so its id is part of the key.
  const key = `furniture:${room.id}:${shapeKey}:${topFloor ?? "all"}:${room.crop ?? ""}`;
  let g = furnitureCache.get(key);
  if (!g) {
    const fitted = furnish(layout, room).filter((f) => topFloor === null || f.floor >= topFloor);
    if (!fitted.length) return null;
    g = furnitureGroup(layout, room, fitted, `#${roomAccent(color, room.id).toString(16).padStart(6, "0")}`);
    Object.assign(g.userData, { cached: true, key });
    g.traverse((o) => (o.userData.cached = true));
    furnitureCache.set(key, g);
  }
  return g;
}

/** Is there something to see at (r, a) on this floor, past a room's wall: the gallery, another room, empty space? Not rock. */
function seeThrough(layout: Layout, own: Set<string>, floor: number, r: number, a: number): boolean {
  const hole = layout.hole;
  if (r < hole.shaftRadiusM) return true; // the gallery
  const ring = Math.floor((r - hole.shaftRadiusM) / (ringRadii(hole, 1)[1] - ringRadii(hole, 1)[0])) + 1;
  if (ring > hole.unlockedRings) return false;
  const n = hole.ringSlots[ring - 1]!;
  const turn = (((a / TAU) % 1) + 1) % 1;
  const c = { floor, ring, slot: Math.min(Math.floor(turn * n), n - 1) };
  if (own.has(`${c.floor}:${c.ring}:${c.slot}`)) return false;
  return !!layout.grid[floor - 1]?.[ring - 1]?.[c.slot] || isOpen(layout, c);
}

/** Half a corridor's width: what a room gives up on a side a corridor runs along. */
const HALL = corridors.widthM / 2;

/**
 * Ring-1 cells: the face the shaft sees, for windows and doors. It ends where
 * the room's side walls stand, so a corridor carved along a side pulls the
 * windows back with it (the same angles `roomGeometry` uses).
 */
export function shaftFaces(layout: Layout, room: RoomInstance): { a0: number; a1: number; y0: number; r: number; floor: number }[] {
  const hole = layout.hole;
  const n = hole.ringSlots[0]!;
  const [r0] = ringRadii(hole, 1);
  const own = new Set(room.cells.map((c) => `${c.floor}:${c.ring}:${c.slot}`));
  // The side walls stand parallel to their borders: where they meet the shaft face, at r0.
  const pullBack = (c: Cell, slot: number, edge: number) => {
    if (own.has(`${c.floor}:1:${(slot + n) % n}`)) return 0; // the room carries on: no wall here
    return sideAngle(layout.corridors?.[`R${c.floor}.1.${edge % n}`] ? HALL : INSET, r0);
  };
  return room.cells
    .filter((c) => c.ring === 1)
    .map((c) => {
      const [s0, s1] = slotAngles(c.slot, n);
      const a0 = s0 + pullBack(c, c.slot - 1, c.slot);
      const a1 = s1 - pullBack(c, c.slot + 1, c.slot + 1);
      return { a0, a1, y0: floorSpan(c.floor)[0], r: r0, floor: c.floor };
    });
}

const materialCache = new Map<string, THREE.Material>();
function material(key: string, make: () => THREE.Material): THREE.Material {
  let m = materialCache.get(key);
  if (!m) materialCache.set(key, (m = make()));
  return m;
}
/** A material for tagged geometry (rooms, the shaft wall, windows, outlines), which lowers with walls down. */
function wallMaterial(key: string, make: () => THREE.Material): THREE.Material {
  return material(key, () => withWallsDown(make()));
}

// ---- walls down ----

/** How much of a lowered wall still stands. */
export const WALLS_DOWN = { stub: 0.15 };
const wallsDown = { uWallsDown: { value: 0 }, uWallStub: { value: WALLS_DOWN.stub } };

/** Lower or raise the walls that stand between the camera and what's behind them. */
export function setWallsDown(on: boolean): void {
  wallsDown.uWallsDown.value = on ? 1 : 0;
}

/**
 * Is a wall at `p`, bounding the side `n` points to, in the way of a camera at
 * `cam`: seen from its back, or (tagged with a longer normal) with something
 * to see across it? Then with walls down it's lowered. (The same test as the
 * shader below.)
 */
function inTheWay(nx: number, nz: number, px: number, pz: number, cam: THREE.Vector3): boolean {
  const n2 = nx * nx + nz * nz;
  if (n2 === 0) return false;
  // Something to see across it: in the way from either side.
  return n2 > 2 || (cam.x - px) * nx + (cam.z - pz) * nz < 0;
}

// Per vertex: lowered walls are squashed down to their stub. A wall is in the
// way when it's seen from behind (it hides its own room), or when there's
// something to see across it (tagged with a longer normal: it hides the
// neighbour from its own side). A line (a room's outline) may border two walls
// (`aWall2`), and only drops if both are lowered. Missing attributes read as
// zero, which never lowers anything.
const WALLS_GLSL = /* glsl */ `
  if (uWallsDown > 0.5 && dot(aWall.xy, aWall.xy) > 0.0) {
    vec2 toCam = cameraPosition.xz - (modelMatrix * vec4(transformed, 1.0)).xz;
    // The tags are in the model's own frame: turn them with it (a turned model, as in the dev tool's overview).
    vec2 n1 = (modelMatrix * vec4(aWall.x, 0.0, aWall.y, 0.0)).xz;
    vec2 m2 = (modelMatrix * vec4(aWall2.x, 0.0, aWall2.y, 0.0)).xz;
    float n2 = dot(aWall2.xy, aWall2.xy);
    bool second = n2 == 0.0 || n2 > 2.0 || dot(toCam, m2) < 0.0;
    bool first = dot(aWall.xy, aWall.xy) > 2.0 || dot(toCam, n1) < 0.0;
    if (first && second) transformed.y = min(transformed.y, mix(aWall.z, aWall.w, uWallStub));
  }
`;

// Per vertex, for wall hangings: when their wall is lowered (the same test as
// the walls, made at the point on the wall behind the item), the whole item
// collapses to that point, so nothing of it shows. A hanging is tagged like
// its wall (aWall) and carries that point (aHang).
const HANG_GLSL = /* glsl */ `
  if (uWallsDown > 0.5 && dot(aWall.xy, aWall.xy) > 0.0) {
    vec2 toCam = cameraPosition.xz - (modelMatrix * vec4(aHang.x, 0.0, aHang.y, 1.0)).xz;
    vec2 n1 = (modelMatrix * vec4(aWall.x, 0.0, aWall.y, 0.0)).xz;
    if (dot(aWall.xy, aWall.xy) > 2.0 || dot(toCam, n1) < 0.0) transformed = vec3(aHang.x, aWall.z, aHang.y);
  }
`;

/** A wall hanging's material: gone whenever its wall is lowered. */
export function withHangingDown<T extends THREE.Material>(m: T): T {
  const prev = m.onBeforeCompile;
  const prevKey = m.customProgramCacheKey();
  m.onBeforeCompile = (shader, renderer) => {
    prev.call(m, shader, renderer);
    Object.assign(shader.uniforms, wallsDown);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec4 aWall;\nattribute vec2 aHang;\nuniform float uWallsDown;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${HANG_GLSL}`);
  };
  m.customProgramCacheKey = () => `${prevKey}|hanging-down`;
  return m;
}

export function withWallsDown<T extends THREE.Material>(m: T): T {
  // On top of anything the material's shader already does (a procedural surface).
  const prev = m.onBeforeCompile;
  const prevKey = m.customProgramCacheKey();
  m.onBeforeCompile = (shader, renderer) => {
    prev.call(m, shader, renderer);
    Object.assign(shader.uniforms, wallsDown);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec4 aWall;\nattribute vec2 aWall2;\nuniform float uWallsDown;\nuniform float uWallStub;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${WALLS_GLSL}`);
  };
  m.customProgramCacheKey = () => `${prevKey}|walls-down`;
  return m;
}

/** Did the ray hit part of a wall that's lowered right now (so it isn't there to click)? */
export function loweredAt(hit: THREE.Intersection, cam: THREE.Vector3): boolean {
  if (!wallsDown.uWallsDown.value || !hit.face) return false;
  const attr = (hit.object as THREE.Mesh).geometry?.getAttribute("aWall");
  if (!attr) return false;
  const i = hit.face.a;
  const [nx, nz, y0, y1] = [attr.getX(i), attr.getY(i), attr.getZ(i), attr.getW(i)];
  if (!inTheWay(nx, nz, hit.point.x, hit.point.z, cam)) return false;
  return hit.point.y > y0 + (y1 - y0) * WALLS_DOWN.stub + 1e-3;
}

/**
 * A room's outline, with each segment knowing the walls it borders, so the
 * outline drops with them. Segments are matched to the triangles they came from.
 */
export function outlineGeometry(geo: THREE.BufferGeometry): THREE.EdgesGeometry {
  const edges = new THREE.EdgesGeometry(geo, 30);
  const pos = geo.getAttribute("position");
  const walls = geo.getAttribute("aWall");
  if (!walls) return edges;
  const key = (x: number, y: number, z: number) => `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
  const vkey = (i: number) => key(pos.getX(i), pos.getY(i), pos.getZ(i));
  const pair = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  // Every triangle side on a wall: the walls it belongs to.
  const bySide = new Map<string, number[][]>();
  for (let t = 0; t < pos.count; t += 3) {
    if (walls.getX(t) === 0 && walls.getY(t) === 0) continue;
    const w = [walls.getX(t), walls.getY(t), walls.getZ(t), walls.getW(t)];
    const k = [vkey(t), vkey(t + 1), vkey(t + 2)];
    for (const [a, b] of [[0, 1], [1, 2], [2, 0]] as const) {
      const id = pair(k[a]!, k[b]!);
      const list = bySide.get(id) ?? [];
      // One entry per wall: the two triangles of a face agree.
      if (!list.some((x) => x[0] === w[0] && x[1] === w[1])) list.push(w);
      bySide.set(id, list);
    }
  }
  const ep = edges.getAttribute("position");
  const kept: number[] = [];
  const a1: number[] = [];
  const a2: number[] = [];
  for (let i = 0; i < ep.count; i += 2) {
    const id = pair(key(ep.getX(i), ep.getY(i), ep.getZ(i)), key(ep.getX(i + 1), ep.getY(i + 1), ep.getZ(i + 1)));
    const [w1, w2] = bySide.get(id) ?? [];
    // Only the lines a wall makes (its top, its corners, where it meets the floor). The floor's own rim runs a
    // hairline past the walls, and would otherwise hang in the air at the top of a lowered wall on the floor below.
    if (!w1) continue;
    for (let j = 0; j < 2; j++) {
      kept.push(ep.getX(i + j), ep.getY(i + j), ep.getZ(i + j));
      a1.push(...w1);
      a2.push(w2?.[0] ?? 0, w2?.[1] ?? 0);
    }
  }
  edges.setAttribute("position", new THREE.Float32BufferAttribute(kept, 3));
  edges.setAttribute("aWall", new THREE.Float32BufferAttribute(a1, 4));
  edges.setAttribute("aWall2", new THREE.Float32BufferAttribute(a2, 2));
  return edges;
}

/** Windows glow brighter as the sky darkens: 0 at noon, 1 at night. */
export function setNightGlow(night: number): void {
  const glass = materialCache.get("glass") as THREE.MeshStandardMaterial | undefined;
  if (glass) glass.emissiveIntensity = 1 + night * GLOW.windowBoost;
  const tubeLamp = materialCache.get("tube:lamp") as THREE.MeshStandardMaterial | undefined;
  if (tubeLamp) tubeLamp.emissiveIntensity = 0.3 + night * 1.4;
  setFurnitureGlow(night);
}

export function disposeRoomMaterials(): void {
  materialCache.forEach((m) => m.dispose());
  materialCache.clear();
  stripeTexture?.dispose();
  stripeTexture = null;
  labelCache.forEach(({ material }) => {
    material.map?.dispose();
    material.dispose();
  });
  labelCache.clear();
  shapeCache.forEach(({ geo, edges }) => {
    geo.dispose();
    edges.dispose();
  });
  shapeCache.clear();
  furnitureCache.forEach((g) => disposeFurniture(g));
  furnitureCache.clear();
  disposeFurnitureMaterials();
}

/** A room's walls and floor in the material it's built from, with walls down. */
function finishWallMaterial(finish: Finish, grime = 0): THREE.Material {
  return wallMaterial(`finish:${finish}:${grime}`, () => withGrime(finishMaterial(finish), grime));
}

/** What a built room's floor is laid in, by its category (room colours on). */
const FLOOR_BY_CATEGORY: Record<string, FloorKind> = {
  housing: "planks",
  health: "tiles",
  food: "tiles",
  admin: "planks",
  public: "paving",
  circulation: "tiles",
  industry: "plate",
  power: "plate",
  air: "plate",
  water: "plate",
  storage: "concrete",
  logistics: "concrete",
  construction: "concrete",
  excavation: "concrete",
  services: "tiles",
};

function roomMaterial(color: number, planned: boolean, faint = false, building = false, floor: FloorKind = "concrete", grime = 0): THREE.Material {
  // Under construction: the room's colour through semi-opaque diagonal stripes.
  if (building && !faint) {
    return wallMaterial(`building:${color}`, () =>
      new THREE.MeshStandardMaterial({ color, map: stripes(), transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, roughness: 0.9 }),
    );
  }
  return wallMaterial(`room:${color}:${planned}:${faint}:${planned || faint ? "" : `${floor}:${grime}`}`, () =>
    planned || faint
      ? new THREE.MeshStandardMaterial({
          color,
          transparent: true,
          opacity: planned ? 0.3 : XRAY.ring1,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      : withGrime(withFloor(new THREE.MeshStandardMaterial({ color, roughness: 0.75, side: THREE.DoubleSide }), floor), grime),
  );
}

/** A room's trouble, shown on it: a badge floating over its label, with the reason's icon. */
export function statusBadge(icon: string): THREE.Sprite {
  const sprite = label(icon, "#ffffff");
  sprite.userData = { badge: true };
  return sprite;
}

/** Outlines for rooms in trouble: amber when slowed (staff, morale, the weather), red when short of what they run on, grey when paused. */
const TROUBLE_EDGE = { warn: 0xf0a030, bad: 0xe0503a, idle: 0x9a9a9a } as const;
const troubleEdges = new Map<string, THREE.LineBasicMaterial>();
export function troubleEdgeMaterial(level: keyof typeof TROUBLE_EDGE): THREE.LineBasicMaterial {
  let m = troubleEdges.get(level);
  // Lowered with their walls, as the ordinary outlines are.
  if (!m) troubleEdges.set(level, (m = withWallsDown(new THREE.LineBasicMaterial({ color: TROUBLE_EDGE[level] }))));
  return m;
}

/** Label materials are shared by text: a colony has hundreds of rooms but few distinct names. */
const labelCache = new Map<string, { material: THREE.SpriteMaterial; aspect: number }>();

/** A name floating in front of the room, readable from across the shaft. */
function label(text: string, color: string): THREE.Sprite {
  const key = `${text}|${color}`;
  let cached = labelCache.get(key);
  if (!cached) {
    cached = drawLabel(text, color);
    labelCache.set(key, cached);
  }
  const sprite = new THREE.Sprite(cached.material);
  sprite.scale.set(LABEL.heightM * cached.aspect, LABEL.heightM, 1);
  return sprite;
}

function drawLabel(text: string, color: string): { material: THREE.SpriteMaterial; aspect: number } {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = `600 ${LABEL.px}px ${UI_FONT}`;
  const w = Math.ceil(ctx.measureText(text).width) + 24;
  canvas.width = w;
  canvas.height = LABEL.px + 20;
  ctx.font = `600 ${LABEL.px}px ${UI_FONT}`;
  ctx.fillStyle = "rgba(20, 10, 8, 0.72)";
  ctx.beginPath();
  ctx.roundRect(0, 0, w, canvas.height, 12);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(text, 12, canvas.height / 2 + 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { material: new THREE.SpriteMaterial({ map: tex, depthTest: true, depthWrite: false, transparent: true }), aspect: w / canvas.height };
}

/**
 * Room solids and outlines, kept between rebuilds: most layout changes touch
 * one room, so the other few hundred reuse what they had. Entries not used by
 * the latest build are freed.
 */
const shapeCache = new Map<string, { geo: THREE.BufferGeometry; edges: THREE.EdgesGeometry }>();

function roomShape(layout: Layout, room: RoomInstance): { geo: THREE.BufferGeometry; edges: THREE.EdgesGeometry; key: string } {
  // Corridors along its sides, and turns at its corners, change its shape, so they're part of the key.
  const outside = outsideEdges(layout.hole, room.cells);
  const joints = corridorJoints(layout);
  const halls = [
    ...outside.filter((e) => layout.corridors?.[e.id]).map((e) => e.id),
    ...[...new Set(outside.flatMap((e) => edgeVertices(layout.hole, e)))].filter((v) => joints.has(v)),
  ].join(",");
  // What's around it (rock, or something to see) decides which walls can come down.
  const around = neighborCells(layout.hole, room.cells)
    .map((c) => (layout.grid[c.floor - 1]?.[c.ring - 1]?.[c.slot] || isOpen(layout, c) ? 1 : 0))
    .join("");
  // A private room, once it's more than a plan, has its windows and doors cut through.
  const doors = room.planned ? null : doorways(layout, room);
  const key = `${room.id}:${layout.hole.shaftRadiusM}:${room.cells.map((c) => `${c.floor}.${c.ring}.${c.slot}`).join(",")}:${halls}:${around}:${doors ? "open" : "shut"}`;
  let shape = shapeCache.get(key);
  if (!shape) {
    const geo = roomGeometry(layout, room.cells, INSET, true, !!roomDef(room.type).public, doors, stairWells(layout, room));
    shape = { geo, edges: outlineGeometry(geo) };
    shapeCache.set(key, shape);
  }
  return { ...shape, key };
}

// ---- surface props, standing on y = 0 around the rim ----

function surfaceProp(room: RoomInstance, layout: Layout, color: number): THREE.Object3D {
  const total = layout.surface.length;
  const span = (room.surfaceCells.length / total) * TAU;
  const start = (Math.min(...room.surfaceCells) / total) * TAU;
  const mid = start + span / 2;
  const r = layout.hole.shaftRadiusM + SURFACE_RING_M;
  const g = new THREE.Group();
  g.position.set(r * Math.cos(mid), 0, r * Math.sin(mid));
  g.rotation.y = -mid;
  const mat = (c: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
    material(`prop:${c}:${JSON.stringify(extra)}`, () => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...extra }));

  if (room.type === "landing_pod") {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(6, 24, 12, 0, TAU, 0, Math.PI / 2), mat(color));
    g.add(dome);
    for (const dz of [-2.5, 0, 2.5]) {
      const win = new THREE.Mesh(new THREE.CircleGeometry(0.6, 12), mat(0x9fd2ff, { emissive: 0x3a6f99 }));
      win.position.set(-4.6, 3.2, dz);
      win.rotation.y = -Math.PI / 2;
      g.add(win);
    }
  } else if (room.type === "landing_pad") {
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(7, 7.4, 0.5, 32), mat(color)));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(5, 0.15, 6, 48), mat(0xf0e0d0, { emissive: 0x554433 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.3;
    g.add(ring);
  } else if (room.type === "solar_array") {
    for (const dz of [-3, 0, 3]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.6), mat(0x555555));
      post.position.set(0, 0.8, dz);
      g.add(post);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 2.4), panelMaterial());
      panel.position.set(0, 1.7, dz);
      panel.rotation.z = 0.5;
      g.add(panel);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.06, 2.5), mat(color));
      frame.position.copy(panel.position).setY(1.62);
      frame.rotation.z = 0.5;
      g.add(frame);
    }
  } else if (room.type === "rover_depot") {
    const garage = new THREE.Mesh(new THREE.BoxGeometry(5, 2.6, 6), mat(color));
    garage.position.set(0, 1.3, -4);
    g.add(garage);
    for (const dz of [2, 6]) {
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 3.2), mat(0xd8c8b0));
      body.position.set(0, 0.9, dz);
      g.add(body);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 1.2), mat(0x9fd2ff, { emissive: 0x2a4a66 }));
      cab.position.set(0, 1.6, dz + 0.8);
      g.add(cab);
      for (const [wx, wz] of [[-1.1, -1], [1.1, -1], [-1.1, 1], [1.1, 1]] as const) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 12), mat(0x2a2220));
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wx, 0.45, dz + wz);
        g.add(wheel);
      }
    }
  } else {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(6, 3, 6), mat(color)));
  }
  return g;
}

/**
 * Everything that depends on the layout: rooms, the shaft wall where no room
 * faces it, and surface props. digFloor is the floor being dug, if any.
 */
/**
 * Everything that depends on the layout. With `topFloor`, nothing above that
 * floor is built (shallower floors and surface props), and the floor's empty
 * cells get a rock cap, so from above it reads as a plan and its empty cells
 * can be picked.
 */
export function buildLayout(
  layout: Layout,
  digFloor: number | null,
  colors: RoomColors,
  xray = false,
  topFloor: number | null = null,
  roomColors = true,
  /** Each room's wear, 0 (spotless) to 3: see view/grime.ts. */
  grimeOf: (room: RoomInstance) => number = () => 0,
): THREE.Group {
  const group = new THREE.Group();
  const hole = layout.hole;
  const n1 = hole.ringSlots[0]!;
  const rock = wallMaterial(`rock:${colors.rock}:${xray}`, () =>
    withRock(
      xray
        ? new THREE.MeshStandardMaterial({ color: colors.rock, transparent: true, opacity: XRAY.wall, depthWrite: false, side: THREE.DoubleSide })
        : new THREE.MeshStandardMaterial({ color: colors.rock, roughness: 0.95, side: THREE.DoubleSide }),
    ),
  );

  // The shaft wall, wherever a built room doesn't replace it.
  const lastFloor = digFloor ?? hole.floors;
  const wall = tagged();
  for (let floor = topFloor ?? 1; floor <= lastFloor; floor++) {
    const [y0, y1] = floorSpan(floor);
    for (let slot = 0; slot < n1; slot++) {
      const id = layout.grid[floor - 1]?.[0]?.[slot];
      const room = id ? layout.rooms.find((r) => r.id === id) : undefined;
      if (room && !room.planned) continue;
      // Dug-out empty space opens right onto a gallery tube; with none, it's walled off from the shaft.
      if (!room && floor <= hole.floors && isOpen(layout, { floor, ring: 1, slot }) && tubeAt(layout, floor, slot)) continue;
      // A corridor's mouth: the wall stops half a corridor short of the spoke on either side.
      const [s0, s1] = slotAngles(slot, n1);
      const mouth = (i: number) => (layout.corridors?.[`R${floor}.1.${i % n1}`] ? HALL / hole.shaftRadiusM : 0);
      const a0 = s0 + mouth(slot);
      const a1 = s1 - mouth(slot + 1);
      if (a1 > a0) curvedFace(wall, hole.shaftRadiusM, a0, a1, y0, y1, { side: -1 }); // open toward the shaft
    }
  }
  // The crust: a collar of rock from floor 1's ceiling up to the surface, all the way round.
  if (topFloor === null) {
    const [, top] = floorSpan(1);
    for (let slot = 0; slot < n1; slot++) curvedFace(wall, hole.shaftRadiusM, ...slotAngles(slot, n1), top, 0, { side: -1 });
  }
  const wallMesh = new THREE.Mesh(geometry(wall), rock);
  wallMesh.userData = { pickable: true, wall: true, faint: xray };
  group.add(wallMesh);
  // Solid rock where it meets dug-out space, so nothing shows through behind or above a room. X-ray looks past it.
  if (!xray) {
    const faces = rockFaces(layout, topFloor);
    if (faces.length) group.add(new THREE.Mesh(geometry(faces), rock));
  }

  const used = new Set<string>();
  // See-through glass: you can look into a room from the gallery, and out of it.
  const glass = wallMaterial("glass", () =>
    withFresnel(withCondensation(new THREE.MeshStandardMaterial({ color: WINDOW.color, emissive: 0x2a3f55, roughness: 0.1, metalness: 0.3, transparent: true, opacity: WINDOW.opacity, depthWrite: false, side: THREE.DoubleSide }))),
  );
  const doorFrame = wallMaterial("door", () => new THREE.MeshStandardMaterial({ color: DOOR_FRAME.color, roughness: 0.9, side: THREE.DoubleSide }));
  const strandedLine = wallMaterial(`stranded:${colors.stranded}`, () => new THREE.LineBasicMaterial({ color: colors.stranded })) as THREE.LineBasicMaterial;
  const edgeLine = wallMaterial("edges", () => new THREE.LineBasicMaterial({ color: 0x1a0f0d, transparent: true, opacity: 0.5 })) as THREE.LineBasicMaterial;

  if (topFloor !== null) group.add(...floorCap(layout, topFloor, xray));
  // No corridors yet: add() with nothing to add is an error in three.js.
  const halls = corridorFloors(layout, topFloor);
  if (halls.length) group.add(...halls);
  const tubes = galleryTubes(layout, digFloor, topFloor);
  if (tubes.length) group.add(...tubes);
  const empty = emptySpace(layout, topFloor);
  if (empty.length) group.add(...empty);

  for (const whole of layout.rooms) {
    // Above the chosen floor there's nothing; tall rooms keep only the part at or below it.
    const room = topFloor === null ? { ...whole } : { ...whole, cells: whole.cells.filter((c) => c.floor >= topFloor) };
    if (topFloor !== null && (room.at.kind === "surface" || !room.cells.length)) continue;
    const def = roomDef(room.type);
    const color = CATEGORY_COLORS[def.category] ?? 0x888888;
    if (room.at.kind === "surface") {
      const prop = surfaceProp(room, layout, color);
      prop.traverse((o) => (o.userData = { pickable: true, roomId: room.id, surface: true }));
      group.add(prop);
      continue;
    }
    // A cargo elevator: a dark shaft down through the floors above its stop, and the stop itself as a room.
    if (def.cargoShaft) {
      const stop = Math.max(...whole.cells.map((c) => c.floor));
      const shaftCells = room.cells.filter((c) => c.floor < stop);
      if (shaftCells.length) {
        const column = new THREE.Mesh(roomGeometry(layout, shaftCells, INSET, false), material(`cargoShaft:${color}`, () => new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.35), roughness: 0.6, metalness: 0.4, side: THREE.DoubleSide })));
        column.userData = { pickable: true, roomId: room.id };
        group.add(column);
      }
      if (topFloor === null) group.add(headframe(layout, whole, color));
      room.cells = room.cells.filter((c) => c.floor === stop);
      if (!room.cells.length) continue;
    }
    if (def.surfaceLink && !def.cargoShaft && topFloor === null) group.add(airlock(layout, room, color));
    const shape = roomShape(layout, room);
    used.add(shape.key);
    const faint = xray && room.cells.some((c) => c.ring === 1);
    // Built rooms show their category's colour, or (room colours off) what they're built from.
    const shown = !roomColors && !room.planned && !room.building && !faint;
    const floorKind = room.type === "farm" ? "plate" : (FLOOR_BY_CATEGORY[def.category] ?? "concrete");
    const grime = grimeOf(whole);
    const mesh = new THREE.Mesh(shape.geo, shown ? finishWallMaterial(roomFinish(room.type), grime) : roomMaterial(color, room.planned, faint, !!room.building, floorKind, grime));
    mesh.userData = { pickable: true, roomId: room.id, faint, cached: true };
    group.add(mesh);
    const edges = new THREE.LineSegments(shape.edges, room.connected ? edgeLine : strandedLine);
    edges.userData = { cached: true, roomId: room.id, outline: !room.planned && !room.building && room.connected };
    group.add(edges);
    // Its furniture, once it's built (not in x-ray's faded ring 1, nor above a chosen floor).
    if (!faint && !whole.planned && !whole.building) {
      const furniture = roomFurniture(layout, whole, shape.key, color, topFloor);
      if (furniture) {
        used.add(furniture.userData.key);
        group.add(furniture);
      }
    }

    if (!room.planned && !faint && !def.public) {
      // Shaft frontage: glass in the window band cut through every ring-1 face, and a
      // framed doorway on each floor, in the middle of the room's run (the room's shape cuts the openings).
      const faces = shaftFaces(layout, room);
      const doors = doorways(layout, room);
      const win = tagged();
      const frames = tagged();
      // They go down with the wall they're set in.
      const inWall = (f: { y0: number }): Cut => ({ side: 1, y0: f.y0, y1: f.y0 + FLOOR_H, across: true });
      for (const f of faces) {
        const [g0, g1] = [f.a0 + WINDOW.margin, f.a1 - WINDOW.margin];
        const span = windowSpan(tubeAtAngle(layout, f.floor, (f.a0 + f.a1) / 2));
        const [y0, y1] = [f.y0 + span.bottom, f.y0 + span.top];
        const door = doors.find((d) => floorSpan(d.floor)[0] === f.y0 && d.angle > f.a0 && d.angle < f.a1);
        if (!door) {
          curvedFace(win, f.r - WINDOW.inset, g0, g1, y0, y1, inWall(f));
          continue;
        }
        // The glass stops at the door's frame, which stands just proud of the wall.
        const fw = DOOR_FRAME.width / door.r;
        const [d0, d1] = [door.angle - door.half, door.angle + door.half];
        if (d0 - fw > g0) curvedFace(win, f.r - WINDOW.inset, g0, d0 - fw, y0, y1, inWall(f));
        if (g1 > d1 + fw) curvedFace(win, f.r - WINDOW.inset, d1 + fw, g1, y0, y1, inWall(f));
        const r = f.r - WINDOW.inset * 2;
        const top = f.y0 + DOOR.height;
        curvedFace(frames, r, d0 - fw, d0, f.y0, top + DOOR_FRAME.width, inWall(f));
        curvedFace(frames, r, d1, d1 + fw, f.y0, top + DOOR_FRAME.width, inWall(f));
        curvedFace(frames, r, d0, d1, top, top + DOOR_FRAME.width, inWall(f));
      }
      if (win.length) group.add(new THREE.Mesh(geometry(win), glass));
      if (frames.length) group.add(new THREE.Mesh(geometry(frames), doorFrame));
    }

    if (def.short) {
      const first = [...room.cells].sort((a, b) => a.ring - b.ring || a.slot - b.slot)[0]!;
      const n = hole.ringSlots[first.ring - 1]!;
      const [a0, a1] = slotAngles(first.slot, n);
      const [r0] = ringRadii(hole, first.ring);
      const y1 = floorSpan(first.floor)[1];
      const name = roomLabel(whole);
      const sprite = label(room.connected ? name : `${name} ⚠`, room.planned ? "#d8c0ae" : "#f6efe6");
      const a = (a0 + a1) / 2;
      sprite.position.set((r0 - 0.6) * Math.cos(a), y1 - 0.8, (r0 - 0.6) * Math.sin(a));
      sprite.userData = { label: true, cached: true, roomId: room.id };
      group.add(sprite);
    }
  }
  for (const [key, shape] of shapeCache) {
    if (used.has(key)) continue;
    shape.geo.dispose();
    shape.edges.dispose();
    shapeCache.delete(key);
  }
  for (const [key, g] of furnitureCache) {
    if (used.has(key)) continue;
    disposeFurniture(g);
    furnitureCache.delete(key);
  }
  return group;
}

// ---- empty space, and what stands at the rim ----

const PILLAR = { half: 0.3, inset: 0.9, color: 0x5a4235 };
const EMPTY_FLOOR = 0x6e5445;

/** A square pillar from y0 to y1, as triangles. */
function pillar(pos: number[], x: number, z: number, y0: number, y1: number, h: number): void {
  const c = [[x - h, z - h], [x + h, z - h], [x + h, z + h], [x - h, z + h]] as const;
  for (let i = 0; i < 4; i++) {
    const [ax, az] = c[i]!;
    const [bx, bz] = c[(i + 1) % 4]!;
    push(pos, [ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y0, az], [bx, y1, bz], [ax, y1, az]);
  }
}

/**
 * Dug-out cells with no room: a bare floor you can build on (picked like a
 * room's floor), and a pillar at each corner holding up the rock above. No walls.
 */
function emptySpace(layout: Layout, topFloor: number | null): THREE.Object3D[] {
  const hole = layout.hole;
  const floorPos: number[] = [];
  const pillars: number[] = [];
  for (let floor = topFloor ?? 1; floor <= hole.floors; floor++) {
    const [y0, y1] = floorSpan(floor);
    for (let ring = 1; ring <= hole.unlockedRings; ring++) {
      const n = hole.ringSlots[ring - 1]!;
      const [r0, r1] = ringRadii(hole, ring);
      for (let slot = 0; slot < n; slot++) {
        const c = { floor, ring, slot };
        if (!isOpen(layout, c) || layout.grid[floor - 1]?.[ring - 1]?.[slot]) continue;
        const [a0, a1] = slotAngles(slot, n);
        flatRing(floorPos, r0 + INSET, r1 - INSET, a0 + INSET / r0, a1 - INSET / r1, y0 + 0.02);
        for (const r of [r0 + PILLAR.inset, r1 - PILLAR.inset]) {
          for (const a of [a0 + PILLAR.inset / r, a1 - PILLAR.inset / r]) pillar(pillars, r * Math.cos(a), r * Math.sin(a), y0, y1, PILLAR.half);
        }
      }
    }
  }
  if (!floorPos.length) return [];
  const floorMesh = new THREE.Mesh(geometry(floorPos), material("emptyFloor", () => new THREE.MeshStandardMaterial({ color: EMPTY_FLOOR, roughness: 1, side: THREE.DoubleSide })));
  floorMesh.userData = { pickable: true, empty: true };
  const pillarMesh = new THREE.Mesh(geometry(pillars), material("pillar", () => new THREE.MeshStandardMaterial({ color: PILLAR.color, roughness: 0.9 })));
  return [floorMesh, pillarMesh];
}

/** Where a ring room meets the rim, above its floor-1 cells: the angle, and just outside the shaft's edge. */
function rimSpot(layout: Layout, room: RoomInstance): { a: number; r: number } {
  const hole = layout.hole;
  const top = room.cells.filter((c) => c.floor === Math.min(...room.cells.map((x) => x.floor)));
  let x = 0;
  let z = 0;
  let r = 0;
  for (const c of top) {
    const [a0, a1] = slotAngles(c.slot, hole.ringSlots[c.ring - 1]!);
    const a = (a0 + a1) / 2;
    const [r0, r1] = ringRadii(hole, c.ring);
    x += Math.cos(a);
    z += Math.sin(a);
    r += (r0 + r1) / 2;
  }
  return { a: Math.atan2(z, x), r: r / Math.max(1, top.length) };
}

/** The entrance's airlock on the surface: a long low hall along the rim, with round hatches and a ramp. */
function airlock(layout: Layout, room: RoomInstance, color: number): THREE.Object3D {
  const { a } = rimSpot(layout, room);
  const r = layout.hole.shaftRadiusM + 4;
  const g = new THREE.Group();
  g.position.set(r * Math.cos(a), 0, r * Math.sin(a));
  g.rotation.y = -a;
  const mat = (c: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
    material(`prop:${c}:${JSON.stringify(extra)}`, () => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...extra }));
  const hall = new THREE.Mesh(new THREE.CapsuleGeometry(1.6, 7, 6, 16), mat(color));
  hall.rotation.x = Math.PI / 2;
  hall.position.y = 1.6;
  g.add(hall);
  for (const dz of [-2.5, 0, 2.5]) {
    const hatch = new THREE.Mesh(new THREE.CircleGeometry(0.7, 16), mat(0x3a2a22, { metalness: 0.4 }));
    hatch.position.set(-1.62, 1.6, dz);
    hatch.rotation.y = -Math.PI / 2;
    g.add(hatch);
  }
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 3), mat(new THREE.Color(color).multiplyScalar(0.6).getHex()));
  ramp.position.set(2.6, 0.15, 0);
  g.add(ramp);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), mat(0xe07a3f, { emissive: 0xe07a3f }));
  beacon.position.set(0, 3.5, 0);
  g.add(beacon);
  g.traverse((o) => (o.userData = { pickable: true, roomId: room.id, surface: true }));
  return g;
}

/** A cargo elevator's headframe: an A-frame over its shaft, with the sheave wheel on top. */
function headframe(layout: Layout, room: RoomInstance, color: number): THREE.Object3D {
  const { a, r } = rimSpot(layout, room);
  const g = new THREE.Group();
  g.position.set(r * Math.cos(a), 0, r * Math.sin(a));
  g.rotation.y = -a;
  const steel = material(`prop:${color}:frame`, () => new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.55), metalness: 0.5, roughness: 0.5 }));
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 9), steel);
    leg.position.set(0, 4.2, s * 1.8);
    leg.rotation.x = s * 0.22;
    g.add(leg);
  }
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.18, 6, 20), material(`prop:${color}:{}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.7 })));
  wheel.position.set(0, 8.6, 0);
  g.add(wheel);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.6, 16), steel);
  collar.position.y = 0.3;
  g.add(collar);
  g.traverse((o) => (o.userData = { pickable: true, roomId: room.id, surface: true }));
  return g;
}

/** How each finish looks in 3D: its colour, and a surface to match. */
const FINISH_LOOK: Record<string, THREE.MeshStandardMaterialParameters> = {
  rock: { roughness: 1 },
  marscrete: { roughness: 0.85 },
  brick: { roughness: 0.9 },
  metal: { roughness: 0.35, metalness: 0.6 },
};
const UNLINKED = 0xe0503a;

/** A corridor's floor: a strip centred on its border, `lift` above the floor (or on the cut, from above). */
export function corridorStripGeometry(layout: Layout, e: Edge, y: number): THREE.BufferGeometry {
  const hole = layout.hole;
  const pos: number[] = [];
  if (e.kind === "radial") {
    const a = e.turn * TAU;
    const [r0, r1] = ringRadii(hole, e.ring);
    // A flat rectangle along the spoke, HALL either side of it.
    const px = -Math.sin(a) * HALL;
    const pz = Math.cos(a) * HALL;
    const p = (r: number, s: number) => [r * Math.cos(a) + px * s, y, r * Math.sin(a) + pz * s];
    push(pos, p(r0, -1), p(r1, -1), p(r1, 1), p(r0, -1), p(r1, 1), p(r0, 1));
  } else {
    const r = ringRadii(hole, e.circle)[1];
    flatRing(pos, r - HALL, r + HALL, e.a0 * TAU, e.a1 * TAU, y);
  }
  return geometry(pos);
}

/**
 * Every corridor's floor, one mesh per finish (and one for corridors not yet
 * linked to the shaft, tinted red). Just above the floor; with a floor chosen
 * from above, on the cut instead, so they show over the cap.
 */
function corridorFloors(layout: Layout, topFloor: number | null): THREE.Object3D[] {
  const hole = layout.hole;
  const groups = new Map<string, number[]>();
  for (const [id, finish] of Object.entries(layout.corridors ?? {})) {
    const e = edgeById(hole, id);
    if (!e || e.floor > hole.floors + 1 || isGalleryEdge(e)) continue;
    if (topFloor !== null && e.floor < topFloor) continue;
    // Corridors have no ceiling: always on the floor, open to the sky or the cut above.
    const y = floorSpan(e.floor)[0] + 0.05;
    const linked = !!layout.corridorLinked?.[id] || e.floor > hole.floors;
    // Not built yet: see-through, like a blueprint.
    const building = layout.corridorsBuilding?.[id] !== undefined;
    const key = `${finish}:${linked || building}:${building}`;
    const geo = corridorStripGeometry(layout, e, y);
    const arr = geo.getAttribute("position").array as Float32Array;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(...arr);
    geo.dispose();
  }
  // Square joints where corridors turn, so the outer edges meet in a clean corner.
  for (const joint of corridorJoints(layout).values()) {
    if (joint.floor > hole.floors + 1 || joint.circle === 0 || (topFloor !== null && joint.floor < topFloor)) continue;
    const r = hole.shaftRadiusM + joint.circle * (ringRadii(hole, 1)[1] - ringRadii(hole, 1)[0]);
    const a = joint.turn * TAU;
    const key = `${joint.finish}:true:false`;
    const pos: number[] = [];
    flatRing(pos, r - HALL, r + HALL, a - HALL / r, a + HALL / r, floorSpan(joint.floor)[0] + 0.05);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(...pos);
  }
  const out: THREE.Object3D[] = [];
  for (const [key, pos] of groups) {
    const [finish, linked, building] = key.split(":");
    const f = finishDef(finish!);
    const color = linked === "true" ? parseInt(f.color.slice(1), 16) : UNLINKED;
    const see = building === "true" ? { transparent: true, opacity: 0.35, depthWrite: false } : {};
    const mat = material(`hall:${key}`, () => {
      const m = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, ...FINISH_LOOK[finish!], ...see });
      // A corridor cut through the rock shows the rock's layers underfoot.
      return finish === "rock" ? withRock(m) : m;
    });
    const mesh = new THREE.Mesh(geometry(pos), mat);
    mesh.userData = { pickable: true, hall: true };
    out.push(mesh);
  }
  return out;
}

/** Gallery tubes: how tall the glass is above the tube's floor, how often a rib holds it up, and the look. */
const TUBE = { height: 3.3, ribEveryM: 2.4, ribM: 0.12, slab: 0x7a6a5e, rib: 0x9aa4ab, glass: 0xa8d4f0, glassOpacity: 0.14, lamp: 0xffc98a };

/**
 * Gallery tubes: on each floor, a glass-walled walkway on the ledge inside the
 * shaft wall wherever one's built: a floor slab, a curved glass wall and roof
 * (no roof with a floor picked: nothing has a ceiling then), ribs holding the
 * glass, a railing, and lamps along the roof. Where there's no tube, a nearly
 * invisible ledge, so the corridor tool can point at the shaft wall there.
 */
function galleryTubes(layout: Layout, digFloor: number | null, topFloor: number | null): THREE.Object3D[] {
  const hole = layout.hole;
  const R = hole.shaftRadiusM;
  const rOpen = openShaftRadius(hole);
  const last = digFloor ?? hole.floors;
  const slab: number[] = [];
  const ghostSlab: number[] = [];
  const unlinked: number[] = [];
  const glass: number[] = [];
  const ribs: number[] = [];
  const lamps: number[] = [];
  const empty: number[] = [];
  for (let floor = topFloor ?? 1; floor <= last; floor++) {
    const y0 = floorSpan(floor)[0];
    const yf = y0 + LEDGE_THICKNESS;
    for (const e of galleryEdges(hole, floor)) {
      const a0 = e.a0 * TAU;
      const a1 = e.a1 * TAU;
      if (!layout.corridors?.[e.id]) {
        flatRing(empty, rOpen, R, a0, a1, yf);
        continue;
      }
      const building = layout.corridorsBuilding?.[e.id] !== undefined;
      const linked = !!layout.corridorLinked?.[e.id] || floor > hole.floors;
      const floorPos = building ? ghostSlab : linked ? slab : unlinked;
      flatRing(floorPos, rOpen, R, a0, a1, yf);
      curvedFace(floorPos, rOpen, a0, a1, y0, yf);
      if (building) continue;
      const top = yf + TUBE.height;
      curvedFace(glass, rOpen, a0, a1, yf, top);
      if (topFloor === null) flatRing(glass, rOpen, R, a0, a1, top);
      // Ribs: a post on the glass and a beam across the roof, every so often along the arc.
      const len = (a1 - a0) * rOpen;
      const count = Math.max(1, Math.round(len / TUBE.ribEveryM));
      const w = TUBE.ribM / rOpen;
      for (let i = 0; i <= count; i++) {
        const a = a0 + ((a1 - a0) * i) / count;
        curvedFace(ribs, rOpen + 0.02, a - w / 2, a + w / 2, yf, top);
        if (topFloor === null) flatRing(ribs, rOpen, R, a - w / 2, a + w / 2, top - 0.02);
      }
      // The railing, and a lamp strip down the middle of the roof.
      curvedFace(ribs, rOpen + 0.05, a0, a1, yf + RAIL_HEIGHT - 0.03, yf + RAIL_HEIGHT + 0.03);
      if (topFloor === null) flatRing(lamps, (rOpen + R) / 2 - 0.08, (rOpen + R) / 2 + 0.08, a0, a1, top - 0.05);
    }
  }
  const out: THREE.Object3D[] = [];
  const add = (pos: number[], key: string, make: () => THREE.Material, data: Record<string, unknown> = {}) => {
    if (!pos.length) return;
    const mesh = new THREE.Mesh(geometry(pos), material(key, make));
    mesh.userData = data;
    out.push(mesh);
  };
  add(slab, "tube:slab", () => new THREE.MeshStandardMaterial({ color: TUBE.slab, roughness: 0.8, side: THREE.DoubleSide }), { pickable: true, hall: true });
  add(unlinked, "tube:unlinked", () => new THREE.MeshStandardMaterial({ color: UNLINKED, roughness: 0.8, side: THREE.DoubleSide }), { pickable: true, hall: true });
  add(ghostSlab, "tube:building", () => new THREE.MeshStandardMaterial({ color: TUBE.slab, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }), { pickable: true, hall: true });
  add(empty, "tube:none", () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.03, depthWrite: false, side: THREE.DoubleSide }), { pickable: true, hall: true });
  add(glass, "tube:glass", () => withFresnel(new THREE.MeshStandardMaterial({ color: TUBE.glass, roughness: 0.05, metalness: 0.2, transparent: true, opacity: TUBE.glassOpacity, depthWrite: false, side: THREE.DoubleSide })));
  add(ribs, "tube:rib", () => new THREE.MeshStandardMaterial({ color: TUBE.rib, roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide }));
  add(lamps, "tube:lamp", () => new THREE.MeshStandardMaterial({ color: TUBE.lamp, emissive: TUBE.lamp, emissiveIntensity: 0.3, side: THREE.DoubleSide }));
  return out;
}

const CAP = { rock: 0x4a2a1e, locked: 0x33201a, beyond: 0x241410, lift: 0.02, beyondM: 3000, beyondSteps: 24 };

/**
 * A rock lid over the chosen floor's empty cells, just under its ceiling:
 * carved cells in rock, locked rings darker, and solid rock past the last
 * ring. Carved and locked cells are pickable, so they can be built on from above.
 */
function floorCap(layout: Layout, floor: number, xray = false): THREE.Object3D[] {
  const hole = layout.hole;
  const [y0, y1] = floorSpan(floor);
  const y = y1 - CAP.lift;
  const joints = new Set(corridorJoints(layout).keys());
  const open: number[] = [];
  const locked: number[] = [];
  // Rock where a corridor has been carved into it: walls from the cap down to the corridor floor.
  const cutWalls: number[] = [];
  hole.ringSlots.forEach((n, ri) => {
    const ring = ri + 1;
    for (let slot = 0; slot < n; slot++) {
      const id = layout.grid[floor - 1]?.[ri]?.[slot];
      // Rooms, and dug-out empty space (its own floor and pillars), have no lid.
      if (id || isOpen(layout, { floor, ring, slot })) continue;
      // The cap has no lid over corridors: it's carved like a room, by half a corridor on each side one runs.
      const c = { floor, ring, slot };
      const cut = carveCell(layout, c, new Set([`${floor}:${ring}:${slot}`]), ring, ring, 0, true, false, joints);
      for (const p of cut.pieces) {
        const inside = pieceAt(cut, p, p.rr0);
        const outside = pieceAt(cut, p, p.rr1);
        flatPiece(ring > hole.unlockedRings ? locked : open, p.rr0, p.rr1, inside, outside, y);
        // Outside x-ray the rock's own faces (rockFaces) wall the corridors in.
        if (xray && p.innerHall) curvedFace(cutWalls, p.rr0, ...inside, y0, y);
        if (xray && p.outerHall) curvedFace(cutWalls, p.rr1, ...outside, y0, y);
      }
      const first = cut.pieces[0];
      const last = cut.pieces.at(-1);
      if (xray && cut.hallLeft && first) sideWall(cutWalls, first.rr0, cut.left(first.rr0), first.rr1, cut.left(first.rr1), y0, y);
      if (xray && cut.hallRight && last) sideWall(cutWalls, last.rr0, cut.right(last.rr0), last.rr1, cut.right(last.rr1), y0, y);
    }
  });
  const outer = ringRadii(hole, hole.ringSlots.length)[1];
  // The rock beyond the rings, out to near the horizon, round in many steps (four made it a square).
  const beyond: number[] = [];
  for (let i = 0; i < CAP.beyondSteps; i++) flatRing(beyond, outer, outer + CAP.beyondM, (i / CAP.beyondSteps) * TAU, ((i + 1) / CAP.beyondSteps) * TAU, y);
  const mat = (c: number) => material(`cap:${c}`, () => withRock(new THREE.MeshStandardMaterial({ color: c, roughness: 1, side: THREE.DoubleSide })));
  const openMesh = new THREE.Mesh(geometry(open), mat(CAP.rock));
  openMesh.userData = { pickable: true, cap: true };
  const lockedMesh = new THREE.Mesh(geometry(locked), mat(CAP.locked));
  lockedMesh.userData = { pickable: true, cap: true };
  const beyondMesh = new THREE.Mesh(geometry(beyond), mat(CAP.beyond));
  const wallsMesh = new THREE.Mesh(geometry(cutWalls), mat(CAP.locked));
  // Hairline slot edges on the carved cells, so the grid reads from above.
  const grid: number[] = [];
  hole.ringSlots.slice(0, hole.unlockedRings).forEach((n, ri) => {
    const [r0, r1] = ringRadii(hole, ri + 1);
    for (let slot = 0; slot < n; slot++) {
      const [a] = slotAngles(slot, n);
      grid.push(...at(r0, a, y + 0.01), ...at(r1, a, y + 0.01));
    }
  });
  const gridGeo = new THREE.BufferGeometry();
  gridGeo.setAttribute("position", new THREE.Float32BufferAttribute(grid, 3));
  const gridLines = new THREE.LineSegments(gridGeo, material("capGrid", () => new THREE.LineBasicMaterial({ color: 0x1a0f0d, transparent: true, opacity: 0.6 })));
  return [openMesh, lockedMesh, beyondMesh, wallsMesh, gridLines];
}

/** Free what a layout group owns outright. Cached shapes, labels and materials live on for reuse. */
export function disposeLayout(group: THREE.Object3D): void {
  group.traverse((o) => {
    if (o.userData.cached) return;
    if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) o.geometry.dispose();
  });
}
