import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { createHole } from "../src/sim/geometry";
import type { Cell } from "../src/sim/placement";
import { ringRadii, slotAngles, TAU, WALL_T } from "../src/render3d/cylinder";
import { badgeAbove, BADGE_M, fitLabel, labelSpot, labelY, LINE_M, roughMeasure } from "../src/view/labelFit";

const hole = createHole(10, 3, 3, config.geometry);
/** As rooms3d: half a corridor and half a wall in from each edge line. */
const WALL_IN = 1.5 + WALL_T / 2;

/** Is (x, y, z) inside the room of these cells (one floor, one ring), at least `inset` from every wall? */
function inside(cells: Cell[], x: number, z: number, inset: number): boolean {
  const ring = cells[0]!.ring;
  const n = hole.ringSlots[ring - 1]!;
  const [r0, r1] = ringRadii(hole, ring);
  const r = Math.hypot(x, z);
  if (r < r0 + inset - 1e-6 || r > r1 - inset + 1e-6) return false;
  const turn = (Math.atan2(z, x) + TAU) % TAU;
  // Its angular span, unwrapped from the first cell.
  const [s0] = slotAngles(cells[0]!.slot, n);
  const a0 = s0;
  const a1 = s0 + (cells.length * TAU) / n;
  const rel = (((turn - a0) % TAU) + TAU) % TAU;
  if (rel > a1 - a0) return false;
  // Perpendicular distance to each radial side.
  return r * Math.sin(rel) >= inset - 1e-6 && r * Math.sin(a1 - a0 - rel) >= inset - 1e-6;
}

/** A label's corners as a camera at this yaw and downward pitch sees it (camera right is level; up leans back). */
function corners(c: { x: number; y: number; z: number }, w: number, h: number, yaw: number, pitch: number): number[][] {
  const right = [Math.cos(yaw), 0, Math.sin(yaw)];
  const fwd = [-Math.sin(yaw), 0, Math.cos(yaw)];
  const up = [fwd[0]! * Math.sin(pitch), Math.cos(pitch), fwd[2]! * Math.sin(pitch)];
  const out: number[][] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) out.push([0, 1, 2].map((i) => [c.x, c.y, c.z][i]! + (sx * w * right[i]!) / 2 + (sy * h * up[i]!) / 2));
  return out;
}

const names = ["Dorm", "Hydroponics", "Gray water tank ⚠", "The Long Weekend Recreation Hall", "Supercalifragilisticexpialidocious"];

describe("room labels (T-077)", () => {
  it("never cross a wall, from any angle, in an S room on every ring (across the seam too)", () => {
    for (let ring = 1; ring <= 3; ring++) {
      const n = hole.ringSlots[ring - 1]!;
      for (const slot of [0, 3, n - 1]) {
        const cells = [{ floor: 2, ring, slot }];
        const spot = labelSpot(hole, cells, WALL_IN)!;
        for (const text of names) {
          const fit = fitLabel(text, roughMeasure, spot);
          if (fit.hoverOnly) continue;
          const at = { x: spot.x, y: labelY(spot, fit), z: spot.z };
          // Its badge's room stays under the wall tops too.
          expect(at.y + badgeAbove(fit.heightM) + BADGE_M / 2).toBeLessThanOrEqual(spot.y1);
          for (let yaw = 0; yaw < TAU; yaw += TAU / 24)
            for (const pitch of [0, 0.4, 0.9, 1.3, Math.PI / 2])
              for (const [x, y, z] of corners(at, fit.widthM, fit.heightM, yaw, pitch)) {
                expect(inside(cells, x!, z!, WALL_IN)).toBe(true);
                expect(y!).toBeGreaterThanOrEqual(spot.y0);
                expect(y!).toBeLessThanOrEqual(spot.y1);
              }
        }
      }
    }
  });

  it("sits in the middle of the room's floor", () => {
    const cells = [{ floor: 1, ring: 2, slot: 4 }, { floor: 1, ring: 2, slot: 5 }];
    const spot = labelSpot(hole, cells, WALL_IN)!;
    const [r0, r1] = ringRadii(hole, 2);
    expect(Math.hypot(spot.x, spot.z)).toBeCloseTo((r0 + r1) / 2);
    expect((Math.atan2(spot.z, spot.x) + TAU) % TAU).toBeCloseTo(slotAngles(5, hole.ringSlots[1]!)[0]);
  });

  it("a room across the seam is centred on the seam", () => {
    const n = hole.ringSlots[0]!;
    const spot = labelSpot(hole, [{ floor: 1, ring: 1, slot: n - 1 }, { floor: 1, ring: 1, slot: 0 }], WALL_IN)!;
    expect(Math.atan2(spot.z, spot.x)).toBeCloseTo(0);
  });

  it("short names stay whole at full size; long ones wrap, then shrink, then wait for a hover", () => {
    const spot = labelSpot(hole, [{ floor: 1, ring: 2, slot: 0 }], WALL_IN)!;
    const dorm = fitLabel("Dorm", roughMeasure, spot);
    expect(dorm).toMatchObject({ lines: ["Dorm"], hoverOnly: false });
    expect(dorm.heightM).toBeCloseTo(LINE_M);
    expect(fitLabel("The Long Weekend Recreation Hall", roughMeasure, spot).lines).toHaveLength(2);
    expect(fitLabel("Supercalifragilisticexpialidociousness", roughMeasure, spot).hoverOnly).toBe(true);
    // A big room (three rings deep) has room to spare.
    const big = labelSpot(hole, [[1, 2], [2, 4], [3, 5]].flatMap(([ring, w]) => Array.from({ length: w! }, (_, slot) => ({ floor: 1, ring: ring!, slot }))), WALL_IN)!;
    expect(fitLabel("The Long Weekend Recreation Hall", roughMeasure, big).lines).toHaveLength(1);
  });
});
