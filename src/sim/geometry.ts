import type { GeometryConfig } from "./config";

// Rings are numbered from 1 (facing the shaft). Slots are numbered from 0 and
// wrap, since each ring is a loop. Positions around a ring are measured in
// turns (0..1), so slots in different rings can be compared by angle.

export interface Hole {
  shaftRadiusM: number;
  floors: number;
  unlockedRings: number;
  /** ringSlots[ring - 1] = number of slots in that ring, for all maxRings rings. */
  ringSlots: number[];
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
  return { shaftRadiusM, floors, unlockedRings, ringSlots };
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

// Angles (F-004, PLAN-M17): whole notches, `notchesPerTurn` a turn, so edges
// meet exactly and rooms on different rings line up exactly. A ring room's
// angle range is [start, start + span), wrapping at a turn.

export function wrapNotch(a: number, notches: number): number {
  return ((a % notches) + notches) % notches;
}

/** Inner and outer radius of a ring, metres. */
export function ringRadii(shaftRadiusM: number, ring: number, geo: GeometryConfig): [number, number] {
  return [shaftRadiusM + (ring - 1) * geo.roomDepthM, shaftRadiusM + ring * geo.roomDepthM];
}

/** The notch a slot boundary falls on (rounded, the same way on both sides of it). */
export function slotNotch(slot: number, n: number, notches: number): number {
  return Math.round((slot * notches) / n);
}

/** Start and span, in notches, of w slots from `slot` in a ring of n slots. */
export function slotsToAngles(slot: number, w: number, n: number, notches: number): { start: number; span: number } {
  const s = wrapSlot(slot, n);
  const start = slotNotch(s, n, notches);
  return { start: wrapNotch(start, notches), span: slotNotch(s + w, n, notches) - start };
}

/** Floor area, m², of `span` notches across `depth` rings from `ring` outward. */
export function spanArea(shaftRadiusM: number, ring: number, depth: number, span: number, geo: GeometryConfig): number {
  const [rIn] = ringRadii(shaftRadiusM, ring, geo);
  const [, rOut] = ringRadii(shaftRadiusM, ring + depth - 1, geo);
  return ((span / geo.notchesPerTurn) * 2 * Math.PI * (rOut * rOut - rIn * rIn)) / 2;
}

/** The whole number of notches nearest to `area` m² across `depth` rings from `ring` outward. */
export function spanForArea(shaftRadiusM: number, ring: number, depth: number, area: number, geo: GeometryConfig): number {
  return Math.round(area / spanArea(shaftRadiusM, ring, depth, 1, geo));
}
