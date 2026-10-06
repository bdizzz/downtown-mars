import { describe, expect, it } from "vitest";
import { isoFitDistance } from "../src/render3d/isoReach";

describe("Iso's zoom-out limit", () => {
  it("grows with the disc it has to fit", () => {
    const small = isoFitDistance(40, 0.75, 55, 1.6);
    const big = isoFitDistance(80, 0.75, 55, 1.6);
    expect(big / small).toBeCloseTo(2, 1);
  });

  it("backs off further on a narrow (portrait) window than a wide one", () => {
    expect(isoFitDistance(77, 0.75, 55, 0.5)).toBeGreaterThan(isoFitDistance(77, 0.75, 55, 1.6) * 1.5);
  });

  it("looking straight down, matches the plain field-of-view fit", () => {
    // From overhead, a disc of radius r fills a square view at r / tan(fov / 2).
    const d = isoFitDistance(50, Math.PI / 2 - 1e-6, 60, 1);
    expect(d).toBeCloseTo(50 / Math.tan(Math.PI / 6), 0);
  });

  it("stops a starter hole's six rings (77 m padded) well short of the old 400 m", () => {
    const d = isoFitDistance(70 * 1.1, 0.75, 55, 1.6, 4.8);
    expect(d).toBeGreaterThan(64);
    expect(d).toBeLessThan(250);
  });
});
