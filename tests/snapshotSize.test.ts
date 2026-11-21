import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { setAdults } from "../src/sim/people";
import { makeSnapshot } from "../src/sim/snapshot";
import { createInitialState } from "../src/sim/state";

// The snapshot goes to the views 20 times a second, so it carries totals,
// never people: its size mustn't grow with the population (#534, PLAN-PEOPLE.md).

function snapshotAt(people: number) {
  const s = createInitialState(config);
  setAdults(s, people, config);
  return makeSnapshot(s, config);
}

describe("snapshot size", () => {
  it("is the same at 50 people as at 10,000", () => {
    const small = snapshotAt(50);
    const large = snapshotAt(10_000);
    expect(small.population.count).toBe(50);
    expect(large.population.count).toBe(10_000);
    // Only the digits of the counts and the upcoming days may differ.
    const size = (x: unknown) => JSON.stringify(x).length;
    // The walkers' people are at most 60 ids, however many live here (#528).
    expect(small.walkers.length).toBe(50);
    expect(large.walkers.length).toBe(60);
    const bare = (x: typeof small) => ({ ...x, walkers: [] });
    expect(Math.abs(size(bare(large)) - size(bare(small)))).toBeLessThan(64);
    expect(Math.abs(size(large.population) - size(small.population))).toBeLessThan(16);
  });

  it("leaves the cohorts out", () => {
    const pop = snapshotAt(50).population as unknown as Record<string, unknown>;
    expect(pop.cohorts).toBeUndefined();
    expect(snapshotAt(10_000).upcoming.length).toBeLessThanOrEqual(5);
  });
});
