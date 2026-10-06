import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { runNetwork } from "./netbot";
import { construction } from "../src/sim/construction";
import { storage } from "../src/sim/storage";

// Ninety minutes (90 game days) with the two-hole bot, which builds what's
// short once its opening plans are done, against the same bot staying solo.
// Checks the people systems: births carry growth, children grow up, the
// first elders retire and get care, and the network outgrows one hole.

// Played with construction time and storage limits, as in the game (each test file has its own copy of the setting).
construction.instant = false;
storage.unlimited = false;

describe("ninety minutes of people", () => {
  const net = runNetwork(90);
  const solo = runNetwork(90, config.seed, false);
  const [home, child] = net.world.holes;
  const at = (day: number) => net.log.find((d) => d.day === day)!;

  it("has its first birth within the first twenty minutes", () => {
    expect(net.log.find((d) => d.born > 0)!.day).toBeLessThanOrEqual(20);
  });

  it("keeps having children, and they grow up into workers", () => {
    const born = net.log.at(-1)!.born;
    // Windows are paid for since milestone 13, this seed's run gets fewer
    // (over four seeds the totals are much as before, 11–28 born). Was 15, then 10 until the
    // air became a mix (T-026): health dips while the holes dig, and births wait on it.
    expect(born).toBeGreaterThanOrEqual(8);
    const children = net.world.holes.reduce((n, h) => n + h.population.cohorts.filter((c) => c.stage === "child").reduce((k, c) => k + c.count, 0), 0);
    expect(children).toBeLessThan(born); // the earliest have grown up
  });

  it("sees its first elders retire, and schools its children", () => {
    const elders = home!.population.cohorts.filter((c) => c.stage === "elder").reduce((n, c) => n + c.count, 0);
    expect(elders).toBeGreaterThan(0);
    expect(home!.unlocks).toContain("elders");
    // Somewhere in the network (with drill finds since milestone 14, the home hole's children may be few enough to go without).
    expect(net.world.holes.some((h) => h.layout.rooms.some((r) => r.type === "school"))).toBe(true);
  });

  it("outgrows a single hole by a wide margin", () => {
    expect(net.log.at(-1)!.total).toBeGreaterThan(solo.log.at(-1)!.total * 1.3);
    // Gallery tubes on every new floor (milestone 11) cost rock and crew time: a little slower than before (was 160).
    // Windows paid for (milestone 13): this seed's run slows again; other seeds reach 139–147 (was 150).
    // Drill finds (milestone 14): the bot taps every one it's offered, and over six seeds day 80 lands at 115–159 (was 130).
    expect(at(80).total).toBeGreaterThan(110);
  });

  it("keeps the child hole healthy", () => {
    expect(child!.population.health).toBeGreaterThan(50);
    expect(child!.population.count).toBeGreaterThan(50);
  });
});
