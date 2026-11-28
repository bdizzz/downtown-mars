import { afterAll, describe, expect, it } from "vitest";
import { construction } from "../src/sim/construction";
import { storage } from "../src/sim/storage";
import { landingKitFor, LEVELS, setDifficulty, type Level } from "../src/sim/difficulty";
import { run } from "./bot";

// A smoke playthrough per difficulty (F-014, T-125): the scripted bot plays the first month at each
// level from its landing kit (hard the bare one) and the levels should come out in order: easy
// kinder than normal, hard tougher, none of them collapsing. Run with PLAYTEST=1 to print a summary
// per level (what the tuning in data/difficulty.json was judged by).

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

construction.instant = false;
storage.unlimited = false;

const DAYS = 30;

function play(level: Level) {
  setDifficulty(level);
  const { state, log, builtAt, plan } = run(DAYS, landingKitFor(level));
  const tail = log.slice(5);
  return {
    level,
    pop: state.population.count,
    built: Object.keys(builtAt).length,
    plan: plan.length,
    minHealth: Math.min(...log.map((d) => d.health)),
    minHappy: Math.min(...tail.map((d) => d.happy)),
    endHappy: log.at(-1)!.happy,
    // Food on hand until the first harvests are in (the bot's later shortfalls are its plan's, on every level).
    minLarder: Math.min(...log.slice(0, Math.max(1, log.findIndex((d) => d.harvested > 0) + 2)).map((d) => d.larder)),
    floors: state.layout.hole.floors,
    metal: Math.round(state.resources.metal ?? 0),
  };
}

const results = Object.fromEntries(LEVELS.map((l) => [l, play(l)])) as Record<Level, ReturnType<typeof play>>;
setDifficulty("normal");
afterAll(() => setDifficulty("normal"));
if (env.PLAYTEST) console.table(Object.values(results));

describe("difficulty playthroughs (T-125)", () => {
  for (const level of LEVELS) {
    it(`${level}: the first month holds together`, () => {
      const r = results[level];
      // Hard bites (health and morale dip mid-month while building lags) but recovers by the month's end.
      expect(r.pop, "population").toBeGreaterThanOrEqual(40);
      expect(r.minHealth, "health").toBeGreaterThan(25);
      expect(r.minHappy, "morale").toBeGreaterThan(10);
      expect(r.endHappy, "morale at the month's end").toBeGreaterThan(30);
      expect(r.minLarder, "food before the first harvests").toBeGreaterThan(0);
    });
  }

  it("easy grows at least as well as normal, and hard no better", () => {
    expect(results.easy.pop).toBeGreaterThanOrEqual(results.normal.pop);
    expect(results.hard.pop).toBeLessThanOrEqual(results.normal.pop);
  });

  it("easy builds its plan at least as fast as normal, and hard no faster", () => {
    expect(results.easy.built).toBeGreaterThanOrEqual(results.normal.built);
    expect(results.hard.built).toBeLessThanOrEqual(results.normal.built);
  });

  it("health and morale run highest on easy and lowest on hard", () => {
    // Both stay near full health once farms feed the colony (#616), so easy may dip a point or two below normal.
    expect(results.easy.minHealth).toBeGreaterThanOrEqual(results.normal.minHealth - 3);
    expect(results.hard.minHealth).toBeLessThan(results.normal.minHealth);
    expect(results.easy.endHappy).toBeGreaterThan(results.normal.endHappy);
    // Hard's month is the lowest; by its end it has recovered to about normal's (the last day's value is noisy).
    expect(results.hard.minHappy).toBeLessThan(results.normal.minHappy);
    expect(results.hard.endHappy).toBeLessThanOrEqual(results.normal.endHappy);
  });
});
