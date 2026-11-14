import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config as baseConfig, type SimConfig } from "../src/sim/config";
import { cooked, drawFood, FOOD, harvestBonus, harvestProgress, harvestSize, reconcileFood, variety, varietyComfort } from "../src/sim/food";
import { homeParts } from "../src/sim/happiness";
import type { Spot } from "../src/sim/placement";
import { cropDef } from "../src/sim/resources";
import { deserialize, serialize } from "../src/sim/save";
import { createInitialState, type SimState } from "../src/sim/state";
import { step } from "../src/sim/step";
import { createWorld } from "../src/sim/world";
import { ringAt } from "./spots";

// Harvest cycles and food variety (#375).

const config: SimConfig = { ...baseConfig, earth: { ...baseConfig.earth, firstDropDay: 1e6 } };
const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Spot => (ringAt(floor, r, slot, w, d));
const days = (s: SimState, n: number) => {
  for (let i = 0; i < Math.round(n * config.ticksPerDay); i++) step(s, config);
};
const build = (s: SimState, room: string, at: Spot) => {
  const r = applyCommand(s, { type: "build", room, at, confirmed: true });
  if (!r.ok) throw new Error(`${room}: ${r.reason}`);
  return s.layout.rooms[s.layout.rooms.length - 1]!;
};
/** A hole with one farm, flush with what it needs, its food left alone. */
function farmHole(crop = "potatoes"): { s: SimState; farm: ReturnType<typeof build> } {
  const s = createInitialState(config);
  s.drill.active = false;
  const farm = build(s, "farm", ring(1, 1, 1, 4));
  applyCommand(s, { type: "setCrop", roomId: farm.id, crop });
  return { s, farm };
}

describe("harvest cycles", () => {
  it("a long grow time earns up to a fifth more", () => {
    expect(harvestBonus(cropDef("leafyGreens"))).toBe(0);
    expect(harvestBonus(cropDef("hemp"))).toBeCloseTo(0.2);
    expect(harvestSize(cropDef("hemp"))).toBeCloseTo(6 * 4 * 1.2);
    for (const c of ["potatoes", "wheat", "soybeans", "algae", "hemp"]) {
      const g = cropDef(c).growMonths;
      expect(g).toBeGreaterThanOrEqual(1.5);
      expect(g).toBeLessThanOrEqual(4);
    }
  });

  it("nothing comes in until the counter fills, then the whole harvest at once", () => {
    const { s, farm } = farmHole("leafyGreens");
    const before = s.resources.rawFood ?? 0;
    days(s, 1.4);
    expect(s.resources.rawFood ?? 0).toBe(before);
    expect(harvestProgress(farm, 7)!.share).toBeGreaterThan(0.9);
    days(s, 0.2);
    // 7 a month for 1.5 months, no bonus, at whatever rate the farm ran.
    expect(s.harvested).toBeGreaterThan(7 * 1.5 * 0.8);
    expect(s.harvested).toBeLessThanOrEqual(7 * 1.5 + 1e-6);
    expect(s.food?.types.leafyGreens).toBeGreaterThan(0);
    expect(farm.growth!.harvests).toBe(1);
    expect(farm.growth!.days).toBeLessThan(0.2);
  });

  it("a slowed farm gives a smaller harvest, on time", () => {
    const run = (pauseFor: number) => {
      const { s, farm } = farmHole("leafyGreens");
      applyCommand(s, { type: "setRunning", roomId: farm.id, paused: true, stopAt: null } as never);
      farm.paused = pauseFor > 0;
      days(s, pauseFor);
      farm.paused = false;
      days(s, 1.5 - pauseFor + 0.05);
      return s.harvested ?? 0;
    };
    const full = run(0);
    const half = run(0.75);
    expect(full).toBeGreaterThan(0);
    expect(half).toBeGreaterThan(0);
    expect(half / full).toBeGreaterThan(0.4);
    expect(half / full).toBeLessThan(0.6);
  });

  it("changing the crop starts the cycle over", () => {
    const { s, farm } = farmHole("potatoes");
    days(s, 1);
    expect(farm.growth!.days).toBeGreaterThan(0.9);
    applyCommand(s, { type: "setCrop", roomId: farm.id, crop: "wheat" });
    expect(farm.growth).toEqual({ days: 0, banked: 0 });
  });

  it("hemp's fiber comes in harvests too, and isn't a food type", () => {
    const { s, farm } = farmHole("hemp");
    farm.growth = { days: 3.9, banked: 20 };
    days(s, 0.2);
    expect(s.resources.fiber).toBeGreaterThan(20 * 1.2);
    expect(s.resources.fiber).toBeLessThan(20 * 1.2 + 6 * 0.2 * 1.2);
    expect(s.food?.types.hemp).toBeUndefined();
  });

  it("old saves: farms start halfway through a cycle, and raw food is split across the crops grown", () => {
    const w = createWorld(config);
    const s = w.holes[0]!;
    const farm = build(s, "farm", ring(1, 1, 1, 4));
    const other = build(s, "farm", ring(1, 2, 9, 4));
    applyCommand(s, { type: "setCrop", roomId: other.id, crop: "soybeans" });
    farm.building = false;
    other.building = false;
    s.resources.rawFood = 40;
    s.resources.meals = 10;
    const old = JSON.parse(serialize(w));
    old.version = 22;
    for (const h of old.state.holes) {
      delete h.food;
      for (const r of h.layout.rooms) delete r.growth;
    }
    const back = deserialize(JSON.stringify(old));
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    const hole = back.world.holes[0]!;
    const f = hole.layout.rooms.find((r) => r.id === farm.id)!;
    expect(f.growth!.days).toBeCloseTo(cropDef("potatoes").growMonths / 2);
    expect(f.growth!.banked).toBeGreaterThan(0);
    // Potatoes make 12 a month, soybeans 8: 24 and 16 of the 40.
    expect(hole.food!.types.potatoes).toBeCloseTo(24);
    expect(hole.food!.types.soybeans).toBeCloseTo(16);
    expect(hole.food!.meals[FOOD.unknownMeals]).toBeCloseTo(10);
  });
});

