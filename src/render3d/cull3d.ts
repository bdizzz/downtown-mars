import * as THREE from "three";
import type { Cell, Layout } from "../sim/placement";
import { roomDef } from "../sim/rooms";
import { edgeById, isGalleryEdge } from "../sim/edges";
import { corridors } from "../sim/corridors";
import { floorSpan, RING_D, ringRadii, slotAngles } from "./cylinder";
import { corridorStripGeometry } from "./rooms3d";

// Skipping what the camera can't see (#262). Three.js already skips what's
// outside the view, but most of what it draws that can't be seen is in view,
// just behind a floor: from above floor 2, every room, piece of furniture and
// the drill rig on the floors below. The floor between two floors hides
// everything past it, except through its openings: the shaft (and its gallery
// tubes), a room on both floors (stairs, tall rooms, lifts), and anything
// see-through on either floor (a plan, a room or corridor being built). So a
// thing wholly past that floor, from the camera, is drawn only if a line from
// the camera to it could pass through one of those openings, or round the
// hole's outer edge (where nothing is drawn to stop it). Seen from below there
// are more: a corridor has no ceiling, and one cut through rock is open all the
// way up (nothing's drawn inside rock, and the land isn't drawn from beneath),
// so every corridor under the floor is a hole in it. Never cull something that
// should show: every test errs toward drawing.

/** How much each opening (and the shaft) is widened, and the rim drawn in, metres: room for wobble (swaying plants, lowered walls). */
const MARGIN = 0.75;
/** Corridors' openings are cut into pieces about this long (metres), so a long one isn't one big circle. */
const PIECE = 6;
/** How far past a floor's plane something may poke and still count as behind it (wall tops meet the floor above). */
const TOUCH = 0.05;

/** An opening in a floor, as a circle in plan (x, z). */
export interface Opening {
  x: number;
  z: number;
  r: number;
}

/** The floor between two floors (or the crust over floor 1): its plane, and where you can see through it. */
export interface Slab {
  y: number;
  /** Radius of the shaft, open through every floor. */
  shaft: number;
  /** Radius of the hole's outer edge: past it, nothing stops the eye. */
  rim: number;
  openings: Opening[];
  /** More openings, only from below: the corridors under it. */
  fromBelow: Opening[];
}

/** The circle round some cells, in plan. */
function circleOf(layout: Layout, cells: Cell[]): Opening | null {
  const pts: [number, number][] = [];
  for (const c of cells) {
    const n = layout.hole.ringSlots[c.ring - 1];
    if (!n) continue;
    const [r0, r1] = ringRadii(layout.hole, c.ring);
    const [a0, a1] = slotAngles(c.slot, n);
    for (const a of [a0, (a0 + a1) / 2, a1]) for (const r of [r0, r1]) pts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return circleRound(pts);
}

function circleRound(pts: [number, number][]): Opening | null {
  if (!pts.length) return null;
  let x = 0;
  let z = 0;
  for (const [px, pz] of pts) {
    x += px;
    z += pz;
  }
  x /= pts.length;
  z /= pts.length;
  let r = 0;
  for (const [px, pz] of pts) r = Math.max(r, Math.hypot(px - x, pz - z));
  return { x, z, r: r + MARGIN };
}

/**
 * The floor under `floor` (between it and the next one down). Floor 0 is the
 * crust over floor 1, whose openings are the shaft and whatever reaches the
 * surface (airlocks, cargo lifts).
 */
export function slabBelow(layout: Layout, floor: number): Slab {
  const hole = layout.hole;
  const y = floor === 0 ? floorSpan(1)[1] : floorSpan(floor)[0];
  const openings: Opening[] = [];
  const add = (o: Opening | null) => o && openings.push(o);
  for (const room of layout.rooms) {
    if (room.at.kind === "surface") continue;
    const floors = room.cells.map((c) => c.floor);
    const top = Math.min(...floors);
    const bottom = Math.max(...floors);
    const def = roomDef(room.type);
    // Through both floors; on either side and see-through; or (the crust) reaching up to the surface.
    const through = top <= floor && bottom > floor;
    const seeThrough = (room.planned || !!room.building) && floors.some((f) => f === floor || f === floor + 1);
    const surface = floor === 0 && top === 1 && (!!def.cargoShaft || !!def.surfaceLink);
    if (through || seeThrough || surface) add(circleOf(layout, room.cells));
  }
  const fromBelow: Opening[] = [];
  for (const id of Object.keys(layout.corridors ?? {})) {
    const e = edgeById(hole, id);
    if (!e || isGalleryEdge(e)) continue;
    // Being built, it's see-through from either side; under the floor, it's open to it from below.
    const building = layout.corridorsBuilding?.[id] !== undefined && (e.floor === floor || e.floor === floor + 1);
    if (!building && e.floor !== floor + 1) continue;
    const geo = corridorStripGeometry(layout, e, 0);
    const pieces = stripPieces(geo);
    geo.dispose();
    (building ? openings : fromBelow).push(...pieces);
  }
  return { y, shaft: hole.shaftRadiusM + MARGIN, rim: hole.shaftRadiusM + hole.unlockedRings * RING_D - MARGIN, openings, fromBelow };
}

/**
 * A corridor's floor strip as circles in plan, a few whole triangles to each (so each circle
 * holds all of every triangle in it), each grown by the corridor's width to take in the
 * square joints where corridors turn.
 */
function stripPieces(geo: THREE.BufferGeometry): Opening[] {
  const pos = geo.getAttribute("position");
  const index = geo.getIndex();
  const count = index ? index.count : pos.count;
  const out: Opening[] = [];
  let pts: [number, number][] = [];
  const flush = () => {
    const c = circleRound(pts);
    if (c) out.push({ ...c, r: c.r + corridors.widthM });
    pts = [];
  };
  for (let i = 0; i + 2 < count; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = index ? index.getX(i + k) : i + k;
      pts.push([pos.getX(v), pos.getZ(v)]);
    }
    const c = circleRound(pts);
    if (c && c.r > PIECE / 2) flush();
  }
  if (pts.length) flush();
  return out;
}

