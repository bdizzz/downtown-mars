import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { PLAN, run } from "./bot";

// Plays the first month with the scripted bot and checks the milestones.
// Run with PLAYTEST=1 (npm run playtest) to print a daily table.

// Vitest runs in Node; the project has no Node types, so reach env via globalThis.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

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
    expect(Math.min(...log.map((d) => d.health))).toBeGreaterThan(60);
  });

  it("keeps morale from collapsing", () => {
    expect(Math.min(...log.slice(5).map((d) => d.happy))).toBeGreaterThan(35);
  });
});
