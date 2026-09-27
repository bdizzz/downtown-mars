import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { foundHole, foundingRefusal, kitProgress } from "../src/sim/founding";
import { network } from "../src/sim/network";
import { deserialize, serialize } from "../src/sim/save";
import { createWorld, type World } from "../src/sim/world";
import { stepWorld } from "../src/sim/worldstep";

const days = (w: World, n: number) => {
  for (let i = 0; i < n * config.ticksPerDay; i++) stepWorld(w, config);
};

/** A world whose first hole is big, rich, and has a staging bay, with the map open. */
function ready(): World {
  const w = createWorld(config, 42);
  const home = w.holes[0]!;
  home.drill.active = false;
  home.earth.nextDropTick = 1e9; // keep Earth out of the numbers
  Object.assign(home.resources, { metal: 150, machinery: 30, electronics: 30, brick: 100, rations: 180, water: 240, soil: 60 });
  const r = applyCommand(home, { type: "build", room: "staging_bay", at: { kind: "ring", floor: 1, ring: 1, slot: 1, w: 4, d: 1 } });
  if (!r.ok) throw new Error(r.reason);
  home.population.count = 40;
  w.mapUnlocked = true;
  return w;
}

const site = { lat: -5, lon: 140 }; // near Gale crater, far from the northern start

/** Let the bay fill the kit, topping up water each day the way Earth drops would. */
function gather(w: World): void {
  for (let d = 0; d < network.seedKit.fillDays + 1; d++) {
    w.holes[0]!.resources.water = 240;
    w.holes[0]!.resources.o2 = 200;
    days(w, 1);
  }
}

describe("the staging bay", () => {
  it("gathers a seed kit in a few days, keeping a reserve", () => {
    const w = ready();
    const home = w.holes[0]!;
    gather(w);
    expect(kitProgress(home)).toBeGreaterThan(0.99);
    // Never below half a kit's worth of anything it took.
    expect(home.resources.metal).toBeGreaterThanOrEqual(network.seedKit.goods.metal! * network.seedKit.reserveFraction - 1e-6);
  });

  it("won't found before the kit is full, or without enough people", () => {
    const w = ready();
    expect(foundingRefusal(w, w.holes[0]!, site)).toMatch(/seed kit/);
    gather(w);
    w.holes[0]!.population.count = 25;
    expect(foundingRefusal(w, w.holes[0]!, site)).toMatch(/needs 32 colonists/);
  });

  it("won't found right next to an existing hole", () => {
    const w = ready();
    gather(w);
    expect(foundingRefusal(w, w.holes[0]!, w.holes[0]!.site!)).toMatch(/Too close/);
  });
});

describe("founding", () => {
  it("sends a convoy that becomes a new hole on arrival", () => {
    const w = ready();
    gather(w);
    const home = w.holes[0]!;
    const metalKit = home.kit.metal!;
    expect(foundHole(w, config, home.holeId, site)).toEqual({ ok: true });
    expect(home.population.count).toBe(40 - network.seedKit.volunteers);
    expect(home.kit).toEqual({});
    expect(w.convoys).toHaveLength(1);
    const arrive = w.convoys[0]!.arriveTick;
    while (w.tick < arrive) stepWorld(w, config);
    expect(w.convoys).toHaveLength(0);
    expect(w.holes).toHaveLength(2);
    const child = w.holes[1]!;
    expect(child).toMatchObject({ name: "Gale", site });
    expect(child.population.count).toBe(network.seedKit.volunteers);
    expect(child.resources.metal).toBeCloseTo(metalKit);
    expect(child.messages.at(-1)!.text).toMatch(/new hole is founded/);
    // They arrive with air to breathe until they build life support.
    expect(child.resources.o2).toBeGreaterThanOrEqual(network.seedKit.goods.o2! - 1e-6);
  });

  it("both holes then run, and the world saves and loads with them", () => {
    const w = ready();
    gather(w);
    foundHole(w, config, 1, site);
    while (w.convoys.length) stepWorld(w, config);
    const childTick = w.holes[1]!.tick;
    days(w, 1);
    expect(w.holes[1]!.tick).toBe(childTick + config.ticksPerDay);
    expect(w.holes[1]!.tick).toBe(w.holes[0]!.tick);
    const loaded = deserialize(serialize(w));
    expect(loaded.ok && loaded.world.holes.map((h) => h.name)).toEqual(["Bradbury", "Gale"]);
  });
});

describe("two holes at once", () => {
  it("shows news from every hole in one feed, tagged with its hole", async () => {
    const { networkMessages } = await import("../src/sim/world");
    const w = ready();
    gather(w);
    foundHole(w, config, 1, site);
    while (w.convoys.length) stepWorld(w, config);
    const feed = networkMessages(w, 20);
    expect(feed.some((m) => m.holeName === "Gale" && /new hole is founded/.test(m.text))).toBe(true);
    expect(feed.some((m) => m.holeName === "Bradbury")).toBe(true);
    expect([...feed].sort((a, b) => a.tick - b.tick)).toEqual(feed);
  });

  it("each hole gets its own Earth drops", () => {
    const w = ready();
    gather(w);
    foundHole(w, config, 1, site);
    while (w.convoys.length) stepWorld(w, config);
    const child = w.holes[1]!;
    const dropAt = child.earth.nextDropTick;
    expect(dropAt).toBeGreaterThan(w.tick);
    while (w.tick <= dropAt) stepWorld(w, config);
    expect(child.messages.some((m) => /Supply drop landed/.test(m.text))).toBe(true);
  });
});
