import { describe, expect, it } from "vitest";
import { oklab, paletteSubset, RETRO_PALETTE, RETRO_PRESETS, retroGrid, retroStyleFrom } from "../src/render3d/lookRetro";

describe("retro looks (#503)", () => {
  it("reads the style from the address", () => {
    expect(retroStyleFrom("?look=snes")).toBe("snes");
    expect(retroStyleFrom("?foo=1&look=ps1")).toBe("ps1");
    expect(retroStyleFrom("?look=blueprint")).toBe("blueprint");
    expect(retroStyleFrom("?look=gameboy")).toBeNull();
    expect(retroStyleFrom("")).toBeNull();
  });

  it("scales the small picture up by a whole number that covers the screen", () => {
    const g = retroGrid(2560, 1440, 6.4);
    expect(g.scale).toBe(6);
    expect(g.w * g.scale).toBeGreaterThanOrEqual(2560);
    expect(g.h * g.scale).toBeGreaterThanOrEqual(1440);
    expect(retroGrid(300, 100, 0.2).scale).toBe(1);
  });

  it("puts black and white at the ends of OKLab lightness", () => {
    expect(oklab("000000")[0]).toBeCloseTo(0, 5);
    expect(oklab("ffffff")[0]).toBeCloseTo(1, 3);
    expect(Math.abs(oklab("ffffff")[1])).toBeLessThan(1e-3);
  });

  it("has a palette of valid colours for the SNES look", () => {
    const p = RETRO_PALETTE;
    expect(p.length).toBeGreaterThan(8);
    for (const h of p) expect(h).toMatch(/^[0-9a-f]{6}$/);
    expect(new Set(p).size).toBe(p.length);
    expect(RETRO_PRESETS.snes!.paletteSize).toBeLessThanOrEqual(p.length);
  });

  it("fills every preset out from the base, with the base's kinds of values", () => {
    const base = RETRO_PRESETS.snes!;
    for (const [name, p] of Object.entries(RETRO_PRESETS)) {
      expect(Object.keys(p).sort(), name).toEqual(Object.keys(base).sort());
      for (const k of Object.keys(base) as (keyof typeof base)[]) expect(typeof p[k], `${name}.${k}`).toBe(typeof base[k]);
    }
    expect(Object.keys(RETRO_PRESETS)).toEqual(expect.arrayContaining(["snes", "ps1", "n64", "cel", "painterly", "blueprint", "vector", "ascii", "crt"]));
  });

  it("picks smaller palettes spread out, starting from the darkest", () => {
    const two = paletteSubset(RETRO_PALETTE, 2);
    expect(two[0]).toBe("0e0a0c");
    expect(two[1]).toBe("fff8ec");
    expect(paletteSubset(RETRO_PALETTE, 8)).toHaveLength(8);
    expect(new Set(paletteSubset(RETRO_PALETTE, 32)).size).toBe(32);
    expect(paletteSubset(RETRO_PALETTE, 99)).toHaveLength(RETRO_PALETTE.length);
  });
});
