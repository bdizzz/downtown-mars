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
  const midRadius = shaftRadiusM + (ring - 0.5) * geo.roomDepthM;
  return Math.round((2 * Math.PI * midRadius) / geo.slotWidthM);
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
