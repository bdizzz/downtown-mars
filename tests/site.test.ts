import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { foundingRefusal } from "../src/sim/founding";
import { soilAt } from "../src/sim/map";
import { mapColor, onIceCap } from "../src/sim/mapgeo";
import { createWorld } from "../src/sim/world";
import { GROUND_BASE, soilTint } from "../src/render3d/terrain3d";
import { celestialPole, siteLatitude, starTurn, sunDirection, turn, type Vec3 } from "../src/view/sunPath";

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255);
};
const close = (a: Vec3, b: Vec3) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 6));
const deg = (r: number) => (r * 180) / Math.PI;

describe("a site's soil and ice (T-073)", () => {
  it("takes the map's colour: dark in the lowlands, pale on the heights", () => {
    const hellas = soilAt({ lat: -42.4, lon: 70.5 });
    const arcadia = soilAt({ lat: 46, lon: 192 });
    const tharsis = soilAt({ lat: 1, lon: 247 });
    expect(lum(hellas)).toBeLessThan(lum(arcadia));
    expect(lum(arcadia)).toBeLessThan(lum(tharsis));
  });

  it("whitens toward the poles, as the map does", () => {
    expect(mapColor(-4000, 89)).toEqual([236, 238, 240]);
    expect(mapColor(0, 0)).toEqual([154, 82, 48]);
  });

  it("tints the ground toward it, softened so it stays Mars", () => {
    const dark = soilTint(GROUND_BASE, soilAt({ lat: -42.4, lon: 70.5 }));
    const pale = soilTint(GROUND_BASE, soilAt({ lat: 1, lon: 247 }));
    expect(dark).not.toBe(pale);
    expect(soilTint(GROUND_BASE, null)).toBe(GROUND_BASE);
    // Still red: red stays the strongest channel even in the deepest basin.
    const c = soilTint(GROUND_BASE, soilAt({ lat: -42.4, lon: 70.5 }));
    expect(c >> 16).toBeGreaterThan(c & 255);
  });

  it("counts only the polar caps as ice", () => {
    expect(onIceCap({ lat: 85 })).toBe(true);
    expect(onIceCap({ lat: -86 })).toBe(true);
    expect(onIceCap({ lat: 75 })).toBe(false);
    expect(onIceCap({ lat: -82 })).toBe(false);
  });

  it("won't found a hole on a cap", () => {
    const w = createWorld(config, 42);
    expect(foundingRefusal(w, w.holes[0]!, { lat: 86, lon: 10 })).toMatch(/Ice cap/);
  });
});

describe("the sun and stars by latitude (T-020)", () => {
  it("rises due east and sets due west, everywhere", () => {
    for (const lat of [0, 40, -60]) {
      close(sunDirection(0.25, lat), [1, 0, 0]);
      close(sunDirection(0.75, lat), [-1, 0, 0]);
    }
  });

  it("peaks at 90° − |latitude|, toward the equator", () => {
    // At 40°N the noon sun is 50° up, to the south (+z, since north is −z).
    const n = sunDirection(0.5, 40);
    expect(deg(Math.asin(n[1]))).toBeCloseTo(50, 6);
    expect(n[2]).toBeGreaterThan(0);
    // At 30°S, 60° up to the north.
    const s = sunDirection(0.5, -30);
    expect(deg(Math.asin(s[1]))).toBeCloseTo(60, 6);
    expect(s[2]).toBeLessThan(0);
    // At the equator, overhead.
    close(sunDirection(0.5, 0), [0, 1, 0]);
  });

  it("puts the pole at the latitude's height above north", () => {
    const p = celestialPole(40);
    expect(deg(Math.asin(p[1]))).toBeCloseTo(40, 6);
    expect(p[2]).toBeLessThan(0);
  });

  it("turns the stars with the sun about the pole", () => {
    for (const lat of [0, 40, -25]) {
      for (const f of [0.1, 0.3, 0.62, 0.9]) {
        // The turn takes the sun now back to where it stood at noon, and leaves the pole where it is.
        close(turn(starTurn(f, lat), sunDirection(f, lat)), sunDirection(0.5, lat));
        close(turn(starTurn(f, lat), celestialPole(lat)), celestialPole(lat));
      }
    }
  });

  it("uses a default latitude off the map", () => {
    expect(siteLatitude(null)).toBe(45);
    expect(siteLatitude({ lat: -12 })).toBe(-12);
  });
});
