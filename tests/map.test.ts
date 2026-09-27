import { describe, expect, it } from "vitest";
import { depositsAt, distanceKm, elevationAt, generateMap, nearestFeature } from "../src/sim/map";

describe("Mars map", () => {
  it("has real elevations for famous places (MOLA, 1°)", () => {
    expect(elevationAt(18.6, 226.2)).toBeGreaterThan(15000); // Olympus Mons
    expect(elevationAt(-42.4, 70.5)).toBeLessThan(-5000); // Hellas
    expect(elevationAt(46, 192)).toBeLessThan(-3000); // Arcadia Planitia
  });

  it("measures distance on the planet", () => {
    // A quarter of the way round the equator: π/2 × 3389.5 km.
    expect(distanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 90 })).toBeCloseTo((Math.PI / 2) * 3389.5, 0);
    expect(distanceKm({ lat: 10, lon: 359 }, { lat: 10, lon: 1 })).toBeLessThan(200); // wraps at 0°
  });

  it("places the same deposits for the same seed, and different ones for another", () => {
    expect(generateMap(7)).toEqual(generateMap(7));
    expect(generateMap(7)).not.toEqual(generateMap(8));
  });

  it("puts every kind of deposit where the terrain suits it", () => {
    const map = generateMap(42);
    const count = (k: string) => map.deposits.filter((d) => d.kind === k).length;
    expect(count("ice")).toBe(12);
    expect(count("ore")).toBe(8);
    for (const d of map.deposits.filter((x) => x.kind === "aquifer")) expect(elevationAt(d.lat, d.lon)).toBeLessThan(-4000);
    for (const d of map.deposits.filter((x) => x.kind === "ice")) {
      expect(Math.abs(d.lat) > 60 || (d.lat > 35 && elevationAt(d.lat, d.lon) < -3000)).toBe(true);
    }
  });

  it("knows what's under a site, and the nearest named place", () => {
    const map = generateMap(42);
    const d = map.deposits[0]!;
    expect(depositsAt(map, d)).toContain(d.kind);
    expect(nearestFeature({ lat: 18, lon: 226 }).feature.name).toBe("Olympus Mons");
  });
});
