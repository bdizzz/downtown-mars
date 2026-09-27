import * as THREE from "three";
import type { Hole } from "../sim/geometry";
import type { Pick } from "../view/types";
import { floorSpan, pickAt, RING_D, TAU } from "./cylinder";

// Pure picking math for the 3D view: where a ray meets the shapes the hole
// is made of. Kept apart from rendering so it can be tested without WebGL.

/** How far past a surface we step before asking what's there, so we land inside the cell. */
export const NUDGE = 0.1;

/** Distance along the ray to the first hit on the vertical cylinder x² + z² = r², or null. */
export function rayCylinder(ray: THREE.Ray, r: number): number | null {
  const { origin: o, direction: d } = ray;
  const a = d.x * d.x + d.z * d.z;
  if (a < 1e-12) return null; // straight up or down: parallel to the wall
  const b = 2 * (o.x * d.x + o.z * d.z);
  const c = o.x * o.x + o.z * o.z - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  const t0 = (-b - sq) / (2 * a);
  const t1 = (-b + sq) / (2 * a);
  if (t0 > 1e-6) return t0;
  if (t1 > 1e-6) return t1;
  return null;
}

/** Distance along the ray to a plane, or null if it's behind or parallel. */
export function rayPlane(ray: THREE.Ray, plane: THREE.Plane): number | null {
  const t = ray.distanceToPlane(plane);
  return t === null || t < 1e-6 ? null : t;
}

/** A pick for a point just past where the ray meets something at distance t. */
export function pickPast(hole: Hole, ray: THREE.Ray, t: number): Pick {
  const p = ray.at(t + NUDGE, new THREE.Vector3());
  return pickAt(hole, p.x, p.y, p.z);
}

/** A surface pick at the point's angle around the shaft. */
export function surfacePickAt(point: THREE.Vector3): Pick {
  const turn = (((Math.atan2(point.z, point.x) / TAU) % 1) + 1) % 1;
  return { kind: "surface", angle: turn * 360 };
}

/** Is a point inside the carved part of the hole: dug floors (and the one being dug), unlocked rings? */
export function inCarvedRegion(hole: Hole, p: THREE.Vector3): boolean {
  const r = Math.hypot(p.x, p.z);
  const bottom = floorSpan(hole.floors + 1)[0];
  return p.y < 0 && p.y > bottom && r >= hole.shaftRadiusM && r <= hole.shaftRadiusM + hole.unlockedRings * RING_D;
}
