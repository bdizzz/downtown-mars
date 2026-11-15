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
import { mapView, siteView } from "../src/bridge/network";
import { makeSnapshot } from "../src/sim/snapshot";

// Site traits (#430): later holes take the trait of their place on the map.

const id = (site: { lat: number; lon: number }) => traitAt(site)?.id ?? null;

describe("where the traits are", () => {
  it("near the map's other features: crater lakes, canyons, basins and highlands", () => {
    expect(id({ lat: -5, lon: 140 })).toBe("crater"); // by Gale crater, wins over the equator
    expect(id({ lat: 18.4, lon: 77.5 })).toBe("crater"); // Jezero, on the edge of Isidis
    expect(id({ lat: -12, lon: 295 })).toBe("canyon"); // Valles Marineris
    expect(id({ lat: -42, lon: 70 })).toBe("basin"); // Hellas
    expect(id({ lat: 12, lon: 92 })).toBe("basin"); // Isidis wins over the equator
    expect(id({ lat: -55, lon: 316 })).toBe("ice"); // the far side of Argyre: ice wins
    expect(id({ lat: -40, lon: 210 })).toBe("highland"); // Terra Sirenum
    expect(id({ lat: 8, lon: 69 })).toBe("highland"); // Syrtis Major wins over the equator
  });

  it("is fixed by place: near a volcano geothermal, high latitudes ice, the equator equatorial, else none", () => {
    expect(id({ lat: 18.6, lon: 226.2 })).toBe("geothermal"); // Olympus Mons
    expect(id({ lat: 1.5, lon: 247 })).toBe("geothermal"); // Pavonis Mons wins over the equator
    expect(id({ lat: 65, lon: 30 })).toBe("ice");
    expect(id({ lat: -70, lon: 200 })).toBe("ice");
    expect(id({ lat: -5, lon: 170 })).toBe("equatorial");
    expect(id({ lat: 0.2, lon: 357.5 })).toBe("equatorial"); // Meridiani Planum
    expect(id({ lat: 35, lon: 0 })).toBeNull();
    expect(id({ lat: -30, lon: 40 })).toBeNull();
  });

  it("every trait in the data eases one system and stresses another", () => {
    expect(SITE_TRAITS.map((t) => t.id)).toEqual(["geothermal", "crater", "canyon", "ice", "basin", "highland", "equatorial"]);
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

describe("the traits beyond the first three (#488)", () => {
  const hole = (trait?: string) => {
    const s = createInitialState(config, { holeId: 2, name: "A", site: { lat: -40, lon: 200 }, deposits: [], seed: 5 });
    if (trait) applyTrait(s, trait, config);
    return s;
  };
  const dug = (trait?: string) => {
    const s = hole(trait);
    for (const k of ["soil", "ore", "silica", "water"]) s.resources[k] = 0;
    yieldRock(s, config, 4);
    return s.resources;
  };
  const rest = (trait?: string) => floorRest(temperatureOf(hole(trait), config), 1, config);

  it("crater lake: digging brings up soil; the rim shades the arrays", () => {
    expect(dug("crater").soil).toBeGreaterThan(dug().soil! + 4);
    expect(traitOutput(hole("crater"), "solar_array")).toBeLessThan(1);
  });

  it("canyon: digging brings up ore; the floors rest colder", () => {
    expect(dug("canyon").ore).toBeGreaterThan(dug().ore! + 4);
    expect(rest("canyon")).toBeLessThan(rest() - 3);
  });

  it("basin: the floors rest warmer; storms come more often", () => {
    expect(rest("basin")).toBeGreaterThan(rest() + 3);
    expect(SITE_TRAITS.find((t) => t.id === "basin")!.effects.stormChance).toBeGreaterThan(1);
  });

  it("highland: digging brings up silica; recyclers are slower", () => {
    expect(dug("highland").silica).toBeGreaterThan(dug().silica! + 4);
    expect(traitOutput(hole("highland"), "water_recycler")).toBeLessThan(1);
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
    expect(foundHole(w, config, home.holeId, { lat: -5, lon: 170 })).toEqual({ ok: true });
    while (w.convoys.length) stepWorld(w, config);
    const child = w.holes[1]!;
    expect(child.trait).toBe("equatorial");
    expect(child.messages.at(-1)!.text).toMatch(/equatorial site: power comes easy, dust is the worry/);
    const loaded = deserialize(serialize(w));
    expect(loaded.ok && loaded.world.holes.map((h) => h.trait ?? null)).toEqual([null, "equatorial"]);
  });
});

describe("in the Godot viewer, through the bridge (#489)", () => {
  const snap = () => {
    const w = createWorld(config, 42);
    const home = w.holes[0]!;
    const s = makeSnapshot(home, config);
    s.holes = [{ id: home.holeId, name: home.name, site: home.site, trait: undefined } as never, { id: 9, name: "Pavonis", site: { lat: 1.5, lon: 247 }, trait: "geothermal" } as never];
    return s;
  };

  it("the site panel carries a place's trait, a hole's own at its site, and none at the first hole's", () => {
    const s = snap();
    expect(siteView(s, { lat: -42, lon: 70 }).trait).toMatchObject({ name: "Basin", eases: expect.stringMatching(/^Heat: /) });
    expect(siteView(s, { lat: 1.5, lon: 247 }).trait?.name).toBe("Geothermal");
    expect(siteView(s, s.holes[0]!.site!).trait).toBeNull();
  });

  it("the map gives each hole's trait by name, and how near counts as its site", () => {
    const m = mapView(snap());
    expect(m.holes.map((h) => h.trait)).toEqual([null, "Geothermal"]);
    expect(m.holeSiteDeg).toBe(network.seedKit.minSpacingDeg / 2);
  });
});
