import { describe, expect, it } from "vitest";
import { gameTime } from "../src/sim/clock";
import { config } from "../src/sim/config";
import { nextRandom } from "../src/sim/rng";
import { createInitialState } from "../src/sim/state";
import { step } from "../src/sim/step";

describe("clock", () => {
  it("starts on day 1 at the configured hour", () => {
    expect(gameTime(0, { ticksPerDay: 240, startHour: 6 })).toMatchObject({ day: 1, hour: 6, minute: 0 });
  });

  it("rolls over to day 2 after a full day of ticks", () => {
    expect(gameTime(240, { ticksPerDay: 240, startHour: 0 })).toMatchObject({ day: 2, hour: 0 });
    expect(gameTime(239, { ticksPerDay: 240, startHour: 0 })).toMatchObject({ day: 1, hour: 23, minute: 54 });
  });

  it("a day at 1x takes 2 real minutes", () => {
    expect(config.ticksPerDay / config.ticksPerSecondAt1x).toBe(120);
  });
});

describe("determinism", () => {
  it("same seed gives the same random sequence", () => {
    const a = createInitialState({ ...config, seed: 42 });
    const b = createInitialState({ ...config, seed: 42 });
    const seqA = Array.from({ length: 5 }, () => nextRandom(a));
    const seqB = Array.from({ length: 5 }, () => nextRandom(b));
    expect(seqA).toEqual(seqB);
    expect(new Set(seqA).size).toBe(5);
  });

  it("step advances one tick", () => {
    const s = createInitialState(config);
    for (let i = 0; i < 10; i++) step(s, config);
    expect(s.tick).toBe(10);
  });
});
