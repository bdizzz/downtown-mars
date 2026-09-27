import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config as baseConfig, type SimConfig } from "../src/sim/config";
import { roomSpec } from "../src/sim/economy";
import type { Location } from "../src/sim/placement";
import { makeSnapshot } from "../src/sim/snapshot";
import { createInitialState, type SimState } from "../src/sim/state";
import { step } from "../src/sim/step";

// No Earth drops here: these tests are about what the hole does on its own.
const config: SimConfig = { ...baseConfig, earth: { ...baseConfig.earth, firstDropDay: 1e6 } };

const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });
const days = (s: SimState, n: number) => {
  for (let i = 0; i < n * config.ticksPerDay; i++) step(s, config);
};
const build = (s: SimState, room: string, at: Location) => {
  const r = applyCommand(s, { type: "build", room, at });
  if (!r.ok) throw new Error(`${room}: ${r.reason}`);
  return s.layout.rooms[s.layout.rooms.length - 1]!;
};

/** The docs' tier 1 critical set on floor 1, affordable from the starting stock. */
function criticalSet(): SimState {
  const s = createInitialState(config);
  s.drill.active = false; // keep the numbers about the economy
  build(s, "bunk_dorm", ring(1, 1, 1, 2));
  build(s, "galley", ring(1, 1, 3));
  build(s, "restroom", ring(1, 1, 4));
  build(s, "corridor", ring(1, 1, 5));
  build(s, "life_support", ring(1, 2, 9, 4));
  build(s, "water_tank", ring(1, 2, 8));
  return s;
}

describe("build costs", () => {
  it("charges on build and refunds half on demolish", () => {
    const s = createInitialState(config);
    const metal = s.resources.metal!;
    const tank = build(s, "water_tank", ring(1, 1, 3));
    expect(s.resources.metal).toBe(metal - 5);
    applyCommand(s, { type: "demolish", roomId: tank.id });
    expect(s.resources.metal).toBe(metal - 2.5);
  });

  it("refuses what it can't afford", () => {
    const s = createInitialState(config);
    s.resources.metal = 3;
    expect(applyCommand(s, { type: "build", room: "water_tank", at: ring(1, 1, 3) })).toEqual({ ok: false, reason: "Needs 2 more metal" });
  });

  it("the critical set is affordable from the starting stock", () => {
    expect(() => criticalSet()).not.toThrow();
  });
});

describe("the 20-colonist start on the critical set", () => {
  it("breathes, eats and stays healthy for 4 days", () => {
    const s = criticalSet();
    days(s, 4);
    const snap = makeSnapshot(s, config);
    expect(snap.population.health).toBeGreaterThan(95);
    expect(snap.population.needsMet).toEqual({ o2: 1, water: 1, meals: 1 });
    expect(s.resources.o2).toBeGreaterThan(100);
    expect(s.resources.co2).toBeLessThan(config.colonists.co2DangerLevel);
  });

  it("runs power nearly full: about 9 of 10", () => {
    const s = criticalSet();
    days(s, 1);
    const { made, used } = makeSnapshot(s, config).power;
    expect(made).toBeCloseTo(10);
    expect(used).toBeGreaterThan(8);
    expect(used).toBeLessThanOrEqual(made);
  });

  it("leans on Earth for water and rations: both run down", () => {
    const s = criticalSet();
    days(s, 2);
    expect(s.rates.water).toBeLessThan(-20);
    expect(s.rates.rations).toBeLessThan(-15);
  });

  it("gets sick, not dead, once rations run out", () => {
    const s = criticalSet();
    s.resources.rations = 10;
    days(s, 3);
    expect(s.population.needsMet.meals).toBe(0);
    expect(s.population.health).toBeLessThan(90);
    expect(s.population.count).toBe(20);
  });
});

describe("rooms", () => {
  it("staff go to critical rooms first", () => {
    const s = criticalSet();
    s.population.count = 5;
    days(s, 0.1);
    const ls = s.layout.rooms.find((r) => r.type === "life_support")!;
    expect(s.roomStatus[ls.id]).toMatchObject({ staff: 4, staffNeeded: 4 });
  });

  it("an understaffed room runs at part rate", () => {
    const s = criticalSet();
    s.population.count = 2;
    s.layout.rooms.find((r) => r.type === "life_support")!.priority = "low";
    days(s, 0.1);
    const ls = s.layout.rooms.find((r) => r.type === "life_support")!;
    expect(s.roomStatus[ls.id]!.limit).toBe("staff");
    expect(s.roomStatus[ls.id]!.rate).toBeLessThan(1);
  });

  it("the galley falls back to Earth rations when there's no raw food", () => {
    const s = criticalSet();
    const r0 = s.resources.rations!;
    days(s, 1);
    expect(s.resources.rations!).toBeLessThan(r0);
    expect(s.population.needsMet.meals).toBe(1);
  });

  it("a deep 2×2 farm's wedge scales output by slots covered", () => {
    const s = createInitialState(config);
    // Ring 1 slots 1–2 span 40°–120°; three ring 2 slot centres fall inside.
    const farm = build(s, "farm", ring(1, 1, 1, 2, 2));
    expect(farm.cells).toHaveLength(5);
    expect(roomSpec(farm, config).makes.rawFood).toBeCloseTo(15);
    expect(roomSpec(farm, config).staff).toBe(8);
  });

  it("crop choice changes yield", () => {
    const s = createInitialState(config);
    const farm = build(s, "farm", ring(1, 1, 1, 4));
    expect(roomSpec(farm, config).makes.rawFood).toBe(12);
    applyCommand(s, { type: "setCrop", roomId: farm.id, crop: "soybeans" });
    expect(roomSpec(farm, config).makes.rawFood).toBe(8);
  });

  it("is deterministic", () => {
    const a = criticalSet();
    const b = criticalSet();
    days(a, 2);
    days(b, 2);
    expect(a.resources).toEqual(b.resources);
  });
});
