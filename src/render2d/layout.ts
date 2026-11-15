import type { Hole } from "../sim/geometry";
import { config } from "../sim/config";
import type { Pick } from "../view/types";

export type { Pick };

// Unrolled view layout in world pixels (before zoom). x is angle: one full
// turn spans TURN_W for every ring, so vertically aligned slots really are
// neighbors. y runs down: surface strip, then one band per floor.

export const TURN_W = 1440;
export const SURFACE_H = 120;
export const GALLERY_H = 16;
export const RING_H = 48;
export const FLOOR_GAP = 10;
export const UNDUG_H = 160; // rock shown below the deepest floor
/** The ground at the foot of the surface strip, and how far up each further surface ring is drawn (T-108). */
export const SURFACE_GROUND_H = 10;
export const SURFACE_RING_H = 36;

/** Where a surface ring's buildings stand in the surface strip: ring 1 on the ground, outer rings stacked above, as if further off. */
export function surfaceRingBase(ring: number): number {
  return SURFACE_H - SURFACE_GROUND_H - (ring - 1) * SURFACE_RING_H;
}

/** The surface ring drawn at height y in the surface strip. */
export function surfaceRingAtY(y: number, rings = config.geometry.surfaceRings): number {
  return Math.min(rings, Math.max(1, Math.floor((SURFACE_H - SURFACE_GROUND_H - y) / SURFACE_RING_H) + 1));
}

export function bandHeight(maxRings: number): number {
  return GALLERY_H + maxRings * RING_H + FLOOR_GAP;
}

export function floorTop(floor: number, maxRings: number): number {
  return SURFACE_H + (floor - 1) * bandHeight(maxRings);
}

export function ringTop(floor: number, ring: number, maxRings: number): number {
  return floorTop(floor, maxRings) + GALLERY_H + (ring - 1) * RING_H;
}

/** Everything down to the floor being dug, plus some rock below it. */
export function worldHeight(hole: Hole): number {
  return floorTop(hole.floors + 2, hole.ringSlots.length) + UNDUG_H;
}

export function slotX(slot: number, n: number): [number, number] {
  return [(slot / n) * TURN_W, ((slot + 1) / n) * TURN_W];
}


/** What sits at world point (x, y)? x may be any value; it wraps. */
export function pick(hole: Hole, x: number, y: number): Pick {
  const turn = (((x / TURN_W) % 1) + 1) % 1;
  const angle = turn * 360;
  if (y < SURFACE_H) return y >= 0 ? { kind: "surface", angle, ring: surfaceRingAtY(y) } : { kind: "rock" };

  const maxRings = hole.ringSlots.length;
  const band = bandHeight(maxRings);
  const floor = Math.floor((y - SURFACE_H) / band) + 1;
  if (floor > hole.floors + 1) return { kind: "rock" };
  const digging = floor === hole.floors + 1;

  const inBand = y - floorTop(floor, maxRings);
  if (inBand < GALLERY_H) return { kind: "gallery", floor, angle, digging };
  const ring = Math.floor((inBand - GALLERY_H) / RING_H) + 1;
  if (ring > maxRings) return { kind: "rock" }; // the gap between floors

  const n = hole.ringSlots[ring - 1]!;
  const slot = Math.min(Math.floor(turn * n), n - 1);
  return { kind: "slot", floor, ring, slot, locked: ring > hole.unlockedRings, digging, angle };
}
