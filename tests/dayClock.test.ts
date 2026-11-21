import { describe, expect, it } from "vitest";
import { DayClock, smoothDayFraction } from "../src/view/dayClock";

const clock = () => new DayClock({ tickMs: 1000, maxTickMs: 1250, snapTicks: 10 });

describe("the view's day clock (#567)", () => {
  it("snaps to the first tick, then glides to each new one over a tick's time", () => {
    const c = clock();
    c.keyframe(100, 0);
    expect(c.at(0)).toBe(100);
    c.keyframe(101, 1000);
    expect(c.at(1000)).toBe(100);
    expect(c.at(1500)).toBeCloseTo(100.5);
    expect(c.at(2000)).toBe(101);
    expect(c.moving(1500)).toBe(true);
  });

  it("never runs past the latest tick: paused, it holds there", () => {
    const c = clock();
    c.keyframe(100, 0);
    c.keyframe(101, 1000);
    expect(c.at(60_000)).toBe(101);
    expect(c.moving(60_000)).toBe(false);
  });

  it("carries on from where it is when a tick comes early, without stepping back", () => {
    const c = clock();
    c.keyframe(100, 0);
    c.keyframe(101, 1000);
    const before = c.at(1400);
    c.keyframe(102, 1400);
    expect(c.at(1400)).toBeCloseTo(before);
    expect(c.at(1500)).toBeGreaterThan(before);
  });

  it("learns a faster pace", () => {
    const c = clock();
    c.keyframe(0, 0);
    for (let t = 1; t <= 12; t++) c.keyframe(t, t * 250);
    // At 4×, about a quarter second a tick: within a tick of the sim.
    expect(c.latest - c.at(12 * 250 + 1)).toBeLessThan(1.2);
    expect(c.at(12 * 250 + 400)).toBe(12);
  });

  it("doesn't count a pause towards the pace", () => {
    const c = clock();
    c.keyframe(0, 0);
    c.keyframe(1, 1000);
    c.keyframe(2, 30_000); // after a long pause
    expect(c.at(30_500)).toBeCloseTo(1.5);
  });

  it("snaps on a jump, forward or back", () => {
    const c = clock();
    c.keyframe(100, 0);
    c.keyframe(500, 100);
    expect(c.at(100)).toBe(500);
    c.keyframe(20, 200);
    expect(c.at(200)).toBe(20);
    c.reset();
    c.keyframe(21, 300);
    expect(c.at(300)).toBe(21);
  });

  it("winds the day fraction back across midnight", () => {
    expect(smoothDayFraction(0.5, 24, 240)).toBeCloseTo(0.4);
    expect(smoothDayFraction(0.001, 1, 240)).toBeCloseTo(1 + 0.001 - 1 / 240);
  });
});
