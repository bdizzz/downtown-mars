import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { foundHole, travelTicks } from "../src/sim/founding";
import { addRoute, removeRoute, roversAt } from "../src/sim/rovers";
import { deserialize, serialize } from "../src/sim/save";
import { createWorld, type World } from "../src/sim/world";
import { stepWorld } from "../src/sim/worldstep";

const site = { lat: -5, lon: 140 };

/** Two holes, the first with a rover depot and plenty of metal. */
function twoHoles(): World {
  const w = createWorld(config, 42);
  const home = w.holes[0]!;
  home.drill.active = false;
  home.earth.nextDropTick = 1e9;
  home.population.count = 40;
  w.mapUnlocked = true;
  home.kit = { ...(home.kit ?? {}) };
  // Skip the staging: hand the kit over directly.
  const r = applyCommand(home, { type: "build", room: "staging_bay", at: { kind: "ring", floor: 1, ring: 1, slot: 1, w: 4, d: 1 } });
  if (!r.ok) throw new Error(r.reason);
  Object.assign(home.kit, { o2: 60, machinery: 6, electronics: 4, metal: 40, brick: 20, rations: 80, water: 160, soil: 20 });
  const f = foundHole(w, config, home.holeId, site);
  if (!f.ok) throw new Error(f.reason);
  const arrive = w.convoys[0]!.arriveTick;
  while (w.tick < arrive) stepWorld(w, config);
  home.resources.metal = 150;
  home.resources.machinery = 20;
  const d = applyCommand(home, { type: "build", room: "rover_depot", at: { kind: "surface", slot: 8 } });
  if (!d.ok) throw new Error(d.reason);
  return w;
}

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
    expect(home!.resources.metal).toBeLessThanOrEqual(metalHome - 20 + 1e-6);
    expect(home!.ledger.current.metal?.out[`Rover to ${gale!.name}`]).toBe(20);
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
    expect(removeRoute(w, w.routes[0]!.id).ok).toBe(true);
    expect(w.routes).toHaveLength(0);
    expect(gale!.resources.brick).toBe(before + 10);
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
