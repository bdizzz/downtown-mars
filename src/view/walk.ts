import { corridors } from "../sim/corridors";
import { cellEdges, type Edge } from "../sim/edges";
import { isOpen } from "../sim/excavation";
import type { Hole } from "../sim/geometry";
import { roomAt, type Layout, type RoomInstance } from "../sim/placement";
import { roomDef } from "../sim/rooms";
import { openShaftRadius, RING_D, TAU } from "../render3d/cylinder";

// Walking a floor in first person: where a colonist can stand. The gallery
// ringing the shaft (not over the railing), public rooms (plazas, stairs,
// the entrance, a cargo elevator's stop), dug-out empty space, and the
// corridors carved along the borders between cells. Private rooms are behind
// walls, and solid rock is solid. Positions are metres around the shaft's
// axis (x, z), as in the 3D view.

/** A walker's radius: how close to a wall or the railing it can get. */
export const WALKER_RADIUS = 0.3;
const HALL = corridors.widthM / 2;

/** Is this point clear to stand on, on this floor? */
export function walkable(layout: Layout, floor: number, x: number, z: number): boolean {
  const hole = layout.hole;
  if (floor < 1 || floor > hole.floors) return false;
  const r = Math.hypot(x, z);
  if (r < openShaftRadius(hole)) return false; // over the railing, into the shaft
  if (r < hole.shaftRadiusM) return true; // the gallery
  const ring = Math.floor((r - hole.shaftRadiusM) / RING_D) + 1;
  if (ring > hole.unlockedRings) return false;
  const turn = (((Math.atan2(z, x) / TAU) % 1) + 1) % 1;
  const n = hole.ringSlots[ring - 1]!;
  const cell = { floor, ring, slot: Math.min(Math.floor(turn * n), n - 1) };
  const room = roomAt(layout, cell);
  if (room ? walkThrough(room, floor) : isOpen(layout, cell)) return true;
  // Otherwise only along a corridor carved into this cell's sides.
  return cellEdges(hole, cell).some((e) => onCorridor(layout, e, r, turn * TAU));
}

/** Can a colonist walk through this room on this floor? Public ones, once built (a cargo elevator only at its stop). */
function walkThrough(room: RoomInstance, floor: number): boolean {
  const def = roomDef(room.type);
  if (!def.public || room.planned || room.building || def.excavationOnly) return false;
  if (def.cargoShaft) return floor === Math.max(...room.cells.map((c) => c.floor));
  return true;
}

/** Is a point (radius r, angle a) inside the band a built corridor on this edge carves? */
function onCorridor(layout: Layout, e: Edge, r: number, a: number): boolean {
  if (!layout.corridors[e.id] || layout.corridorsBuilding?.[e.id] !== undefined) return false;
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

/** Is there room for a walker here: its centre and the edge of its footprint all on walkable ground? */
export function clear(layout: Layout, floor: number, x: number, z: number): boolean {
  const k = WALKER_RADIUS;
  return [[0, 0], [k, 0], [-k, 0], [0, k], [0, -k]].every(([dx, dz]) => walkable(layout, floor, x + dx!, z + dz!));
}

/**
 * Step from (x, z) by (dx, dz), sliding along whatever's in the way: the
 * whole step if it's clear, otherwise the part along x or along z that is,
 * otherwise nowhere.
 */
export function step(layout: Layout, floor: number, x: number, z: number, dx: number, dz: number): [number, number] {
  if (clear(layout, floor, x + dx, z + dz)) return [x + dx, z + dz];
  if (dx && clear(layout, floor, x + dx, z)) return [x + dx, z];
  if (dz && clear(layout, floor, x, z + dz)) return [x, z + dz];
  return [x, z];
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