const corner = new THREE.Vector3();

/**
 * Is a box (world space) hidden behind a slab from a camera at `eye`? Only if
 * it's wholly on the far side and no line from the eye to it gets through an
 * opening or past the rim. The box's corners are projected from the eye onto
 * the slab's plane; their plan bounds hold every such line's crossing.
 */
export function behindSlab(slab: Slab, eye: THREE.Vector3, box: THREE.Box3): boolean {
  if (box.isEmpty()) return false;
  const up = eye.y > slab.y; // looking down through it, or (from below) up
  const h = Math.abs(eye.y - slab.y);
  if (h < TOUCH) return false;
  if (up ? box.max.y > slab.y + TOUCH : box.min.y < slab.y - TOUCH) return false;
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
    const depth = Math.max(0, up ? slab.y - corner.y : corner.y - slab.y);
    const t = h / (h + depth);
    const x = eye.x + (corner.x - eye.x) * t;
    const z = eye.z + (corner.z - eye.z) * t;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    z0 = Math.min(z0, z);
    z1 = Math.max(z1, z);
  }
  // Past the rim: the rectangle's farthest point from the axis.
  if (Math.hypot(Math.max(-x0, x1), Math.max(-z0, z1)) >= slab.rim) return false;
  // Through the shaft, or an opening: the rectangle's nearest point to its centre.
  const near = (cx: number, cz: number) => Math.hypot(Math.max(x0 - cx, 0, cx - x1), Math.max(z0 - cz, 0, cz - z1));
  if (near(0, 0) <= slab.shaft) return false;
  for (const o of slab.openings) if (near(o.x, o.z) <= o.r) return false;
  if (!up) for (const o of slab.fromBelow) if (near(o.x, o.z) <= o.r) return false;
  return true;
}

/** Is a box wholly cut away by the cutaway's planes (a fragment goes only when it's past every one: see wedgeClip.ts)? */
export function clippedAway(planes: THREE.Plane[], box: THREE.Box3): boolean {
  if (!planes.length || box.isEmpty()) return false;
  for (const p of planes) {
    // The corner furthest along the plane's normal: if even it's on the cut side, all of the box is.
    corner.set(p.normal.x > 0 ? box.max.x : box.min.x, p.normal.y > 0 ? box.max.y : box.min.y, p.normal.z > 0 ? box.max.z : box.min.z);
    if (p.distanceToPoint(corner) >= 0) return false;
  }
  return true;
}
