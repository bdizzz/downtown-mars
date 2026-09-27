import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { runNetwork } from "./netbot";

// Ninety minutes (90 game days) with the two-hole bot, which builds what's
// short once its opening plans are done, against the same bot staying solo.
// Checks the people systems: births carry growth, children grow up, the
// first elders retire and get care, and the network outgrows one hole.

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
    expect(born).toBeGreaterThanOrEqual(20);
    const children = net.world.holes.reduce((n, h) => n + h.population.cohorts.filter((c) => c.stage === "child").reduce((k, c) => k + c.count, 0), 0);
    expect(children).toBeLessThan(born); // the earliest have grown up
  });

  it("sees its first elders retire, and schools its children", () => {
    const elders = home!.population.cohorts.filter((c) => c.stage === "elder").reduce((n, c) => n + c.count, 0);
    expect(elders).toBeGreaterThan(0);
    expect(home!.unlocks).toContain("elders");
    expect(home!.layout.rooms.some((r) => r.type === "school")).toBe(true);
  });

  it("outgrows a single hole by a wide margin", () => {
    expect(net.log.at(-1)!.total).toBeGreaterThan(solo.log.at(-1)!.total * 1.4);
    expect(at(80).total).toBeGreaterThan(180);
  });

  it("keeps the child hole healthy", () => {
    expect(child!.population.health).toBeGreaterThan(60);
    expect(child!.population.count).toBeGreaterThan(50);
  });
});
