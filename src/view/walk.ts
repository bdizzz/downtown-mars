import { corridors } from "../sim/corridors";
import { cellEdges, isGalleryEdge, type Edge } from "../sim/edges";
import { isOpen } from "../sim/excavation";
import type { Hole } from "../sim/geometry";
import { roomAt, type Layout, type RoomInstance } from "../sim/placement";
import { roomDef } from "../sim/rooms";
import { FLOOR_H, openShaftRadius, RING_D, TAU } from "../render3d/cylinder";
import { doorways } from "./doors";
import { furnish, isFlat } from "./furnish";
import { isMounted, itemDef } from "./furniture";

// Walking a floor in first person: where a colonist can stand. Open ground is
// the gallery ringing the shaft (not over the railing), public rooms (plazas,
// stairs, the entrance, a cargo elevator's stop), dug-out empty space, and the
// corridors carved along the borders between cells. A private room's floor is
// its own region, walled off from everything around it except through its
// door. Solid rock is solid, and so is furniture. Positions are metres around
// the shaft's axis (x, z), as in the 3D view.

/** A walker's radius: how close to a wall or the railing it can get. */
export const WALKER_RADIUS = 0.3;
/** How close to furniture: less than to a wall, so a walker fits down the aisles a room is furnished with. */
export const FURNITURE_CLEARANCE = 0.2;
/** How far either side of its wall a doorway reaches: stand in it and you're both in the room and outside. */
const DOOR_DEPTH = 0.6;
const HALL = corridors.widthM / 2;

/** Where a point is: open ground, inside a private room ("room:" and its id), or in a room's doorway ("door:" and its id). */
export const OPEN = "open";
export type Region = string;

/** Is this point clear to stand on, on this floor (ignoring furniture)? */
export function walkable(layout: Layout, floor: number, x: number, z: number): boolean {
  return regionAt(layout, floor, x, z) !== null;
}

/** Which region a point is in, or null for rock, the open shaft, and rooms you can't walk in. */
export function regionAt(layout: Layout, floor: number, x: number, z: number): Region | null {
  const hole = layout.hole;
  if (floor < 1 || floor > hole.floors) return null;
  const r = Math.hypot(x, z);
  if (r < openShaftRadius(hole)) return null; // over the railing, into the shaft
  const a = Math.atan2(z, x);
  const door = doorAt(layout, floor, r, a);
  if (door) return door;
  if (r < hole.shaftRadiusM) return OPEN; // the gallery
  const ring = Math.floor((r - hole.shaftRadiusM) / RING_D) + 1;
  if (ring > hole.unlockedRings) return null;
  const turn = (((a / TAU) % 1) + 1) % 1;
  const n = hole.ringSlots[ring - 1]!;
  const cell = { floor, ring, slot: Math.min(Math.floor(turn * n), n - 1) };
  // A corridor carved into this cell's sides is open ground, even along a private room.
  if (cellEdges(hole, cell).some((e) => onCorridor(layout, e, r, turn * TAU))) return OPEN;
  const room = roomAt(layout, cell);
  if (!room) return isOpen(layout, cell) ? OPEN : null;
  if (!built(room)) return null;
  if (!roomDef(room.type).public) return `room:${room.id}`;
  return walkThrough(room, floor) ? OPEN : null;
}

/** Can a walker in one region step straight into the other? Only within a region, or through a doorway. */
export function joined(a: Region, b: Region): boolean {
  if (a === b) return true;
  const door = (d: Region, o: Region) => d.startsWith("door:") && (o === OPEN || o === `room:${d.slice(5)}`);
  return door(a, b) || door(b, a);
}

const built = (room: RoomInstance) => !room.planned && !room.building;

/** The doorway a point stands in, if any: within its width (less a walker's radius, so all of one fits through) and close to its wall. */
function doorAt(layout: Layout, floor: number, r: number, a: number): Region | null {
  const hole = layout.hole;
  if (Math.abs(r - hole.shaftRadiusM) > DOOR_DEPTH) return null;
  const n = hole.ringSlots[0]!;
  const turn = (((a / TAU) % 1) + 1) % 1;
  const room = roomAt(layout, { floor, ring: 1, slot: Math.min(Math.floor(turn * n), n - 1) });
  if (!room || !built(room)) return null;
  for (const d of doorways(layout, room)) {
    if (d.floor !== floor) continue;
    if (Math.abs(angleDiff(a, d.angle)) * d.r <= d.half * d.r - WALKER_RADIUS) return `door:${room.id}`;
  }
  return null;
}

