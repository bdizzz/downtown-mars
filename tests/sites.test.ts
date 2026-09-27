import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { depositsAt } from "../src/sim/map";
import { network } from "../src/sim/network";
import { createWorld, totalPopulation } from "../src/sim/world";
import { stepWorld } from "../src/sim/worldstep";
import { setAdults } from "../src/sim/people";

describe("the first site", () => {
  it("sits on ice with ore or silica, for any seed", () => {
    for (const seed of [1, 2, 3, 42, 1234, 99999]) {
      const w = createWorld(config, seed);
      const hole = w.holes[0]!;
      expect(hole.site).not.toBeNull();
      const under = depositsAt(w.map, hole.site!);
      expect(under, `seed ${seed}`).toContain("ice");
      expect(under.includes("ore") || under.includes("silica"), `seed ${seed}`).toBe(true);
      expect(hole.deposits).toEqual(under);
    }
  });

  it("is on the northern lowlands when the map has ice there", () => {
    const w = createWorld(config, 42);
    expect(w.holes[0]!.site!.lat).toBeGreaterThanOrEqual(network.firstSite.minLat);
    expect(w.holes[0]!.site!.lat).toBeLessThanOrEqual(network.firstSite.maxLat);
  });
});

describe("regional digging", () => {
  it("brings up ore or silica, and water from ice, with the rock", () => {
    const w = createWorld(config, 42);
    const hole = w.holes[0]!;
    const before = { ...hole.resources };
    for (let i = 0; i < config.digging.ticksForFirstFloor; i++) stepWorld(w, config);
    const got = (id: string) => (hole.resources[id] ?? 0) - (before[id] ?? 0);
    const mineral = hole.deposits.includes("ore") ? "ore" : "silica";
    // 47 slots × 0.4 per slot for one floor.
    expect(got(mineral)).toBeCloseTo(47 * 0.4, 0);
    expect(hole.ledger.days.concat([hole.ledger.current]).some((d) => (d.water?.in.Digging ?? 0) > 0)).toBe(true);
  });
});

describe("the map", () => {
  it("opens once the network reaches 50 colonists, with a message", () => {
    const w = createWorld(config, 42);
    expect(w.mapUnlocked).toBe(false);
    setAdults(w.holes[0]!, network.mapUnlockPopulation, config);
    expect(totalPopulation(w)).toBe(50);
    stepWorld(w, config);
    expect(w.mapUnlocked).toBe(true);
    expect(w.holes[0]!.messages.some((m) => /map is open/.test(m.text))).toBe(true);
  });
});
