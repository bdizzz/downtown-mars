import { describe, expect, it } from "vitest";
import { airAmount, airHealthLoss, airPct, airVolume, breathe, livingVolume } from "../src/sim/air";
import { config as baseConfig, type SimConfig } from "../src/sim/config";
import { openCells } from "../src/sim/excavation";
import { deserialize, serialize } from "../src/sim/save";
import { createInitialState } from "../src/sim/state";
import { step } from "../src/sim/step";
import { createWorld } from "../src/sim/world";

// The air as a mix over the living volume (PLAN-M16 step 1, T-026).

const config: SimConfig = { ...baseConfig, earth: { ...baseConfig.earth, firstDropDay: 1e6 } };
const cell = 10 * 10 * 4;

describe("living volume", () => {
  it("is the dug cells and the built gallery: about 4,750 m³ for a new hole", () => {
    const s = createInitialState(config);
    expect(airVolume(s, config)).toBeGreaterThan(4500);
    expect(airVolume(s, config)).toBeLessThan(5000);
  });

  it("grows by a cell's 400 m³ when one is dug out", () => {
    const s = createInitialState(config);
    const before = airVolume(s, config);
    openCells(s.layout, [{ floor: 1, ring: 3, slot: 0 }]);
    expect(airVolume(s, config)).toBeCloseTo(before + cell);
    expect(livingVolume(s.layout, config)).toBeCloseTo(before + cell);
  });

  it("counts a corridor only once it's built", () => {
    const s = createInitialState(config);
    const before = airVolume(s, config);
    const id = Object.keys(s.layout.corridors)[0]!;
    s.layout.corridorsBuilding = { [id]: 1 };
    expect(airVolume(s, config)).toBeLessThan(before);
  });
});

describe("the mix", () => {
  it("starts a new game at the O2 target and the CO2 floor", () => {
    const s = createInitialState(config);
    expect(airPct(s, config, "o2")).toBeCloseTo(config.air.o2Target);
    expect(airPct(s, config, "co2")).toBeCloseTo(config.air.co2Floor);
  });

  it("thins when the hole digs: the same oxygen over more space", () => {
    const s = createInitialState(config);
    const o2 = s.resources.o2;
    openCells(s.layout, [0, 1, 2, 3].map((slot) => ({ floor: 1, ring: 2, slot })));
    expect(s.resources.o2).toBe(o2);
    expect(airPct(s, config, "o2")).toBeLessThan(config.air.o2Target - 1);
  });

  it("is breathed 1:1, O2 into CO2", () => {
    const s = createInitialState(config);
    const total = s.resources.o2! + s.resources.co2!;
    breathe(s, config, 1);
    expect(s.resources.co2).toBeCloseTo(airAmount(s, config, config.air.co2Floor) + 20);
    expect(s.resources.o2! + s.resources.co2!).toBeCloseTo(total);
  });

  it("costs health by band: the worse O2 band plus the worse CO2 band", () => {
    const s = createInitialState(config);
    const loss = config.air.healthLossPerDay;
    expect(airHealthLoss(s, config)).toBe(0);
    s.resources.o2 = airAmount(s, config, (config.air.o2Low + config.air.o2VeryLow) / 2);
    expect(airHealthLoss(s, config)).toBe(loss.o2Low);
    s.resources.o2 = airAmount(s, config, config.air.o2VeryLow - 1);
    s.resources.co2 = airAmount(s, config, config.air.co2Dangerous + 1);
    expect(airHealthLoss(s, config)).toBe(loss.o2VeryLow + loss.co2Dangerous);
  });

  it("with nobody scrubbing, CO2 passes the harmful level in a few days", () => {
    const s = createInitialState(config);
    s.drill.active = false;
    let day = 0;
    while (airPct(s, config, "co2") <= config.air.co2Harmful && day < 20) {
      for (let i = 0; i < config.ticksPerDay; i++) step(s, config);
      day++;
    }
    expect(day).toBeGreaterThanOrEqual(3);
    expect(day).toBeLessThanOrEqual(7);
  });
});

describe("saves", () => {
  it("an old save's air starts over at the target", () => {
    const w = createWorld(config, 42);
    const file = JSON.parse(serialize(w));
    file.version = 18;
    for (const h of file.state.holes) {
      h.resources.o2 = 150;
      h.resources.co2 = 40;
    }
    const back = deserialize(JSON.stringify(file));
    expect(back.ok).toBe(true);
    const hole = back.ok ? back.world.holes[0]! : null!;
    expect(airPct(hole, config, "o2")).toBeCloseTo(config.air.o2Target);
    expect(airPct(hole, config, "co2")).toBeCloseTo(config.air.co2Floor);
  });
});
