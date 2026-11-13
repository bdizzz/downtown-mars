import { config } from "../src/sim/config";
import { createHole, slotNotch } from "../src/sim/geometry";
import { arcAt, type ArcEdge } from "../src/sim/edges";
import { slotSpot, type Layout, type Spot } from "../src/sim/placement";
import type { Cell } from "../src/sim/space";

// Tests lay rooms out on the rings' grid (9, 9, 18, 18, 36, 36 round the starter
// hole), as the game did before rooms went by angle (F-004). A spot from here
// keeps that slot's exact angles, whatever area that makes (`fixed`), so a test
// can say "ring 2, slot 3" and get rooms that sit wall to wall. Placing by
// area is tested on its own (tests/byArea.test.ts).

const h = config.starterHole;
export const GRID = createHole(h.shaftRadiusM, h.floors, h.unlockedRings, config.geometry);
const N = config.geometry.notchesPerTurn;

/** The spot of `w` grid slots from `slot`, `d` rings deep, on the starter hole's rings. */
export function ringAt(floor: number, ring: number, slot: number, w = 1, d = 1): Spot & { kind: "ring" } {
  return slotSpot(GRID, floor, ring, slot, w, d);
}

/** One grid slot as a cell. */
export function cellAt(floor: number, ring: number, slot: number, w = 1): Cell {
  const n = GRID.ringSlots[ring - 1]!;
  const a0 = slotNotch(((slot % n) + n) % n, n, N);
  return { floor, ring, a0, a1: a0 + slotNotch(w, n, N) };
}

/** The notch a grid slot starts at. */
export function notchOf(ring: number, slot: number): number {
  const n = GRID.ringSlots[ring - 1]!;
  return slotNotch(((slot % n) + n) % n, n, N);
}

/** The gallery tube's edge along a ring-1 grid slot (the piece at the slot's middle). */
export function tubeAt(layout: Layout, floor: number, slot: number): ArcEdge {
  return arcAt(layout, floor, 0, (slot + 0.5) / GRID.ringSlots[0]!)!;
}
