import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config, type SimConfig } from "../src/sim/config";
import type { Location } from "../src/sim/placement";
import { createInitialState, type SimState } from "../src/sim/state";
import { step } from "../src/sim/step";
import { setAdults } from "../src/sim/people";

const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });
const noDelays: SimConfig = { ...config, earth: { ...config.earth, delayChance: 0 } };
const ticks = (s: SimState, n: number, cfg = noDelays) => {
  for (let i = 0; i < n; i++) step(s, cfg);
};
const firstDrop = config.earth.firstDropDay * config.ticksPerDay;

function start(): SimState {
  const s = createInitialState(noDelays);
  s.drill.active = false;
  return s;
}

describe("Earth supply drops", () => {
  it("the first drop lands on schedule and says what it brought", () => {
    const s = start();
    ticks(s, firstDrop - 1);
    expect(s.messages.some((m) => m.text.startsWith("Supply drop"))).toBe(false);
    const metal = s.resources.metal!;
    ticks(s, 1);
    expect(s.resources.metal).toBe(metal + config.earth.fixed.metal!);
    const landed = s.messages.find((m) => m.text.startsWith("Supply drop landed"));
    expect(landed).toMatchObject({ kind: "good" });
    expect(landed!.text).toMatch(/metal 25/);
  });

  it("tops up rations to cover the food gap", () => {
    const s = start();
    ticks(s, firstDrop);
    // 20 colonists × 1 meal × (4 + 1) days, with no farms yet.
    expect(s.resources.rations! + s.resources.meals!).toBeGreaterThanOrEqual(99);
  });

  it("brings colonists only when there are free beds", () => {
    const s = start();
    ticks(s, firstDrop);
    expect(s.population.count).toBe(20); // the pod is full
    applyCommand(s, { type: "build", room: "bunk_dorm", at: ring(1, 1, 1, 2) });
    for (let i = 0; i < config.earth.intervalDays * config.ticksPerDay; i++) {
      s.population.health = 100; // this hole has no galley or life support; beds are the point here
      ticks(s, 1);
    }
    expect(s.population.count).toBe(20 + config.earth.colonistsPerDrop);
  });

  it("sends nobody into a hole whose people are in poor health", () => {
    const s = start();
    applyCommand(s, { type: "build", room: "bunk_dorm", at: ring(1, 1, 1, 2) });
    for (let i = 0; i < firstDrop; i++) {
      s.population.health = config.earth.colonistsNeedHealth - 10;
      ticks(s, 1);
    }
    expect(s.population.count).toBe(20);
    expect(s.messages.some((m) => /Supply drop landed/.test(m.text))).toBe(true); // supplies still come
  });

  // T-161: a dwindling hole in poor health still gets a few replacements, some of the time.
  const rescue = config.earth.rescue;
  const poorHealthDrops = (s: SimState, drops: number) => {
    for (let i = 0; i < firstDrop + (drops - 1) * config.earth.intervalDays * config.ticksPerDay; i++) {
      s.population.health = config.earth.colonistsNeedHealth - 20;
      ticks(s, 1);
    }
  };

  it("sends a dwindling hole replacements now and then, whatever its health", () => {
    const s = start();
    setAdults(s, 10, config);
    poorHealthDrops(s, 6);
    const rescues = s.messages.filter((m) => /replacement colonists/.test(m.text));
    expect(rescues.length).toBeGreaterThan(0);
    expect(rescues.length).toBeLessThan(6); // half of drops, not every one
    expect(s.population.count).toBeGreaterThanOrEqual(10 + rescue.colonists);
    expect(s.population.count).toBeLessThan(rescue.belowPopulation + rescue.colonists);
  });

  it("sends no replacements without free beds, or into an empty hole", () => {
    // Always a rescue, however many there are: only beds and people to open up can stop it.
    const always: SimConfig = { ...noDelays, earth: { ...noDelays.earth, rescue: { ...rescue, belowPopulation: 1000, chance: 1 } } };
    const full = start(); // the pod's beds are all taken
    for (let i = 0; i < firstDrop; i++) {
      full.population.health = 0;
      step(full, always);
    }
    expect(full.messages.some((m) => /Supply drop landed/.test(m.text))).toBe(true);
    expect(full.population.count).toBe(config.colonists.start);

    const empty = start();
    setAdults(empty, 0, config);
    for (let i = 0; i < firstDrop; i++) step(empty, always);
    expect(empty.population.count).toBe(0);
  });

  it("sizes the top-ups for the colonists who just arrived", () => {
    const s = start();
    applyCommand(s, { type: "build", room: "bunk_dorm", at: ring(1, 1, 1, 2) });
    s.resources.rations = 0;
    ticks(s, firstDrop);
    const food = (s.resources.rations ?? 0) + (s.resources.meals ?? 0) + (s.resources.rawFood ?? 0);
    // Everyone × (4 + 1) days, less what they've eaten since landing.
    const pop = 20 + config.earth.colonistsPerDrop;
    expect(s.population.count).toBe(pop);
    expect(food).toBeGreaterThan(pop * 5 - 5);
  });

  it("waits in orbit without a working landing pad", () => {
    const s = start();
    setAdults(s, 0, config); // nobody to staff the pad
    const metal = s.resources.metal;
    ticks(s, firstDrop + 5, { ...noDelays, failure: { emptyDays: 100 } }); // an empty hole would fail first (T-162)
    expect(s.resources.metal).toBe(metal);
    expect(s.earth.waiting).toBe(true);
    expect(s.messages.find((m) => /orbit/.test(m.text))).toMatchObject({ kind: "warn" });
  });

  it("can be delayed a day, but only once per drop", () => {
    const always: SimConfig = { ...config, earth: { ...config.earth, delayChance: 1 } };
    const s = createInitialState(always);
    ticks(s, firstDrop, always);
    expect(s.messages.some((m) => /delayed/.test(m.text))).toBe(true);
    expect(s.messages.some((m) => /landed/.test(m.text))).toBe(false);
    ticks(s, config.ticksPerDay, always);
    expect(s.messages.some((m) => /landed/.test(m.text))).toBe(true);
  });

  it("shrinks the water top-up once the hole makes its own", () => {
    const a = start();
    ticks(a, firstDrop);
    const b = start();
    b.resources.water = 400; // well stocked: less to send
    ticks(b, firstDrop);
    const landed = (s: SimState) => s.messages.find((m) => m.text.startsWith("Supply drop landed"))!.text;
    const sent = (s: SimState) => Number(/water (\d+)/.exec(landed(s))?.[1] ?? 0);
    expect(sent(b)).toBeLessThan(sent(a));
  });
});
