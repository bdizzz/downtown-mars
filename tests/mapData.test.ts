import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import names from "../data/mars-names.json";
import soil from "../data/mars-soil.json";

// The founding map from real Mars data (#499): what scripts/build-map.py and build-names.mjs leave behind.

describe("the map's real data", () => {
  it("has a tile for every 15° square, and the heights", () => {
    const tiles = readdirSync("public/map/tiles").filter((f) => f.endsWith(".jpg"));
    expect(tiles.length).toBe(12 * 24);
    for (let row = 0; row < 12; row++) for (let col = 0; col < 24; col++) expect(existsSync(`public/map/tiles/${row}_${col}.jpg`)).toBe(true);
    const png = readFileSync("public/map/height.png");
    // A PNG, 1440 × 720 (4 px a degree), as Globe.tsx reads it.
    expect(png.readUInt32BE(16)).toBe(1440);
    expect(png.readUInt32BE(20)).toBe(720);
  });

  it("keeps the soil's colour on a 2° grid, rows from the north", () => {
    expect(soil.width * soil.degreesPerCell).toBe(360);
    expect(soil.height * soil.degreesPerCell).toBe(180);
    expect(Buffer.from(soil.rgb, "base64").length).toBe(soil.width * soil.height * 3);
  });

  it("names the IAU's features biggest first, without the old albedo names", () => {
    const list = names.names;
    expect(list.length).toBeGreaterThan(1500);
    for (let i = 1; i < list.length; i++) expect(list[i]!.km).toBeLessThanOrEqual(list[i - 1]!.km);
    const by = (n: string) => list.find((f) => f.name === n);
    expect(by("Olympus Mons")).toMatchObject({ kind: "mons" });
    expect(by("Valles Marineris")).toMatchObject({ kind: "vallis" });
    expect(by("Gale")).toMatchObject({ kind: "crater" });
    expect(by("Gale")!.lat).toBeCloseTo(-5.4, 0);
    for (const f of list) {
      expect(f.lon).toBeGreaterThanOrEqual(0);
      expect(f.lon).toBeLessThanOrEqual(360);
      expect(Math.abs(f.lat)).toBeLessThanOrEqual(90);
    }
  });
});
