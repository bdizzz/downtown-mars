import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { createInitialState } from "../src/sim/state";
import { step } from "../src/sim/step";
import { seriesIds, VITALS } from "../src/sim/history";
import { deserialize, serialize } from "../src/sim/save";
import { createWorld } from "../src/sim/world";
import { stepWorld } from "../src/sim/worldstep";
import { demolishRoom } from "../src/sim/placement";
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

describe("history after a home goes (#612)", () => {
  it("keeps sampling once a lived-in home is demolished", () => {
    const r = deserialize(readFileSync("public/dev-save-early.json", "utf8"));
    if (!r.ok) throw new Error(r.reason);
    const s = r.world.holes[0]!;
    for (let i = 0; i < tpd; i++) stepWorld(r.world, config);
    const home = s.happiness.pools.find((p) => p.residents > 0 && demolishRoom(s.layout, p.roomId).ok);
    expect(home).toBeDefined();
    for (let i = 0; i < tpd; i++) stepWorld(r.world, config);
    expect(s.history!.last).toBe(s.tick);
    expect(s.happiness.pools.some((p) => p.roomId === home!.roomId)).toBe(false);
  });
});

describe("a gap in the history (#612)", () => {
  it("bridges missed days and starts the hours afresh, so the charts' days stay in place", () => {
    const s = run(3);
    s.tick += 10 * tpd + 30; // ten days and a bit with no samples, as a save stuck before the fix
    for (let i = 0; i < 2 * tpd; i++) step(s, config);
    const h = s.history!;
    const days = Math.floor(s.tick / tpd);
    expect(h.dailyLast).toBe(days * tpd);
    // One value a day, for every day, so counting back from the newest lands each on its own day.
    for (const id of seriesIds()) expect(h.daily[id], id).toHaveLength(days);
    for (const id of seriesIds()) expect(h.hourly[id]!.length, id).toBeLessThanOrEqual(2 * perHour);
    expect(h.last).toBe(s.tick);
  });
});
