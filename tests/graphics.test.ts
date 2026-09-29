import { afterEach, describe, expect, it } from "vitest";
import { cleanGraphics, DEFAULT_GRAPHICS, GRAPHICS_PRESETS, hasPostEffects, presetOf } from "../src/view/graphics";
import { loadSettings } from "../src/ui/settings";

describe("graphics settings", () => {
  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it("defaults to the high preset, and knows each preset", () => {
    expect(presetOf(DEFAULT_GRAPHICS)).toBe("high");
    for (const p of ["low", "medium", "high"] as const) expect(presetOf(GRAPHICS_PRESETS[p])).toBe(p);
    expect(presetOf({ ...GRAPHICS_PRESETS.medium, bloom: 0.3 })).toBe("custom");
  });

  it("low draws no effects; the others do", () => {
    expect(hasPostEffects(GRAPHICS_PRESETS.low)).toBe(false);
    expect(hasPostEffects(GRAPHICS_PRESETS.medium)).toBe(true);
    expect(hasPostEffects(GRAPHICS_PRESETS.high)).toBe(true);
  });

  it("cleans stored settings: missing ones filled, amounts clamped, bad values replaced", () => {
    const g = cleanGraphics({ ao: 3, bloom: -1, haze: Number.NaN, pixelRatio: 3 as never, life: "yes" as never });
    expect(g.ao).toBe(1);
    expect(g.bloom).toBe(0);
    expect(g.haze).toBe(DEFAULT_GRAPHICS.haze);
    expect(g.pixelRatio).toBe(DEFAULT_GRAPHICS.pixelRatio);
    expect(g.life).toBe(DEFAULT_GRAPHICS.life);
    expect(g.grade).toBe(DEFAULT_GRAPHICS.grade);
  });

  it("the old 3D detail setting carries over: low becomes the low preset", () => {
    const store = (value: unknown) => {
      (globalThis as { localStorage?: unknown }).localStorage = { getItem: () => JSON.stringify(value), setItem: () => {} };
    };
    store({ volume: 0.2, quality3d: "low" });
    const s = loadSettings();
    expect(s.graphics).toEqual(GRAPHICS_PRESETS.low);
    expect(s.volume).toBe(0.2);
    expect("quality3d" in s).toBe(false);
    store({ quality3d: "high" });
    expect(loadSettings().graphics).toEqual(DEFAULT_GRAPHICS);
  });
});
