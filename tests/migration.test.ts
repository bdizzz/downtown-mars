import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { destination, stepArrivals, stepMigration } from "../src/sim/migration";
import { addPeopleAt, stageCounts } from "../src/sim/people";
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
    const onRoad = w.migrations.reduce((n, m) => n + m.people.length, 0);
    expect(gale.population.count + onRoad).toBeLessThanOrEqual(20); // the pod's beds
    expect(home.population.count).toBeGreaterThan(0);
  });

  it("the unhappiest leave first, with their whole household, and arrive as themselves", () => {
    const { w, home, gale } = unhappyHome();
    const c = home.colonists!;
    // Make one household the unhappiest: a couple with a child.
    const [a, b] = [0, 1];
    c.partner[a] = c.id[b]!;
    c.partner[b] = c.id[a]!;
    c.household[a] = c.household[b] = c.id[a]!;
    const [kid] = addPeopleAt(home, "child", 1, config, 1e9);
    c.household[c.id.indexOf(kid!)] = c.id[a]!;
    c.happiness[a] = 0;
    const family = [c.id[a]!, c.id[b]!, kid!];
    stepMigration(w, config);
    const leaving = w.migrations.flatMap((m) => m.people.map((p) => p.id));
    for (const id of family) {
      expect(leaving).toContain(id);
      expect(home.colonists!.id).not.toContain(id);
    }
    w.tick = Math.max(...w.migrations.map((m) => m.arriveTick));
    stepArrivals(w, config);
    for (const id of family) expect(gale.colonists!.id).toContain(id);
    expect(gale.population.count).toBe(gale.colonists!.id.length);
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
