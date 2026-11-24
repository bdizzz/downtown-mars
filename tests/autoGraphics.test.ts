import { describe, expect, it } from "vitest";
import { AUTO, cleanAutoMemory, decideAutoGraphics, displayCap, type AutoInput } from "../src/view/autoGraphics";
import settings from "../data/settings.json";

const steady = (n: number, fps: number) => Array.from({ length: n }, () => fps);
const base = (history: number[], more: Partial<AutoInput> = {}): AutoInput => ({ history, fresh: history.length, preset: "medium", onTitle: false, noRaise: false, watching: null, ...more });

describe("automatic graphics (#591)", () => {
  it("drops straight to Low on a title that stays slow", () => {
    const h = steady(AUTO.titleSeconds, settings.fps.low - 8);
    expect(decideAutoGraphics(base(h, { preset: "high", onTitle: true }))).toEqual({ kind: "lower", to: "low" });
    // Not in play, not with too few readings, not if one reading got higher, not on Low already.
    expect(decideAutoGraphics(base(h, { preset: "high" }))).toBeNull();
    expect(decideAutoGraphics(base(h.slice(1), { preset: "high", onTitle: true }))).toBeNull();
    expect(decideAutoGraphics(base([...h.slice(1), 45], { preset: "high", onTitle: true }))).toBeNull();
    expect(decideAutoGraphics(base(h, { preset: "low", onTitle: true }))).toBeNull();
  });

  it("only counts readings since the graphics last changed", () => {
    const h = [...steady(30, 20), ...steady(2, 60)];
    expect(decideAutoGraphics(base(h, { preset: "high", onTitle: true, fresh: 2 }))).toBeNull();
  });

  it("steps up one preset when steady at the display's cap", () => {
    expect(decideAutoGraphics(base(steady(AUTO.raiseSeconds, 60), { preset: "low" }))).toEqual({ kind: "raise", to: "medium" });
    expect(decideAutoGraphics(base(steady(AUTO.raiseSeconds, 120)))).toEqual({ kind: "raise", to: "high" });
    // A 120 Hz screen at 60 isn't at its cap.
    expect(decideAutoGraphics(base([120, ...steady(AUTO.raiseSeconds, 60)]))).toBeNull();
    // Never past High, nor when raising is off, nor on custom settings, nor on a slow screen.
    expect(decideAutoGraphics(base(steady(AUTO.raiseSeconds, 60), { preset: "high" }))).toBeNull();
    expect(decideAutoGraphics(base(steady(AUTO.raiseSeconds, 60), { noRaise: true }))).toBeNull();
    expect(decideAutoGraphics(base(steady(AUTO.raiseSeconds, 60), { preset: "custom" }))).toBeNull();
    expect(decideAutoGraphics(base(steady(AUTO.raiseSeconds, 30)))).toBeNull();
  });

  it("not when it dips now and then", () => {
    const h = steady(AUTO.raiseSeconds, 60);
    for (let i = 0; i < 4; i++) h[i * 5] = 40;
    expect(decideAutoGraphics(base(h))).toBeNull();
  });

  it("steps back when the raise turns out slow, and holds while it's fine", () => {
    const before = steady(30, 60);
    const slow = [...before, ...steady(settings.fps.seconds, 38)];
    expect(decideAutoGraphics(base(slow, { preset: "high", fresh: settings.fps.seconds, watching: "medium" }))).toEqual({ kind: "back", to: "medium" });
    const fine = [...before, ...steady(settings.fps.seconds, 57)];
    expect(decideAutoGraphics(base(fine, { preset: "high", fresh: settings.fps.seconds, watching: "medium" }))).toBeNull();
    // While watching, no further raise.
    expect(decideAutoGraphics(base(steady(AUTO.raiseSeconds, 60), { watching: "low" }))).toBeNull();
  });

  it("reads the cap and the memory", () => {
    expect(displayCap([30, 61, 59])).toBe(61);
    expect(cleanAutoMemory(undefined)).toEqual({ set: null, noRaise: false });
    expect(cleanAutoMemory({ set: "ultra", noRaise: "yes" })).toEqual({ set: null, noRaise: false });
    expect(cleanAutoMemory({ set: "medium", noRaise: true })).toEqual({ set: "medium", noRaise: true });
  });
});
