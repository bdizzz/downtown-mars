import type { GeometryConfig, SurfaceGeometry } from "./config";

// Rings are numbered from 1 (facing the shaft). Slots are numbered from 0 and
// wrap, since each ring is a loop. Positions around a ring are measured in
// turns (0..1), so slots in different rings can be compared by angle.

export interface Hole {
  shaftRadiusM: number;
  floors: number;
  unlockedRings: number;
  /** ringSlots[ring - 1] = number of slots in that ring, for all maxRings rings. */
  ringSlots: number[];
  /**
   * The radius of each circle between rings, metres, for all maxRings rings: ringRadiiM[0] is the shaft wall,
   * ringRadiiM[k] the outer face of ring k. Each ring has its own depth (#547), so nothing should assume a fixed
   * one: go through ringRadii, circleRadius and ringAt.
   */
  ringRadiiM: number[];
}

/** slots(n) = round(2π · (R + (n − 0.5) · d) / w) */
export function slotsInRing(shaftRadiusM: number, ring: number, geo: GeometryConfig): number {
  // Paired rings: an even ring has the same slots as the odd ring inside it.
  if (geo.pairedRings && ring % 2 === 0) return slotsInRing(shaftRadiusM, ring - 1, geo);
  const midRadius = shaftRadiusM + (ring - 0.5) * geo.roomDepthM;
  const natural = Math.round((2 * Math.PI * midRadius) / geo.slotWidthM);
  // Nested pairs: the nearest whole multiple (at least 1) of the pair inside.
  if (geo.pairedRings && geo.nestedPairs && ring > 2) {
    const inside = slotsInRing(shaftRadiusM, ring - 2, geo);
    return inside * Math.max(1, Math.round(natural / inside));
  }
  return natural;
}

export function createHole(
  shaftRadiusM: number,
  floors: number,
  unlockedRings: number,
  geo: GeometryConfig,
): Hole {
  const ringSlots = Array.from({ length: geo.maxRings }, (_, i) => slotsInRing(shaftRadiusM, i + 1, geo));
  return { shaftRadiusM, floors, unlockedRings, ringSlots, ringRadiiM: ringRadiiFor(shaftRadiusM, geo) };
}

/** Every circle's radius for a hole of this shaft radius: the shaft wall, then each ring's outer face. */
export function ringRadiiFor(shaftRadiusM: number, geo: GeometryConfig, rings = geo.maxRings): number[] {
  return Array.from({ length: rings + 1 }, (_, k) => shaftRadiusM + k * geo.roomDepthM);
}

/** Circle k's radius (0 is the shaft wall, k the outer face of ring k). A fractional k falls between, in proportion. */
export function circleRadius(hole: Hole, circle: number): number {
  const radii = hole.ringRadiiM;
  const last = radii.length - 1;
  const k = Math.max(0, Math.min(last - 1, Math.floor(circle)));
  return radii[k]! + (circle - k) * (radii[k + 1]! - radii[k]!);
}

/** Inner and outer radius of a ring. Ring 1's inner face is the shaft wall. */
export function ringRadii(hole: Hole, ring: number): [number, number] {
  return [circleRadius(hole, ring - 1), circleRadius(hole, ring)];
}

/** How deep a ring is, metres. */
export function ringDepth(hole: Hole, ring: number): number {
  const [r0, r1] = ringRadii(hole, ring);
  return r1 - r0;
}

/** The radius halfway through a ring. */
export function ringMidRadius(hole: Hole, ring: number): number {
  return circleRadius(hole, ring - 0.5);
}

/**
 * How far out from the shaft wall a radius is, in rings: 0 at the wall, 1 at ring 1's outer face, 1.5 halfway
 * through ring 2. The inverse of circleRadius; inside the wall it's negative, in ring 1's proportion.
 */
export function ringsAt(hole: Hole, radiusM: number): number {
  const radii = hole.ringRadiiM;
  const last = radii.length - 1;
  let k = 0;
  while (k < last - 1 && radiusM >= radii[k + 1]!) k++;
  return k + (radiusM - radii[k]!) / (radii[k + 1]! - radii[k]!);
}

/** The ring a radius falls in (1 from the shaft wall out); 0 or less inside it, past the last ring beyond. */
export function ringAt(hole: Hole, radiusM: number): number {
  return Math.floor(ringsAt(hole, radiusM)) + 1;
}

/** The outer face of the hole's open rings (or of `rings` rings), metres from the axis. */
export function outerRadius(hole: Hole, rings = hole.unlockedRings): number {
  return circleRadius(hole, rings);
}

export function ringSize(hole: Hole, ring: number): number {
  const n = hole.ringSlots[ring - 1];
  if (n === undefined) throw new RangeError(`ring ${ring} out of range`);
  return n;
}

export function wrapSlot(slot: number, n: number): number {
  return ((slot % n) + n) % n;
}

/** Angular span of a slot, in turns: [start, end). end may equal 1. */
export function slotSpan(slot: number, n: number): [number, number] {
  const s = wrapSlot(slot, n);
  return [s / n, (s + 1) / n];
}

// Guards against float error making slots that only touch at an edge
// count as overlapping.
const EPS = 1e-9;

/**
 * Slots in ring `toRing` whose angular span overlaps slot `slot` of ring
 * `fromRing`. This is how adjacency works across rings, since slot indices
 * don't line up one-to-one.
 */
export function overlappingSlots(hole: Hole, fromRing: number, slot: number, toRing: number): number[] {
  const [a, b] = slotSpan(slot, ringSize(hole, fromRing));
  const m = ringSize(hole, toRing);
  const first = Math.floor(a * m + EPS);
  const last = Math.ceil(b * m - EPS) - 1;
  const out: number[] = [];
  for (let k = first; k <= last; k++) out.push(wrapSlot(k, m));
  return out;
}

/** How far a surface ring's buildings stand from the shaft's centre, metres (ring 1 is nearest the rim). */
export function surfaceRingRadiusM(shaftRadiusM: number, ring: number, geo: SurfaceGeometry): number {
  return shaftRadiusM + geo.surfaceRingM + (ring - 1) * geo.surfaceRingDepthM;
}

/** Spots in surface ring n: the first ring's count, scaled by radius as underground rings are, so spots stay about as wide. */
export function surfaceRingSlots(shaftRadiusM: number, ring: number, geo: SurfaceGeometry): number {
  const r1 = surfaceRingRadiusM(shaftRadiusM, 1, geo);
  return Math.round((geo.surfaceSlots * surfaceRingRadiusM(shaftRadiusM, ring, geo)) / r1);
}

/** Which surface ring a point this far from the shaft's centre falls in, clamped to the open ones. */
export function surfaceRingAt(shaftRadiusM: number, radiusM: number, geo: SurfaceGeometry): number {
  const first = shaftRadiusM + geo.surfaceRingM;
  const ring = Math.round((radiusM - first) / geo.surfaceRingDepthM) + 1;
  return Math.min(geo.surfaceRings, Math.max(1, ring));
}
