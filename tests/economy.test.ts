import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config as baseConfig, type SimConfig } from "../src/sim/config";
import { roomSpec } from "../src/sim/economy";
import type { Location } from "../src/sim/placement";
import { makeSnapshot } from "../src/sim/snapshot";
import { createInitialState, type SimState } from "../src/sim/state";
import { step } from "../src/sim/step";
import { setAdults } from "../src/sim/people";
import { roomDef } from "../src/sim/rooms";
import { airAmount, airPct, fillAir } from "../src/sim/air";
import { openCells } from "../src/sim/excavation";

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
  const ls = build(s, "life_support", ring(1, 2, 9, 4));
  build(s, "water_tank", ring(1, 2, 8));
  const el = build(s, "electrolyzer", ring(1, 2, 4, 2));
  for (const room of [ls, el]) {
    const c = applyCommand(s, { type: "connectRoom", roomId: room.id, finish: "rock" });
    if (!c.ok) throw new Error(c.reason);
  }
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
  it("breathes, eats and stays healthy for 2 days, while the electrolyzer refills the air the new rooms diluted", () => {
    const s = criticalSet();
    // Digging out the scrubber, the electrolyzer and the tank thinned the air.
    expect(airPct(s, config, "o2")).toBeLessThan(config.air.o2VeryLow);
    days(s, 2);
    const snap = makeSnapshot(s, config);
    // Digging the set out at once leaves the air very thin for half a day: health dips, then recovers.
    expect(snap.population.health).toBeGreaterThan(85);
    expect(snap.population.needsMet).toEqual({ water: 1, meals: 1 });
    expect(snap.air.o2Pct).toBeGreaterThan(config.air.o2Low);
    expect(snap.air.co2Pct).toBeLessThan(config.air.co2Harmful);
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
    const need = roomDef("life_support").staff;
    setAdults(s, need, config);
    days(s, 0.1);
    const ls = s.layout.rooms.find((r) => r.type === "life_support")!;
    expect(s.roomStatus[ls.id]).toMatchObject({ staff: need, staffNeeded: need });
  });

  it("an understaffed room runs at part rate", () => {
    const s = criticalSet();
    setAdults(s, 2, config);
    s.layout.rooms.find((r) => r.type === "life_support")!.priority = "low";
    s.resources.co2 = airAmount(s, config, 2); // plenty to scrub
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
    // Rings 1 and 2 are a pair with the same slots, so a 2×2 is exactly 4 cells.
    const farm = build(s, "farm", ring(1, 1, 1, 2, 2));
    expect(farm.cells).toHaveLength(4);
    expect(roomSpec(farm, config).makes.rawFood).toBeCloseTo(12);
    expect(roomSpec(farm, config).staff).toBe(roomDef("farm").staff);
    // Across a pair boundary (ring 2 into ring 3, which has more slots) the wedge widens and output scales.
    const deep = build(s, "farm", ring(1, 2, 4, 2, 2));
    expect(deep.cells.length).toBeGreaterThan(4);
    expect(roomSpec(deep, config).makes.rawFood).toBeCloseTo((12 * deep.cells.length) / 4);
  });

  it("crop choice changes yield", () => {
    const s = createInitialState(config);
    const farm = build(s, "farm", ring(1, 1, 1, 4));
    expect(roomSpec(farm, config).makes.rawFood).toBe(12);
    applyCommand(s, { type: "setCrop", roomId: farm.id, crop: "soybeans" });
    expect(roomSpec(farm, config).makes.rawFood).toBe(8);
  });

  it("fiber hemp makes fiber instead of food", () => {
    const s = createInitialState(config);
    const farm = build(s, "farm", ring(1, 1, 1, 4));
    applyCommand(s, { type: "setCrop", roomId: farm.id, crop: "hemp" });
    const spec = roomSpec(farm, config);
    expect(spec.makes.fiber).toBe(6);
    expect(spec.makes.rawFood).toBeUndefined();
    expect(spec.makes.o2).toBe(roomDef("farm").makes.o2);
  });

  it("what a farm grows counts toward the first harvest; its byproducts don't", () => {
    const s = createInitialState(config);
    build(s, "farm", ring(1, 1, 1, 4));
    days(s, 1);
    expect(s.harvested).toBeGreaterThan(10);
    expect(s.harvested).toBeLessThanOrEqual(12.01);
    expect(s.milestones!.some((m) => m.id === "first_harvest")).toBe(true);
  });

  it("a farm keeps growing food when oxygen storage is full", () => {
    const s = createInitialState(config);
    const farm = build(s, "farm", ring(1, 1, 1, 4));
    s.resources.o2 = 1e6; // far over capacity: full
    days(s, 0.1);
    expect(s.roomStatus[farm.id]!.rate).toBeGreaterThan(0.9);
  });

  it("the scrubber turns CO2 back into oxygen for power alone, so a steady colony's electrolyzer stands by", () => {
    const s = criticalSet();
    fillAir(s, config);
    const co2 = airAmount(s, config, 2);
    s.resources.co2 = co2;
    const o2 = s.resources.o2!;
    days(s, 1);
    // Scrubs 30 a day against 20 breathed out, each into as much oxygen.
    expect(s.resources.co2).toBeCloseTo(co2 - 10, 0);
    expect(s.resources.o2).toBeCloseTo(o2 + 10, 0);
    const ls = s.layout.rooms.find((r) => r.type === "life_support")!;
    expect(s.roomStatus[ls.id]!.rate).toBe(1);
    expect(s.ledger.days.at(-1)!.water?.out["CO2 scrubber"]).toBeUndefined();
    expect(s.ledger.days.at(-1)!.soil?.in["CO2 scrubber"]).toBeCloseTo(0.5, 1);
    // With the air above its target, the electrolyzer splits no water.
    expect(s.ledger.days.at(-1)!.water?.out.Electrolyzer ?? 0).toBe(0);
  });

  it("the scrubber idles at the scrub floor, and the electrolyzer at the target", () => {
    const s = criticalSet();
    fillAir(s, config);
    days(s, 1);
    const ls = s.layout.rooms.find((r) => r.type === "life_support")!;
    const el = s.layout.rooms.find((r) => r.type === "electrolyzer")!;
    // Just enough to scrub what 20 colonists breathe out: 20 of 30.
    expect(s.roomStatus[ls.id]!.rate).toBeCloseTo(2 / 3, 1);
    expect(s.roomStatus[ls.id]!.limit).toBe("air:co2");
    expect(s.roomStatus[el.id]).toMatchObject({ rate: 0, limit: "air:o2" });
  });

  it("the electrolyzer makes the air for new space, and its water says so", () => {
    const s = criticalSet();
    fillAir(s, config);
    days(s, 0.5);
    const owedBefore = s.air?.owed ?? 0;
    expect(owedBefore).toBe(0);
    // Dig a cell: 400 m³ more to fill, at 21%.
    openCells(s.layout, [{ floor: 1, ring: 3, slot: 0 }]);
    s.layout.version++;
    days(s, 1);
    const then = s.ledger.days.at(-1)!.water?.then?.Electrolyzer ?? {};
    expect(then["Air for new space"] ?? 0).toBeGreaterThan(0);
    expect(airPct(s, config, "o2")).toBeCloseTo(config.air.o2Target, 0);
  });

  it("is deterministic", () => {
    const a = criticalSet();
    const b = criticalSet();
    days(a, 2);
    days(b, 2);
    expect(a.resources).toEqual(b.resources);
  });
});