describe("food by type and meal variety", () => {
  const withTypes = (types: Record<string, number>): SimState => {
    const s = createInitialState(config);
    s.resources.rawFood = Object.values(types).reduce((a, v) => a + v, 0);
    s.food = { types: { ...types }, meals: [0, 0, 0, 0], eaten: [0, 0, 0, 0] };
    return s;
  };

  it("a meal draws on up to four types in equal shares, the best the stocks allow", () => {
    const s = withTypes({ potatoes: 10, wheat: 10, soybeans: 10, leafyGreens: 10, algae: 10 });
    expect(drawFood(s, 4)).toEqual([0, 0, 0, 4]);
    // The four most stocked, a quarter each: algae (the fifth, by name) is left alone this time.
    expect(Object.values(s.food!.types).filter((v) => v === 9)).toHaveLength(4);
    const one = withTypes({ potatoes: 10 });
    expect(drawFood(one, 3)).toEqual([3, 0, 0, 0]);
    expect(one.food!.types.potatoes).toBeCloseTo(7);
    // Two types, one nearly out: as many average meals as it allows, the rest poor.
    const two = withTypes({ potatoes: 10, wheat: 0.5 });
    const q = drawFood(two, 3);
    expect(q[1]).toBeCloseTo(1);
    expect(q[0]).toBeCloseTo(2);
  });

  it("rations always cook into poor meals", () => {
    const s = withTypes({ potatoes: 5, wheat: 5 });
    cooked(s, 4, 2, 2);
    expect(s.food!.meals[0]).toBeCloseTo(2);
    expect(s.food!.meals[1]).toBeCloseTo(2);
  });

  it("the stocks by type follow the hole's raw food, whatever moves it", () => {
    const s = withTypes({ potatoes: 30, wheat: 10 });
    s.resources.rawFood = 20;
    reconcileFood(s);
    expect(s.food!.types.potatoes).toBeCloseTo(15);
    expect(s.food!.types.wheat).toBeCloseTo(5);
    s.resources.rawFood = 30;
    reconcileFood(s);
    expect(s.food!.types[FOOD.mixed.id]).toBeCloseTo(10);
  });

  it("varied meals lift everyone's comfort; rations alone weigh on it", () => {
    const s = createInitialState(config);
    expect(variety(s)).toBeNull();
    s.food = { types: {}, meals: [0, 0, 0, 0], eaten: [20, 0, 0, 0] };
    expect(variety(s)!.rating).toBe(0);
    expect(varietyComfort(s)).toBe(FOOD.qualities[0]!.comfort);
    s.food.eaten = [0, 0, 2, 18];
    expect(variety(s)!.rating).toBe(3);
    expect(homeParts(s, null, config).find((p) => p.id === "variety")?.value).toBe(FOOD.qualities[3]!.comfort);
  });

  it("a galley cooking several crops makes better meals, and the hole rates its variety from what's eaten", () => {
    const s = createInitialState(config);
    s.drill.active = false;
    build(s, "galley", ring(1, 1, 3));
    s.resources.rations = 0;
    s.resources.rawFood = 120;
    s.food = { types: { potatoes: 30, wheat: 30, soybeans: 30, leafyGreens: 30 }, meals: [0, 0, 0, 0], eaten: [0, 0, 0, 0] };
    days(s, 1);
    const v = variety(s)!;
    expect(v.rating).toBe(3);
    expect(v.shares[3]).toBeGreaterThan(0.9);
  });
});

describe("citizen visits about meals", () => {
  /** A hole past the first week whose people have eaten nothing but `quality` meals this past month. */
  const eating = (quality: number): SimState => {
    const s = createInitialState(config);
    s.drill.active = false;
    s.tick = 10 * config.ticksPerDay;
    const eaten = [0, 0, 0, 0];
    eaten[quality] = s.population.count;
    s.food = { types: {}, meals: [0, 0, 0, 0], eaten };
    return s;
  };
  // A few ticks: enough for the office to check, too few for the month's record to change much.
  const ticks = (s: SimState) => {
    for (let i = 0; i < 20; i++) step(s, config);
  };

  it("only poor meals bring someone to the office, naming crops to grow; the promise is kept once meals improve", () => {
    const s = eating(0);
    ticks(s);
    const v = s.office.waiting.find((x) => x.kind === "poor_meals")!;
    expect(v).toBeDefined();
    expect(v.text).toMatch(/We could grow potatoes, soybeans or wheat/);
    expect(applyCommand(s, { type: "answerVisit", visitId: v.id, choice: "promise" }).ok).toBe(true);
    expect(s.office.promises.some((p) => p.check === "varietyUp")).toBe(true);
    s.food!.eaten = [0, s.population.count, 0, 0];
    ticks(s);
    expect(s.office.promises.some((p) => p.check === "varietyUp")).toBe(false);
  });

  it("only average meals bring a different visitor", () => {
    const s = eating(1);
    ticks(s);
    expect(s.office.waiting.some((x) => x.kind === "average_meals")).toBe(true);
    expect(s.office.waiting.some((x) => x.kind === "poor_meals")).toBe(false);
  });

  it("good meals bring nobody", () => {
    const s = eating(2);
    ticks(s);
    expect(s.office.waiting.some((x) => x.kind.endsWith("_meals"))).toBe(false);
  });
});
