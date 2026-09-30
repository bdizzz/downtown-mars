import { config } from "../sim/config";
import type { Hole } from "../sim/geometry";
import type { Pick } from "../view/types";

// Where (floor, ring, slot) sits in 3D, in metres. The shaft's axis is the y
// axis and the surface is y = 0, so floors go down into negative y. Angles
// are radians around the axis, measured the same way as the 2D view's x axis
// (0 at the seam, a full turn at 2π). This module has no Three.js in it, so
// drawing and picking share one tested source of truth.

export const FLOOR_H = config.geometry.floorHeightM;
/** Rock between floor 1's ceiling and the surface. */
export const CRUST = config.geometry.surfaceDepthM;
export const GALLERY_W = config.geometry.galleryWidthM;
export const RING_D = config.geometry.roomDepthM;
export const TAU = Math.PI * 2;
/** A gallery tube's floor: a slab this thick on the ledge inside the shaft wall. */
export const LEDGE_THICKNESS = 0.4;
/** The railing inside a gallery tube, above its floor. */
export const RAIL_HEIGHT = 1.1;

/** The slot's angular span [start, end) in radians. */
export function slotAngles(slot: number, n: number): [number, number] {
  return [(slot / n) * TAU, ((slot + 1) / n) * TAU];
}

/** Inner and outer radius of a ring. Ring 1's inner face is the shaft wall. */
export function ringRadii(hole: Hole, ring: number): [number, number] {
  const r0 = hole.shaftRadiusM + (ring - 1) * RING_D;
  return [r0, r0 + RING_D];
}

/** Bottom and top y of a floor. Floor 1's top is the crust's underside, CRUST below the surface. */
export function floorSpan(floor: number): [number, number] {
  return [-floor * FLOOR_H - CRUST, (1 - floor) * FLOOR_H - CRUST];
}

/** The floor a height is on (floor 1 starts under the crust; above it, 0 or less). */
export function floorAtY(y: number): number {
  return Math.floor((-y - CRUST) / FLOOR_H) + 1;
}

/** The open shaft is narrower than the hole by the gallery ledge. */
export function openShaftRadius(hole: Hole): number {
  return hole.shaftRadiusM - GALLERY_W;
}

export function polar(r: number, angle: number, y: number): [number, number, number] {
  return [r * Math.cos(angle), y, r * Math.sin(angle)];
}

/** What's at a world point: the inverse of the functions above. */
export function pickAt(hole: Hole, x: number, y: number, z: number): Pick {
  const turn = (((Math.atan2(z, x) / TAU) % 1) + 1) % 1;
  const angle = turn * 360;
  if (y >= 0) return { kind: "surface", angle };
  // The crust between the surface and floor 1.
  if (y > -CRUST) return { kind: "rock" };

  const floor = floorAtY(y);
  if (floor > hole.floors + 1) return { kind: "rock" };
  const digging = floor === hole.floors + 1;
  const r = Math.hypot(x, z);
  if (r < hole.shaftRadiusM) return r >= openShaftRadius(hole) ? { kind: "gallery", floor, angle, digging } : { kind: "rock" };

  const ring = Math.floor((r - hole.shaftRadiusM) / RING_D) + 1;
  if (ring > hole.ringSlots.length) return { kind: "rock" };
  const n = hole.ringSlots[ring - 1]!;
  const slot = Math.min(Math.floor(turn * n), n - 1);
  return { kind: "slot", floor, ring, slot, locked: ring > hole.unlockedRings, digging, angle };
}
