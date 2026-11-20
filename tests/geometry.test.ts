import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { circleRadius, createHole, slotAreaM2, outerRadius, overlappingSlots, ringAt, ringDepth, ringRadii, ringsAt, slotsInRing, wrapSlot } from "../src/sim/geometry";

// The general formula, each ring on its own (the game lists its rings' slots in data; see below).
const geo: typeof config.geometry = { ...config.geometry, ringSlots: undefined, pairedRings: false };
const rings = (R: number, g: typeof config.geometry = geo) => [1, 2, 3, 4, 5, 6].map((n) => slotsInRing(R, n, g));

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
    const paired = { ...geo, pairedRings: true, nestedPairs: false };
    expect(rings(10, paired)).toEqual([9, 9, 22, 22, 35, 35]);
  });

  it("nested pairs: each pair has the nearest whole multiple of the pair inside it", () => {
    const nested = { ...geo, pairedRings: true, nestedPairs: true };
    expect(rings(10, nested)).toEqual([9, 9, 18, 18, 36, 36]); // 22 → 2 × 9, 35 → 2 × 18
    expect(rings(40, nested)).toEqual([28, 28, 28, 28, 56, 56]); // 41 → 1 × 28, 53 → 2 × 28
  });

  it("the game's rings: 9, 18 and 18, then 36s (#548)", () => {
    expect(rings(10, config.geometry)).toEqual([9, 18, 18, 36, 36, 36]);
    expect(createHole(10, 1, 3, config.geometry).ringSlots).toEqual([9, 18, 18, 36, 36, 36]);
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

describe("ring radii (#547)", () => {
  const hole = createHole(10, 3, 3, { ...config.geometry, equalAreaRings: false });

  it("are 10 m each without equal-area rings", () => {
    expect(hole.ringRadiiM).toEqual([10, 20, 30, 40, 50, 60, 70]);
    expect([1, 2, 3].map((r) => ringRadii(hole, r))).toEqual([[10, 20], [20, 30], [30, 40]]);
    expect([1, 2, 3, 4, 5, 6].map((r) => ringDepth(hole, r))).toEqual([10, 10, 10, 10, 10, 10]);
    expect(outerRadius(hole)).toBe(40);
    expect(outerRadius(hole, 6)).toBe(70);
  });

  it("go both ways between radius and rings", () => {
    expect(circleRadius(hole, 1.5)).toBe(25);
    expect(ringsAt(hole, 25)).toBe(1.5);
    expect(ringsAt(hole, 8)).toBe(-0.2); // inside the shaft wall, in ring 1's proportion
    expect([10, 19.9, 20, 39.9, 75].map((r) => ringAt(hole, r))).toEqual([1, 1, 2, 3, 7]);
    expect(ringAt(hole, 9)).toBeLessThanOrEqual(0);
  });

  it("give every slot a ring-1 slot's area with equal-area rings (#548)", () => {
    const eq = createHole(10, 3, 3, config.geometry);
    const want = [10, 20, Math.sqrt(1000), 40, Math.sqrt(2800), Math.sqrt(4000), Math.sqrt(5200)];
    eq.ringRadiiM.forEach((r, k) => expect(r).toBeCloseTo(want[k]!, 9));
    expect([1, 2, 3].map((r) => ringDepth(eq, r).toFixed(1))).toEqual(["10.0", "11.6", "8.4"]);
    const area = (100 * Math.PI) / 3;
    for (let r = 1; r <= 6; r++) expect(slotAreaM2(eq, r)).toBeCloseTo(area, 9);
    expect(outerRadius(eq)).toBeCloseTo(40, 9);
  });

  it("follow each ring's own depth", () => {
    const deep = { ...hole, ringRadiiM: [10, 20, 31.6, 40, 52.9, 63.2, 72.1] };
    expect(ringDepth(deep, 2)).toBeCloseTo(11.6);
    expect(ringAt(deep, 31)).toBe(2);
    expect(ringsAt(deep, 31.6)).toBe(2);
    expect(circleRadius(deep, 2.5)).toBeCloseTo(35.8);
  });
});
