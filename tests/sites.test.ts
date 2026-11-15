import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { applyTrait, foundHole } from "../src/sim/founding";
import { yieldRock } from "../src/sim/excavation";
import { network } from "../src/sim/network";
import { setAdults } from "../src/sim/people";
import { deserialize, serialize } from "../src/sim/save";
import { SITE_TRAITS, traitAt, traitOutput } from "../src/sim/sites";
import { createInitialState } from "../src/sim/state";
import { floorRest, temperatureOf } from "../src/sim/temperature";
import { stepWeather } from "../src/sim/weather";
import { createWorld, type World } from "../src/sim/world";
import { stepWorld } from "../src/sim/worldstep";
import { siteTraitFor } from "../src/view/network";

// Site traits (#430): later holes take the trait of their place on the map.

const id = (site: { lat: number; lon: number }) => traitAt(site)?.id ?? null;

describe("where the traits are", () => {
  it("is fixed by place: near a volcano geothermal, high latitudes ice, the equator equatorial, else none", () => {
    expect(id({ lat: 18.6, lon: 226.2 })).toBe("geothermal"); // Olympus Mons
    expect(id({ lat: 1.5, lon: 247 })).toBe("geothermal"); // Pavonis Mons wins over the equator
    expect(id({ lat: 65, lon: 30 })).toBe("ice");
    expect(id({ lat: -70, lon: 200 })).toBe("ice");
    expect(id({ lat: -5, lon: 140 })).toBe("equatorial"); // by Gale crater
    expect(id({ lat: 35, lon: 0 })).toBeNull();
    expect(id({ lat: -30, lon: 40 })).toBeNull();
  });

  it("every trait in the data eases one system and stresses another", () => {
    expect(SITE_TRAITS.map((t) => t.id)).toEqual(["geothermal", "ice", "equatorial"]);
    for (const t of SITE_TRAITS) {
      expect(t.eases).toMatch(/^\w+: /);
      expect(t.stresses).toMatch(/^\w+: /);
    }
  });

  it("the first hole has none, wherever it is, and the map says so at its site", () => {
    for (const seed of [1, 7, 42, 99, 1234]) {
      const w = createWorld(config, seed);
      expect(w.holes[0]!.trait).toBeUndefined();
      expect(siteTraitFor({ holes: [{ site: w.holes[0]!.site } as never] }, w.holes[0]!.site!)).toBeNull();
    }
  });
});

describe("what a trait changes", () => {
  it("geothermal: the floors rest warm enough to need no heater, past the usual cap", () => {
    const s = createInitialState(config, { holeId: 2, name: "Pavonis", site: { lat: 1.5, lon: 247 }, deposits: [], seed: 5 });
    const before = floorRest(temperatureOf(s, config), 1, config);
    expect(before).toBeLessThanOrEqual(config.temperature.restCapC);
    applyTrait(s, "geothermal", config);
    expect(s.trait).toBe("geothermal");
    const after = floorRest(temperatureOf(s, config), 1, config);
    expect(after).toBeGreaterThan(config.temperature.restCapC);
    expect(after).toBeGreaterThanOrEqual(config.temperature.setpointC - 0.5);
    expect(traitOutput(s, "water_recycler")).toBeLessThan(1);
  });

  it("ice: every slot dug brings up water, even off an ice deposit; solar arrays make less", () => {
    const plain = createInitialState(config, { holeId: 2, name: "A", site: { lat: 65, lon: 30 }, deposits: [], seed: 5 });
    const icy = createInitialState(config, { holeId: 3, name: "B", site: { lat: 65, lon: 30 }, deposits: [], seed: 5 });
    applyTrait(icy, "ice", config);
    plain.resources.water = icy.resources.water = 0;
    yieldRock(plain, config, 4);
    yieldRock(icy, config, 4);
    expect(plain.resources.water).toBe(0);
    expect(icy.resources.water).toBeCloseTo(4 * SITE_TRAITS.find((t) => t.id === "ice")!.effects.digYields!.water!);
    expect(traitOutput(icy, "solar_array")).toBeLessThan(1);
    expect(traitOutput(plain, "solar_array")).toBe(1);
  });

  it("equatorial: solar arrays make more, and dust storms come more often", () => {
    const storms = (trait?: string) => {
      const s = createInitialState(config, { holeId: 2, name: "Gale", site: { lat: -5, lon: 140 }, deposits: [], seed: 5 });
      if (trait) applyTrait(s, trait, config);
      let n = 0;
      let blowing = 0;
      for (let t = 0; t < 400 * config.ticksPerDay; t++) {
        s.tick = t;
        const had = !!s.weather?.storm;
        stepWeather(s, config);
        if (!had && s.weather?.storm) n++;
        if (s.weather?.storm?.started) blowing++;
      }
      return { n, blowing };
    };
    const plain = storms();
    const dusty = storms("equatorial");
    expect(dusty.n).toBeGreaterThan(plain.n * 1.3);
    expect(dusty.blowing).toBeGreaterThan(plain.blowing * 1.5);
    const s = createInitialState(config, { holeId: 2, name: "Gale", site: { lat: -5, lon: 140 }, deposits: [], seed: 5 });
    applyTrait(s, "equatorial", config);
    expect(traitOutput(s, "solar_array")).toBeGreaterThan(1);
  });

  it("a solar array at an equatorial hole makes more power at noon than one at a plain hole", () => {
    const run = (trait?: string) => {
      const s = createInitialState(config, { holeId: 2, name: "Gale", site: { lat: -5, lon: 140 }, deposits: [], seed: 5 });
      if (trait) applyTrait(s, trait, config);
      const w: World = { seed: 5, tick: 0, holes: [s], nextHoleId: 3, map: { deposits: [] }, mapUnlocked: false, convoys: [], routes: [], nextRouteId: 1, relations: {}, migrations: [] };
      // Noon, so the sun is full.
      const noon = config.ticksPerDay / 2;
      while (w.tick < noon) stepWorld(w, config);
      const array = s.layout.rooms.find((r) => r.type === "solar_array")!;
      return s.roomStatus[array.id]!.rate;
    };
    expect(run("equatorial") / run()).toBeCloseTo(SITE_TRAITS.find((t) => t.id === "equatorial")!.effects.output!.solar_array!, 2);
  });
});

describe("founding a hole on a trait", () => {
  it("the new hole takes its site's trait, says so on arrival, and keeps it through a save", () => {
    const w = createWorld(config, 42);
    const home = w.holes[0]!;
    home.drill.active = false;
    home.earth.nextDropTick = 1e9;
    Object.assign(home.resources, { metal: 150, machinery: 30, electronics: 30, brick: 100, rations: 180, water: 240, soil: 60 });
    expect(applyCommand(home, { type: "build", room: "staging_bay", at: { kind: "ring", floor: 1, ring: 1, slot: 1, w: 4, d: 1 } }).ok).toBe(true);
    setAdults(home, 40, config);
    w.mapUnlocked = true;
    home.kit = { ...network.seedKit.goods };
    expect(foundHole(w, config, home.holeId, { lat: -5, lon: 140 })).toEqual({ ok: true });
    while (w.convoys.length) stepWorld(w, config);
    const child = w.holes[1]!;
    expect(child.trait).toBe("equatorial");
    expect(child.messages.at(-1)!.text).toMatch(/equatorial site: power comes easy, dust is the worry/);
    const loaded = deserialize(serialize(w));
    expect(loaded.ok && loaded.world.holes.map((h) => h.trait ?? null)).toEqual([null, "equatorial"]);
  });
});
