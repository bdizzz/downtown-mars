import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { airAmount } from "../src/sim/air";
import { config as baseConfig, type SimConfig } from "../src/sim/config";
import { diagnose } from "../src/sim/diagnosis";
import { targetHappiness, updateHappiness } from "../src/sim/happiness";
import type { Location } from "../src/sim/placement";
import { createInitialState, type SimState } from "../src/sim/state";
import { step } from "../src/sim/step";

// No Earth drops in the numbers.
const config: SimConfig = { ...baseConfig, earth: { ...baseConfig.earth, firstDropDay: 1e6 } };
const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });

function withRooms(rooms: [string, Location][]): SimState {
  const s = createInitialState(config);
  s.drill.active = false;
  Object.assign(s.resources, { metal: 500, rock: 500, brick: 500, machinery: 50, electronics: 50 });
  for (const [room, at] of rooms) {
    const r = applyCommand(s, { type: "build", room, at });
    if (!r.ok) throw new Error(`${room}: ${r.reason}`);
    const c = applyCommand(s, { type: "connectRoom", roomId: r.roomId!, finish: "rock" });
    if (!c.ok) throw new Error(`${room}: ${c.reason}`);
  }
  updateHappiness(s, config, true);
  return s;
}

/** Run a few ticks, holding a stock at zero (or the air at a level) the whole time. */
function run(s: SimState, ticks: number, hold: (s: SimState) => void): void {
  for (let i = 0; i < ticks; i++) {
    hold(s);
    step(s, config);
  }
}

describe("diagnosis: health", () => {
  it("a well-supplied hole is recovering, with nothing draining it", () => {
    const s = createInitialState(config);
    s.population.health = 60;
    run(s, 2, (h) => {
      h.resources.meals = 100;
      h.resources.water = 100;
    });
    const d = diagnose(s, config).health;
    expect(d.recovering).toBe(true);
    expect(d.causes).toEqual([]);
    expect(d.perDay).toBe(config.colonists.healthRecoveryPerDay);
  });

  it("names meals when nobody has eaten, with how much was met", () => {
    const s = createInitialState(config);
    run(s, 3, (h) => {
      h.resources.meals = 0;
      h.resources.rations = 0;
    });
    const d = diagnose(s, config).health;
    expect(d.recovering).toBe(false);
    expect(d.causes[0]!.id).toBe("meals");
    expect(d.causes[0]!.amount).toBeCloseTo(-config.colonists.healthLossPerDay.meals!);
    expect(d.causes[0]!.text).toContain("0%");
    expect(d.causes[0]!.fix).toBeTruthy();
    expect(d.perDay).toBeCloseTo(d.causes.reduce((sum, c) => sum + c.amount, 0));
  });

  it("names CO2 when the air goes bad, with its level", () => {
    const s = createInitialState(config);
    run(s, 2, (h) => {
      h.resources.co2 = airAmount(h, config, config.air.co2Dangerous + 1);
    });
    const d = diagnose(s, config).health;
    const co2 = d.causes.find((c) => c.id === "co2")!;
    expect(co2.amount).toBe(-config.air.healthLossPerDay.co2Dangerous);
    expect(co2.text).toMatch(/CO2.*%/);
  });
});

describe("diagnosis: happiness", () => {
  it("names the noise next door, and the home that hears it", () => {
    const s = withRooms([["life_support", ring(1, 1, 1, 4)], ["bunk_dorm", ring(1, 1, 5, 2)]]);
    const dorm = s.layout.rooms.find((r) => r.type === "bunk_dorm")!;
    s.population.count = s.happiness.pools.reduce((n, p) => n + p.capacity, 0);
    updateHappiness(s, config, true);
    const noise = diagnose(s, config).happiness.causes.find((c) => c.id === "noise")!;
    expect(noise.amount).toBeLessThan(0);
    expect(noise.factor).toBe("noise");
    expect(noise.homes).toContain(dorm.id);
  });

  it("names the homeless when there aren't enough beds", () => {
    const s = createInitialState(config);
    s.population.count = s.happiness.pools.reduce((n, p) => n + p.capacity, 0) + 10;
    updateHappiness(s, config, true);
    const d = diagnose(s, config).happiness;
    const homeless = d.causes.find((c) => c.id === "homeless")!;
    expect(homeless.amount).toBeLessThan(0);
    expect(homeless.fix).toContain("homes");
  });

  it("the causes add up to where happiness is heading", () => {
    const s = withRooms([["life_support", ring(1, 1, 1, 4)], ["bunk_dorm", ring(1, 1, 5, 2)]]);
    s.population.count = 12;
    updateHappiness(s, config, true);
    const h = s.happiness;
    const glow = h.afterglow ?? 0;
    const weighted = h.pools.reduce((n, p) => n + p.residents * (targetHappiness(p.factors, config) + glow), 0);
    const housed = h.pools.reduce((n, p) => n + p.residents, 0);
    expect(housed).toBe(12);
    expect(diagnose(s, config).happiness.target).toBeCloseTo(weighted / housed, 0);
  });

  it("the hole's poor health shows up in happiness, with the health in its text", () => {
    const s = createInitialState(config);
    s.population.health = 3;
    updateHappiness(s, config, true);
    const c = diagnose(s, config).happiness.causes.find((x) => x.id === "holeHealth")!;
    expect(c.amount).toBeLessThan(-10);
    expect(c.text).toContain("3");
    expect(diagnose(s, config).happiness.worst[0]!.causes.map((x) => x.id)).toContain("holeHealth");
  });
});