/** Can a colonist walk through this room on this floor? Public ones, once built (a cargo elevator only at its stop). */
function walkThrough(room: RoomInstance, floor: number): boolean {
  const def = roomDef(room.type);
  if (def.excavationOnly) return false;
  if (def.cargoShaft) return floor === Math.max(...room.cells.map((c) => c.floor));
  return true;
}

/** Is this point in a built corridor (along any side of the cell it's in)? */
export function onCorridorAt(layout: Layout, floor: number, x: number, z: number): boolean {
  const hole = layout.hole;
  const r = Math.hypot(x, z);
  if (r < hole.shaftRadiusM || floor < 1 || floor > hole.floors) return false;
  const ring = Math.floor((r - hole.shaftRadiusM) / RING_D) + 1;
  if (ring > hole.unlockedRings) return false;
  const turn = (((Math.atan2(z, x) / TAU) % 1) + 1) % 1;
  const n = hole.ringSlots[ring - 1]!;
  const cell = { floor, ring, slot: Math.min(Math.floor(turn * n), n - 1) };
  return cellEdges(hole, cell).some((e) => onCorridor(layout, e, r, turn * TAU));
}

/** Is a point (radius r, angle a) inside the band a built corridor on this edge carves? */
function onCorridor(layout: Layout, e: Edge, r: number, a: number): boolean {
  if (!layout.corridors[e.id] || layout.corridorsBuilding?.[e.id] !== undefined) return false;
  // A gallery tube runs on the shaft side of the wall, over the gallery ledge: it carves nothing from ring 1.
  if (isGalleryEdge(e)) return false;
  const hole = layout.hole;
  if (e.kind === "radial") {
    const [r0, r1] = [hole.shaftRadiusM + (e.ring - 1) * RING_D, hole.shaftRadiusM + e.ring * RING_D];
    const d = angleDiff(a, e.turn * TAU);
    const along = r * Math.cos(d);
    return Math.abs(r * Math.sin(d)) <= HALL && along >= r0 - HALL && along <= r1 + HALL;
  }
  const rc = circleRadius(hole, e.circle);
  if (Math.abs(r - rc) > HALL) return false;
  const pad = HALL / rc;
  const a0 = e.a0 * TAU - pad;
  const a1 = e.a1 * TAU + pad;
  const t = a0 + ((((a - a0) % TAU) + TAU) % TAU);
  return t <= a1;
}

const circleRadius = (hole: Hole, circle: number) => hole.shaftRadiusM + circle * RING_D;
const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/**
 * Is there room for a walker here: its centre and the edge of its footprint
 * all on walkable ground in one region (or a doorway joining two), and clear
 * of furniture?
 */
export function clear(layout: Layout, floor: number, x: number, z: number): boolean {
  const here = regionAt(layout, floor, x, z);
  if (here === null) return false;
  const k = WALKER_RADIUS;
  for (const [dx, dz] of [[k, 0], [-k, 0], [0, k], [0, -k]] as const) {
    const there = regionAt(layout, floor, x + dx, z + dz);
    if (there === null || !joined(here, there)) return false;
  }
  return !againstFurniture(layout, floor, x, z);
}

/** A standing item's footprint on the floor, with its bounding box for a quick first test. */
interface Obstacle {
  corners: [number, number][];
  box: [number, number, number, number];
}

// Each layout's furniture by floor, worked out once. The main thread gets a fresh layout with every state snapshot.
const obstacleCache = new WeakMap<Layout, Map<number, Obstacle[]>>();

/** The furniture standing on a floor (rugs lie flat, so they're walked over). */
export function obstacles(layout: Layout, floor: number): Obstacle[] {
  let byFloor = obstacleCache.get(layout);
  if (!byFloor) obstacleCache.set(layout, (byFloor = new Map()));
  let list = byFloor.get(floor);
  if (!list) {
    list = layout.rooms
      .filter((room) => room.cells.some((c) => c.floor === floor))
      .flatMap((room) => furnish(layout, room))
      // Rugs are walked over, and wall hangings are over your head.
      .filter((f) => f.floor === floor && !isFlat(f.item) && !isMounted(f.item) && !itemDef(f.item).climb && !itemDef(f.item).opening)
      .map((f) => {
        const xs = f.corners.map((c) => c[0]);
        const zs = f.corners.map((c) => c[1]);
        return { corners: f.corners, box: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)] };
      });
    byFloor.set(floor, list);
  }
  return list;
}

