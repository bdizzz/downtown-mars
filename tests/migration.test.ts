import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { destination, stepArrivals, stepMigration } from "../src/sim/migration";
import { stageCounts } from "../src/sim/people";
import { twoHoles } from "./worlds";

/** Bradbury miserable, Gale content. */
function unhappyHome() {
  const w = twoHoles();
  const [home, gale] = w.holes;
  home!.happiness.average = 30;
  gale!.happiness.average = 60;
  return { w, home: home!, gale: gale! };
}

describe("migration", () => {
  it("colonists leave an unhappy hole for a clearly happier one with free beds", () => {
    const { w, home, gale } = unhappyHome();
    expect(destination(w, home)).toBe(gale);
    const before = home.population.count;
    stepMigration(w, config);
    expect(w.migrations).toHaveLength(1);
    const n = before - home.population.count;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(3);
    expect(home.messages.at(-1)?.text).toMatch(/left for Gale/);
    // They arrive after the trip, as adults.
    const galeBefore = gale.population.count;
    w.tick = w.migrations[0]!.arriveTick;
    stepArrivals(w, config);
    expect(gale.population.count).toBe(galeBefore + n);
    expect(stageCounts(gale).adult).toBe(gale.population.count);
    expect(gale.messages.at(-1)?.text).toMatch(/arrived from Bradbury/);
  });

  it("nobody leaves a hole that's happy enough, or for one that isn't clearly better", () => {
    const { w, home, gale } = unhappyHome();
    home.happiness.average = 50;
    expect(destination(w, home)).toBeNull();
    home.happiness.average = 55;
    gale.happiness.average = 60;
    expect(destination(w, home)).toBeNull();
  });

  it("closed borders turn them away", () => {
    const { w, home, gale } = unhappyHome();
    gale.ordinances.push("closed_borders");
    expect(destination(w, home)).toBeNull();
  });

  it("doesn't overfill the destination, counting people already on the road", () => {
    const { w, home, gale } = unhappyHome();
    for (let d = 0; d < 10; d++) stepMigration(w, config);
    const onRoad = w.migrations.reduce((n, m) => n + m.people.reduce((k, c) => k + c.count, 0), 0);
    expect(gale.population.count + onRoad).toBeLessThanOrEqual(20); // the pod's beds
    expect(home.population.count).toBeGreaterThan(0);
  });

  it("migrants bring some of their culture", () => {
    const { w, home, gale } = unhappyHome();
    home.culture.order = -1;
    gale.culture.order = 1;
    stepMigration(w, config);
    w.tick = w.migrations[0]!.arriveTick;
    stepArrivals(w, config);
    expect(gale.culture.order).toBeLessThan(1);
  });
});
