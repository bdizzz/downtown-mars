import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { applyCommand } from "../src/sim/commands";
import { createInitialState, type SimState } from "../src/sim/state";
import { step } from "../src/sim/step";
import { afterglow, afterglowDaysLeft, updateHappiness } from "../src/sim/happiness";
import { setAdults } from "../src/sim/people";
import type { Location } from "../src/sim/placement";

// The thrill of arrival: extra happiness at a hole's founding that eases away,
// and maintenance crews that stand by (using no parts) when there's nothing to fix.

const tpd = config.ticksPerDay;
const a = config.happiness.afterglow;
const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });
const at = (s: SimState, day: number) => {
  s.tick = s.foundedTick + Math.round(day * tpd);
  return afterglow(s, config);
};

describe("afterglow", () => {
  it("starts full, eases away and is gone after its days", () => {
    const s = createInitialState(config);
    expect(at(s, 0)).toBeCloseTo(a.points, 5);
    expect(at(s, a.days / 2)).toBeCloseTo(a.points / 2, 1);
    expect(at(s, 1)).toBeGreaterThan(at(s, 2));
    expect(at(s, 2)).toBeGreaterThan(a.points * 0.9); // slow at first
    expect(at(s, a.days)).toBe(0);
    expect(at(s, a.days * 3)).toBe(0);
    expect(afterglowDaysLeft(s, config)).toBe(0);
  });

  it("counts from a hole's own founding", () => {
    const s = createInitialState(config);
    s.foundedTick = 30 * tpd;
    s.tick = 30 * tpd;
    expect(afterglow(s, config)).toBeCloseTo(a.points, 5);
    expect(afterglowDaysLeft(s, config)).toBeCloseTo(a.days, 5);
  });

  it("lifts every home's happiness by the same points, while it lasts", () => {
    const s = createInitialState(config);
    s.tick = 0;
    updateHappiness(s, config, true);
    const early = s.happiness.average;
    s.tick = a.days * tpd;
    updateHappiness(s, config, true);
    expect(early - s.happiness.average).toBeCloseTo(a.points, 0);
    expect(s.happiness.afterglow).toBe(0);
  });

  it("says when it's half gone, and when it's gone", () => {
    const s = createInitialState(config);
    s.drill.active = false;
    for (let i = 0; i < a.days * tpd; i++) step(s, config);
    const texts = s.messages.map((m) => m.text).join("\n");
    expect(texts).toMatch(/thrill of landing is wearing off/);
    expect(texts).toMatch(/afterglow has faded/);
  });
});

describe("maintenance on standby", () => {
  it("uses no machinery with nothing to repair, and gets back to work when something wears", () => {
    const s = createInitialState(config);
    s.drill.active = false;
    Object.assign(s.resources, { rock: 2000, metal: 2000, brick: 2000, machinery: 50 });
    setAdults(s, 20, config);
    const m = applyCommand(s, { type: "build", room: "maintenance", at: ring(1, 1, 5, 2) }).roomId!;
    step(s, config);
    const before = s.resources.machinery!;
    for (let i = 0; i < tpd / 2; i++) step(s, config);
    expect(s.roomStatus[m]!.limit).toBe("standby");
    expect(s.resources.machinery!).toBeCloseTo(before, 5);
    const battery = s.layout.rooms.find((r) => r.type === "battery_bank")!;
    battery.condition = 0.3;
    for (let i = 0; i < 20; i++) step(s, config);
    expect(s.roomStatus[m]!.limit).toBeUndefined();
    expect(s.resources.machinery!).toBeLessThan(before);
  });
});
