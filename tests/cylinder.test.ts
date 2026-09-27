import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { createHole } from "../src/sim/geometry";
import { FLOOR_H, floorSpan, openShaftRadius, pickAt, polar, ringRadii, slotAngles, TAU } from "../src/render3d/cylinder";
import { pick as pick2d, slotX, TURN_W } from "../src/render2d/layout";

const hole = createHole(10, 3, 3, config.geometry);

describe("3D cell geometry", () => {
  it("slots tile the full turn", () => {
    const n = hole.ringSlots[2]!;
    expect(slotAngles(0, n)[0]).toBe(0);
    expect(slotAngles(n - 1, n)[1]).toBeCloseTo(TAU);
    expect(slotAngles(4, n)[1]).toBeCloseTo(slotAngles(5, n)[0]);
  });

  it("rings stack outward from the shaft wall, 10 m deep", () => {
    expect(ringRadii(hole, 1)).toEqual([10, 20]);
    expect(ringRadii(hole, 3)).toEqual([30, 40]);
    expect(openShaftRadius(hole)).toBe(8);
  });

  it("floors stack down from the surface", () => {
    expect(floorSpan(1)).toEqual([-FLOOR_H, 0]);
    expect(floorSpan(3)).toEqual([-3 * FLOOR_H, -2 * FLOOR_H]);
  });

  it("picking the centre of every cell returns that cell", () => {
    for (let floor = 1; floor <= 3; floor++) {
      for (let ring = 1; ring <= 6; ring++) {
        const n = hole.ringSlots[ring - 1]!;
        const [r0, r1] = ringRadii(hole, ring);
        const [y0, y1] = floorSpan(floor);
        for (let slot = 0; slot < n; slot++) {
          const [a0, a1] = slotAngles(slot, n);
          const [x, y, z] = polar((r0 + r1) / 2, (a0 + a1) / 2, (y0 + y1) / 2);
          expect(pickAt(hole, x, y, z)).toMatchObject({ kind: "slot", floor, ring, slot });
        }
      }
    }
  });

  it("agrees with the 2D view about which slot is at an angle", () => {
    for (const deg of [0.5, 45, 100, 179.9, 200, 359.5]) {
      const a = (deg / 360) * TAU;
      const [x, y, z] = polar(25, a, -FLOOR_H * 1.5);
      const three = pickAt(hole, x, y, z);
      // Same floor 2, ring 2, at the same fraction of a turn in the 2D layout.
      const n = hole.ringSlots[1]!;
      const [x0] = slotX(0, n);
      const two = pick2d(hole, x0 + (deg / 360) * TURN_W, 120 + 1 * (16 + 6 * 48 + 10) + 16 + 48 + 1);
      expect(three).toMatchObject({ kind: "slot", ring: 2, floor: 2 });
      expect(two).toMatchObject({ kind: "slot", ring: 2, floor: 2 });
      expect(three.kind === "slot" && two.kind === "slot" && three.slot).toBe(two.kind === "slot" && two.slot);
    }
  });

  it("finds the gallery, the surface and rock", () => {
    expect(pickAt(hole, 9, -1, 0)).toMatchObject({ kind: "gallery", floor: 1 });
    expect(pickAt(hole, 3, -1, 0)).toMatchObject({ kind: "rock" }); // open air in the shaft
    expect(pickAt(hole, 30, 1, 0)).toMatchObject({ kind: "surface" });
    // Floors 1–3 are dug and floor 4 is being dug; below that is rock.
    expect(pickAt(hole, 15, -FLOOR_H * 3.5, 0)).toMatchObject({ kind: "slot", floor: 4, digging: true });
    expect(pickAt(hole, 15, -FLOOR_H * 4.5, 0)).toMatchObject({ kind: "rock" });
  });
});
