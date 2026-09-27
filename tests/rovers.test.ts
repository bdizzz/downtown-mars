import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { loadFactor } from "../src/sim/culture";
import { travelTicks } from "../src/sim/founding";
import { addRoute, removeRoute, roversAt } from "../src/sim/rovers";
import { deserialize, serialize } from "../src/sim/save";
import type { World } from "../src/sim/world";
import { stepWorld } from "../src/sim/worldstep";
import { twoHoles } from "./worlds";

const run = (w: World, ticks: number) => {
  for (let i = 0; i < ticks; i++) stepWorld(w, config);
};

describe("rovers", () => {
  it("need a rover depot, two rovers each", () => {
    const w = twoHoles();
    const [home, gale] = w.holes;
    expect(roversAt(home!)).toBe(2);
    expect(addRoute(w, gale!.holeId, home!.holeId, "water", 10)).toMatchObject({ ok: false, reason: expect.stringMatching(/rover depot/) });
    expect(addRoute(w, home!.holeId, gale!.holeId, "metal", 20).ok).toBe(true);
    expect(addRoute(w, home!.holeId, gale!.holeId, "brick", 20).ok).toBe(true);
    expect(addRoute(w, home!.holeId, gale!.holeId, "rock", 20)).toMatchObject({ ok: false, reason: expect.stringMatching(/no free rover/) });
  });

  it("refuse power, waste and routes to nowhere", () => {
    const w = twoHoles();
    const [home, gale] = w.holes;
    expect(addRoute(w, home!.holeId, gale!.holeId, "power", 10).ok).toBe(false);
    expect(addRoute(w, home!.holeId, home!.holeId, "metal", 10).ok).toBe(false);
    expect(addRoute(w, home!.holeId, 99, "metal", 10).ok).toBe(false);
  });

  it("carry a load there after the travel time, log it both ends, and come back", () => {
    const w = twoHoles();
    const [home, gale] = w.holes;
    const leg = travelTicks(home!.site!, gale!.site!, config);
    addRoute(w, home!.holeId, gale!.holeId, "metal", 20);
    const metalHome = home!.resources.metal!;
    run(w, 1);
    const load = 20 * loadFactor(w, home!, gale!); // a parent loads a little extra for its child
    expect(load).toBeGreaterThan(20);
    expect(home!.resources.metal).toBeLessThanOrEqual(metalHome - load + 1e-6);
    expect(home!.ledger.current.metal?.out[`Rover to ${gale!.name}`]).toBeCloseTo(load);
    const before = gale!.resources.metal ?? 0;
    run(w, leg - 2);
    expect(w.routes[0]!.phase).toBe("outbound");
    run(w, 2);
    expect(w.routes[0]!.phase).toBe("returning");
    expect(gale!.resources.metal! - before).toBeGreaterThan(19); // minus whatever it used meanwhile
    expect(gale!.ledger.current.metal?.in[`Rover from ${home!.name}`] ?? 0).toBeGreaterThan(0);
    run(w, leg);
    expect(w.routes[0]!.phase).toBe("outbound"); // loaded again straight away
  });

  it("wait for goods rather than drive empty", () => {
    const w = twoHoles();
    const [home, gale] = w.holes;
    home!.resources.soil = 0;
    addRoute(w, home!.holeId, gale!.holeId, "soil", 10);
    run(w, 5);
    expect(w.routes[0]!.phase).toBe("loading");
  });

  it("deliver the cargo on the road when a route is ended", () => {
    const w = twoHoles();
    const [home, gale] = w.holes;
    addRoute(w, home!.holeId, gale!.holeId, "brick", 10);
    run(w, 1);
    const before = gale!.resources.brick ?? 0;
    const cargo = w.routes[0]!.cargo;
    expect(cargo).toBeGreaterThan(0);
    expect(removeRoute(w, w.routes[0]!.id).ok).toBe(true);
    expect(w.routes).toHaveLength(0);
    expect(gale!.resources.brick).toBeCloseTo(before + cargo);
  });

  it("survive a save and load mid-trip, and replay identically", () => {
    const a = twoHoles();
    addRoute(a, a.holes[0]!.holeId, a.holes[1]!.holeId, "metal", 20);
    run(a, 50);
    const loaded = deserialize(serialize(a));
    expect(loaded.ok).toBe(true);
    const b = loaded.ok ? loaded.world : a;
    run(a, 400);
    run(b, 400);
    expect(serialize(b)).toEqual(serialize(a));
  });
});
