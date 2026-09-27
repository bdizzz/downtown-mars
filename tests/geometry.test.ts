import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { createHole, overlappingSlots, slotsInRing, wrapSlot } from "../src/sim/geometry";

// The general formula, each ring on its own (the game pairs them; see below).
const geo = { ...config.geometry, pairedRings: false };
const rings = (R: number, g = geo) => [1, 2, 3, 4, 5, 6].map((n) => slotsInRing(R, n, g));

describe("slots per ring", () => {
  it("narrow hole (R = 10 m)", () => {
    // Docs quote ring 6 as "≈ 40"; the formula gives 41.
    expect(rings(10)).toEqual([9, 16, 22, 28, 35, 41]);
  });

  it("wide hole (R = 40 m)", () => {
    const r = rings(40);
    expect([r[0], r[2], r[5]]).toEqual([28, 41, 60]);
  });

  it("paired rings: each even ring has the slots of the odd ring inside it", () => {
    const paired = { ...config.geometry, pairedRings: true };
    expect(rings(10, paired)).toEqual([9, 9, 22, 22, 35, 35]);
    expect(config.geometry.pairedRings).toBe(true); // the game's setting
  });
});

describe("wrapping", () => {
  it("wraps negative and overflow slots", () => {
    expect(wrapSlot(-1, 9)).toBe(8);
    expect(wrapSlot(9, 9)).toBe(0);
    expect(wrapSlot(20, 9)).toBe(2);
  });
});

describe("angular overlap across rings", () => {
  const hole = createHole(10, 3, 3, geo);

  it("same ring overlaps only itself", () => {
    expect(overlappingSlots(hole, 2, 5, 2)).toEqual([5]);
  });

  it("ring 1 slot 0 (0°–40°) touches ring 2 slots 0–1 (0°–45°)", () => {
    expect(overlappingSlots(hole, 1, 0, 2)).toEqual([0, 1]);
  });

  it("is symmetric between every pair of rings", () => {
    for (let a = 1; a <= 6; a++) {
      for (let b = 1; b <= 6; b++) {
        const na = hole.ringSlots[a - 1]!;
        for (let s = 0; s < na; s++) {
          for (const t of overlappingSlots(hole, a, s, b)) {
            expect(overlappingSlots(hole, b, t, a)).toContain(s);
          }
        }
      }
    }
  });

  it("covers the whole outer ring with no gaps", () => {
    const hit = new Set<number>();
    for (let s = 0; s < 16; s++) overlappingSlots(hole, 2, s, 3).forEach((t) => hit.add(t));
    expect(hit.size).toBe(22);
  });

  it("the last slot overlaps across the 0° seam correctly", () => {
    // ring 1 slot 8 spans 320°–360°; ring 2 slot 15 spans 337.5°–360°.
    expect(overlappingSlots(hole, 1, 8, 2)).toEqual([14, 15]);
  });
});
