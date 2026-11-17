import { describe, expect, it } from "vitest";
import { oklab, RETRO, retroGrid, retroStyleFrom } from "../src/render3d/lookRetro";

describe("retro looks (#503)", () => {
  it("reads the style from the address", () => {
    expect(retroStyleFrom("?look=snes")).toBe("snes");
    expect(retroStyleFrom("?foo=1&look=ps1")).toBe("ps1");
    expect(retroStyleFrom("?look=n64")).toBeNull();
    expect(retroStyleFrom("")).toBeNull();
  });

  it("scales the small picture up by a whole number that covers the screen", () => {
    const g = retroGrid(2560, 1440, 224);
    expect(g.scale).toBe(6);
    expect(g.w * g.scale).toBeGreaterThanOrEqual(2560);
    expect(g.h * g.scale).toBeGreaterThanOrEqual(1440);
    expect(retroGrid(300, 100, 224).scale).toBe(1);
  });

  it("puts black and white at the ends of OKLab lightness", () => {
    expect(oklab("000000")[0]).toBeCloseTo(0, 5);
    expect(oklab("ffffff")[0]).toBeCloseTo(1, 3);
    expect(Math.abs(oklab("ffffff")[1])).toBeLessThan(1e-3);
  });

  it("has a palette of valid colours for the SNES look", () => {
    const p = RETRO.snes.palette!;
    expect(p.length).toBeGreaterThan(8);
    for (const h of p) expect(h).toMatch(/^[0-9a-f]{6}$/);
    expect(new Set(p).size).toBe(p.length);
  });
});
