import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { PLAN, run } from "./bot";
import { construction } from "../src/sim/construction";
import { storage } from "../src/sim/storage";

// Plays the first month with the scripted bot and checks the milestones.
// Run with PLAYTEST=1 (npm run playtest) to print a daily table.

// Vitest runs in Node; the project has no Node types, so reach env via globalThis.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

// Played with construction time and storage limits, as in the game (each test file has its own copy of the setting).
construction.instant = false;
storage.unlimited = false;

describe("first month playthrough", () => {
  const { state, log, builtAt } = run(30);
  if (env.PLAYTEST) {
    console.table(log);
    console.log("built on day:", Object.fromEntries(Object.entries(builtAt).map(([i, d]) => [`${i} ${PLAN[+i]!.room}`, d.toFixed(1)])));
    console.log("messages:", state.messages.map((m) => `d${(m.tick / config.ticksPerDay).toFixed(1)} ${m.text}`));
  }

  const at = (room: string) => builtAt[PLAN.findIndex((p) => p.room === room)]!;

  it("builds the critical set on day 1", () => {
    expect(at("life_support")).toBeLessThan(1);
  });

  it("finishes tier 2 within about two weeks", () => {
    expect(at("admin_office")).toBeLessThan(15);
  });

  it("reaches about 50 colonists within the month", () => {
    expect(state.population.count).toBeGreaterThanOrEqual(45);
  });

  it("keeps everyone reasonably healthy", () => {
    // Digging dilutes the air (T-026); the electrolyzer (T-028) remakes it far faster than one life support did,
    // so health holds up again (T-031). Eased to 35 in between.
    expect(Math.min(...log.map((d) => d.health))).toBeGreaterThan(60);
  });

  it("closes the water loop: two recyclers, and Earth brings little water in the last ten days", () => {
    const last = log.slice(-10);
    const used = last.reduce((a, d) => a + d.waterUsed, 0);
    const fromEarth = last.reduce((a, d) => a + d.earthWater, 0);
    // Water split into oxygen for the space the bot digs is the air's deliberate leak (T-026):
    // Earth may cover that, but little of the rest (the bot digs all month: that's growth, not a leak).
    const intoAir = last.reduce((a, d) => a + d.airWater, 0);
    expect(fromEarth).toBeLessThan(intoAir + (used - intoAir) * 0.1);
  });

  it("keeps morale from collapsing", () => {
    expect(Math.min(...log.slice(5).map((d) => d.happy))).toBeGreaterThan(35);
  });
});

// A new game's first hole starts from the full landing kit (T-164): air, water tanks and power
// already built, so the bot skips those and the hole should do at least as well.
describe("first month playthrough, from the full landing kit", () => {
  const { state, log, builtAt, plan } = run(30, "full");
  const at = (room: string) => builtAt[plan.findIndex((p) => p.room === room)]!;

  it("starts with the kit's air, water and power rooms working", () => {
    const first = log[0]!;
    expect(first.o2).toBeGreaterThan(15);
    expect(plan.some((p) => p.room === "life_support" && p.at.kind === "ring" && p.at.floor === 1)).toBe(false);
  });

  it("finishes tier 2 within about two weeks", () => {
    expect(at("admin_office")).toBeLessThan(15);
  });

  it("reaches about 50 colonists within the month", () => {
    expect(state.population.count).toBeGreaterThanOrEqual(45);
  });

  it("keeps everyone reasonably healthy", () => {
    expect(Math.min(...log.map((d) => d.health))).toBeGreaterThan(60);
  });
});
