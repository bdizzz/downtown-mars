import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { createInitialState } from "../src/sim/state";
import { step } from "../src/sim/step";
import { seriesIds, VITALS } from "../src/sim/history";
import { deserialize, serialize } from "../src/sim/save";
import { createWorld } from "../src/sim/world";
import { stepWorld } from "../src/sim/worldstep";
import { niceScale, perDay, points } from "../src/ui/trends";

// Resources and vital signs over time, for the charts.

const tpd = config.ticksPerDay;
const perHour = tpd / config.history.everyTicks;

function run(days: number) {
  const s = createInitialState(config);
  s.drill.active = false;
  for (let i = 0; i < days * tpd; i++) step(s, config);
  return s;
}

describe("history", () => {
  it("samples every series once an hour, the same length each", () => {
    const s = run(1);
    const h = s.history!;
    for (const id of seriesIds()) expect(h.hourly[id], id).toHaveLength(perHour);
    expect(h.last).toBe(s.tick);
    expect(h.hourly.population!.at(-1)).toBe(s.population.count);
    expect(h.hourly.happiness!.at(-1)).toBeCloseTo(s.happiness.average, 1);
    expect(h.hourly.water!.at(-1)).toBeCloseTo(s.resources.water!, 1);
    for (const v of VITALS) expect(h.hourly[v]).toBeDefined();
  });

  it("keeps the last few days hour by hour, and every day's average", () => {
    const days = config.history.recentDays + 3;
    const s = run(days);
    const h = s.history!;
    expect(h.hourly.population).toHaveLength(config.history.recentDays * perHour);
    expect(h.daily.population).toHaveLength(days);
    expect(h.dailyLast).toBe(s.tick);
    expect(h.daily.happiness![0]).toBeGreaterThan(h.daily.happiness!.at(-1)! - 100);
  });

  it("goes into saves and comes back", () => {
    const w = createWorld(config, config.seed);
    for (let i = 0; i < 2 * tpd; i++) stepWorld(w, config);
    const r = deserialize(serialize(w));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.world.holes[0]!.history!.daily.population).toEqual(w.holes[0]!.history!.daily.population);
  });
});

describe("trend data", () => {
  const s = run(4);
  const h = s.history!;

  it("gives the last two days hour by hour, and ticks ending now", () => {
    const p = points(h, "happiness", "2d", tpd);
    expect(p.values).toHaveLength(2 * perHour);
    expect(p.ticks.at(-1)).toBe(h.last);
    expect(p.ticks[1]! - p.ticks[0]!).toBe(h.every);
  });

  it("gives the whole game a day at a time, ending with the latest sample", () => {
    const p = points(h, "happiness", "all", tpd);
    expect(p.values).toHaveLength(4);
    expect(p.ticks.at(-1)).toBe(h.last);
  });

  it("turns amounts into change per day", () => {
    const r = perDay({ values: [0, 10, 20, 30], ticks: [0, tpd / 2, tpd, (3 * tpd) / 2] }, tpd);
    expect(r.values).toEqual([20, 20, 20, 20]);
  });

  it("picks tidy axis steps", () => {
    expect(niceScale(3, 97)).toEqual({ lo: 0, hi: 100, step: 25 });
    const flat = niceScale(5, 5);
    expect(flat.lo).toBeLessThan(5);
    expect(flat.hi).toBeGreaterThan(5);
  });
});
