import { beforeEach, describe, expect, it } from "vitest";
import { cleanGraphics, DEFAULT_GRAPHICS, drawsDetailedFurniture, GRAPHICS_PRESETS, lighterFurniture, lowerPreset, presetOf } from "../src/view/graphics";
import { FPS_HISTORY, fpsHistory, isLowFps, LOW_FPS, onFps, recentFps, recordFrame, resetFps } from "../src/view/fps";

/** Feed `seconds` of frames at `fps`, starting at `from` ms; returns the time after. */
function feed(from: number, seconds: number, fps: number): number {
  let t = from;
  const end = from + seconds * 1000;
  while (t < end) {
    recordFrame(t);
    t += 1000 / fps;
  }
  return t;
}

describe("frame rate history (#391)", () => {
  beforeEach(() => resetFps());

  it("makes one reading a second", () => {
    feed(0, 5.5, 60);
    const h = fpsHistory();
    expect(h.length).toBe(5);
    for (const v of h) expect(v).toBeGreaterThanOrEqual(58);
  });

  it("keeps only the last couple of minutes", () => {
    feed(0, FPS_HISTORY + 30, 60);
    expect(fpsHistory().length).toBe(FPS_HISTORY);
  });

  it("drops a second where the tab was hidden or stalled", () => {
    let t = feed(0, 3.5, 60);
    t += 20_000; // hidden: no frames for twenty seconds
    feed(t, 3.5, 60);
    for (const v of fpsHistory()) expect(v).toBeGreaterThan(50);
  });

  it("says nothing until it has enough to go on", () => {
    feed(0, 5.5, 10);
    expect(recentFps()).toBeNull();
    expect(isLowFps()).toBe(false);
  });

  it("calls it low when the middle of the last stretch is under the limit", () => {
    feed(0, LOW_FPS.seconds + 2, 15);
    expect(isLowFps()).toBe(true);
  });

  it("does not call a fine frame rate low, or one brief dip", () => {
    const t = feed(0, 30, 60);
    expect(isLowFps()).toBe(false);
    feed(t, 3, 10); // a few slow seconds in a stretch of good ones
    expect(isLowFps()).toBe(false);
  });

  it("tells listeners when a reading comes in", () => {
    let n = 0;
    const off = onFps(() => n++);
    feed(0, 3.5, 60);
    expect(n).toBe(3);
    off();
    feed(5000, 3.5, 60);
    expect(n).toBe(3);
  });
});

describe("furniture detail setting (#391)", () => {
  it("defaults to detailed everywhere", () => {
    expect(DEFAULT_GRAPHICS.furniture).toBe("everywhere");
    expect(cleanGraphics(undefined).furniture).toBe("everywhere");
  });

  it("keeps a saved choice, and mends a bad one", () => {
    expect(cleanGraphics({ furniture: "basic" }).furniture).toBe("basic");
    expect(cleanGraphics({ furniture: "firstPerson" }).furniture).toBe("firstPerson");
    expect(cleanGraphics({ furniture: "ultra" as never }).furniture).toBe("everywhere");
  });

  it("draws the models where the choice says", () => {
    expect(drawsDetailedFurniture("basic", true)).toBe(false);
    expect(drawsDetailedFurniture("basic", false)).toBe(false);
    expect(drawsDetailedFurniture("firstPerson", true)).toBe(true);
    expect(drawsDetailedFurniture("firstPerson", false)).toBe(false);
    expect(drawsDetailedFurniture("everywhere", true)).toBe(true);
    expect(drawsDetailedFurniture("everywhere", false)).toBe(true);
  });

  it("steps down from everywhere to on foot to simple shapes", () => {
    expect(lighterFurniture("everywhere")).toBe("firstPerson");
    expect(lighterFurniture("firstPerson")).toBe("basic");
    expect(lighterFurniture("basic")).toBeNull();
  });

  it("is not part of the graphics presets", () => {
    for (const f of ["basic", "firstPerson", "everywhere"] as const) {
      expect(presetOf(cleanGraphics({ ...GRAPHICS_PRESETS.high, furniture: f }))).toBe("high");
      expect(presetOf(cleanGraphics({ ...GRAPHICS_PRESETS.low, furniture: f }))).toBe("low");
    }
  });

  it("steps the graphics preset down", () => {
    expect(lowerPreset("high")).toBe("medium");
    expect(lowerPreset("custom")).toBe("medium");
    expect(lowerPreset("medium")).toBe("low");
    expect(lowerPreset("low")).toBeNull();
  });
});