/** Does a walker at (x, z) come within `FURNITURE_CLEARANCE` of any furniture? */
function againstFurniture(layout: Layout, floor: number, x: number, z: number): boolean {
  const k = FURNITURE_CLEARANCE;
  return obstacles(layout, floor).some(({ corners, box }) => {
    if (x < box[0] - k || x > box[2] + k || z < box[1] - k || z > box[3] + k) return false;
    return insideQuad(corners, x, z) || corners.some((c, i) => segmentDistance(x, z, c, corners[(i + 1) % corners.length]!) < k);
  });
}

/** Is (x, z) inside a convex footprint (corners in either winding)? */
function insideQuad(q: [number, number][], x: number, z: number): boolean {
  let sign = 0;
  for (let i = 0; i < q.length; i++) {
    const [x0, z0] = q[i]!;
    const [x1, z1] = q[(i + 1) % q.length]!;
    const cross = (x1 - x0) * (z - z0) - (z1 - z0) * (x - x0);
    if (cross === 0) continue;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return true;
}

/** How far (x, z) is from the segment a–b. */
function segmentDistance(x: number, z: number, [ax, az]: [number, number], [bx, bz]: [number, number]): number {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - ax - t * dx, z - az - t * dz);
}

/** Sliding: how far round (degrees) a blocked step is turned, a notch at a time, looking for a way along. */
const SLIDE = { notch: 10, most: 85 };

/**
 * Step from (x, z) on a floor by (dx, dz), sliding along whatever's in the
 * way: the whole step if it's clear; otherwise the same step turned a little
 * at a time, and shortened to what it moves along the obstacle, whichever way
 * turns least; otherwise part of the step; otherwise nowhere. So walking into
 * a wall (straight, curved or corner-on) or furniture keeps you moving along
 * it, never through it. Stairs take you up or down a floor: the new floor
 * comes back with the new place.
 */
export function step(layout: Layout, floor: number, x: number, z: number, dx: number, dz: number): [number, number, number] {
  // Never from one region straight into another, however long the step: only through a doorway.
  const from = regionAt(layout, floor, x, z);
  /** The floor a walker would be on at (nx, nz), or null if it can't go there. */
  const to = (nx: number, nz: number): number | null => {
    const stairs = onStairs(layout, floor, x, z, nx, nz);
    if (stairs !== undefined) return stairs;
    if (!clear(layout, floor, nx, nz)) return null;
    const there = regionAt(layout, floor, nx, nz);
    return from === null || (there !== null && joined(from, there)) ? floor : null;
  };
  if (!dx && !dz) return [x, z, floor];
  const tryStep = (sx: number, sz: number): [number, number, number] | null => {
    const f = to(x + sx, z + sz);
    return f === null ? null : [x + sx, z + sz, f];
  };
  const whole = tryStep(dx, dz);
  if (whole) return whole;
  for (let deg = SLIDE.notch; deg <= SLIDE.most; deg += SLIDE.notch) {
    const a = (deg * Math.PI) / 180;
    const k = Math.cos(a);
    for (const sign of [1, -1]) {
      const c = Math.cos(sign * a);
      const s = Math.sin(sign * a);
      const turned = tryStep((dx * c - dz * s) * k, (dx * s + dz * c) * k);
      if (turned) return turned;
    }
  }
  // Up against it: close the gap.
  for (const part of [0.5, 0.25]) {
    const some = tryStep(dx * part, dz * part);
    if (some) return some;
  }
  return [x, z, floor];
}

// ---- stairs ----

/** A flight of stairs on a floor: its foot's middle, the way up, across it, its length and half its width. */
export interface Flight {
  foot: [number, number];
  up: [number, number];
  across: [number, number];
  length: number;
  half: number;
}

/** How far onto a flight you can step at its foot (or head), as a share of its length. */
const STAIR_ENTRY = 0.15;

const flightCache = new WeakMap<Layout, Map<number, Flight[]>>();

/** The flights on a floor (each climbs to the floor above), from the stairwells' furniture. */
export function flights(layout: Layout, floor: number): Flight[] {
  let byFloor = flightCache.get(layout);
  if (!byFloor) flightCache.set(layout, (byFloor = new Map()));
  let list = byFloor.get(floor);
  if (!list) {
    list = layout.rooms
      .filter((room) => roomDef(room.type).stacks && room.cells.some((c) => c.floor === floor))
      .flatMap((room) => furnish(layout, room))
      .filter((f) => f.floor === floor && itemDef(f.item).climb)
      .map((f) => {
        // The item's front (+z) is the foot; it climbs toward its back.
        const [, length] = itemDef(f.item).size;
        const up: [number, number] = [-Math.sin(f.turn), -Math.cos(f.turn)];
        return {
          foot: [f.x - (up[0] * length) / 2, f.z - (up[1] * length) / 2] as [number, number],
          up,
          across: [Math.cos(f.turn), -Math.sin(f.turn)] as [number, number],
          length,
          half: itemDef(f.item).size[0] / 2,
        };
      });
    byFloor.set(floor, list);
  }
  return list;
}

/** Where a point is on a flight: how far up (0 at the foot, 1 at the head) and how far off its middle. */
function along(fl: Flight, x: number, z: number): { s: number; off: number } {
  const [px, pz] = [x - fl.foot[0], z - fl.foot[1]];
  const s = (px * fl.up[0] + pz * fl.up[1]) / fl.length;
  const off = px * fl.across[0] + pz * fl.across[1];
  return { s, off };
}

/** Is a walker at this point touching the flight (its body over it)? */
const over = (fl: Flight, a: { s: number; off: number }) => a.s >= 0 && a.s <= 1 && Math.abs(a.off) < fl.half + WALKER_RADIUS;
/** Is a walker at this point fully between the flight's rails? */
const between = (fl: Flight, a: { s: number; off: number }) => Math.abs(a.off) <= fl.half - WALKER_RADIUS;

/**
 * A step that has to do with stairs: the floor it lands on, or null if the
 * stairs' rails stop it; undefined if there are no stairs about.
 * On a flight you climb between its rails, stepping off its head onto the
 * floor above or its foot back onto this one. You get onto one only at its
 * foot; and into a flight's well on the floor above only at its head, which
 * takes you down onto it.
 */
function onStairs(layout: Layout, floor: number, x: number, z: number, nx: number, nz: number): number | null | undefined {
  for (const fl of flights(layout, floor)) {
    const now = along(fl, x, z);
    if (!(now.s >= 0 && now.s <= 1 && between(fl, now))) continue;
    // Climbing this one.
    const next = along(fl, nx, nz);
    if (!between(fl, next) && next.s >= 0 && next.s <= 1) return null;
    if (next.s > 1) return clear(layout, floor - 1, nx, nz) ? floor - 1 : null;
    if (next.s >= 0) return floor;
    return undefined; // off the foot, onto this floor as usual
  }
  for (const fl of flights(layout, floor)) {
    const next = along(fl, nx, nz);
    if (over(fl, next)) return next.s <= STAIR_ENTRY && between(fl, next) ? floor : null;
  }
  if (floor < layout.hole.floors) {
    for (const fl of flights(layout, floor + 1)) {
      const next = along(fl, nx, nz);
      if (over(fl, next)) return next.s >= 1 - STAIR_ENTRY && between(fl, next) ? floor + 1 : null;
    }
  }
  return undefined;
}

/** How high a walker stands above its floor: up a flight, by how far up it is; otherwise not at all. */
export function stairLift(layout: Layout, floor: number, x: number, z: number): number {
  for (const fl of flights(layout, floor)) {
    const a = along(fl, x, z);
    if (a.s >= 0 && a.s <= 1 && Math.abs(a.off) <= fl.half) return a.s * FLOOR_H;
  }
  return 0;
}

/** Stairs or an elevator under a walker: where it can take them (the floors above and below it reaches), or null. */
export function stairsHere(layout: Layout, floor: number, x: number, z: number): { up: number | null; down: number | null } | null {
  const hole = layout.hole;
  const r = Math.hypot(x, z);
  if (r < hole.shaftRadiusM) return null;
  const ring = Math.floor((r - hole.shaftRadiusM) / RING_D) + 1;
  if (ring > hole.unlockedRings) return null;
  const turn = (((Math.atan2(z, x) / TAU) % 1) + 1) % 1;
  const n = hole.ringSlots[ring - 1]!;
  const room = roomAt(layout, { floor, ring, slot: Math.min(Math.floor(turn * n), n - 1) });
  if (!room || !roomDef(room.type).stacks || room.building || room.planned) return null;
  const floors = new Set(room.cells.map((c) => c.floor));
  const up = floors.has(floor - 1) ? floor - 1 : null;
  const down = floors.has(floor + 1) && floor + 1 <= hole.floors ? floor + 1 : null;
  return up === null && down === null ? null : { up, down };
}
