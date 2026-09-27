import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { needsWeight, people, stageCounts, takeAdults } from "../src/sim/people";
import { deserialize, serialize } from "../src/sim/save";
import { createInitialState } from "../src/sim/state";
import { step } from "../src/sim/step";
import { createWorld } from "../src/sim/world";

const day = config.ticksPerDay;

describe("cohorts", () => {
  it("the game starts with working adults only, in groups with their own spans", () => {
    const s = createInitialState(config);
    expect(stageCounts(s)).toEqual({ child: 0, adult: config.colonists.start, elder: 0 });
    expect(s.population.count).toBe(config.colonists.start);
    expect(s.population.cohorts).toHaveLength(Math.ceil(config.colonists.start / people.cohortSize));
    const [lo, hi] = people.adult.workSpanDays;
    for (const c of s.population.cohorts) {
      expect(c.until).toBeGreaterThanOrEqual(lo * day);
      expect(c.until).toBeLessThanOrEqual(hi * day);
    }
    expect(new Set(s.population.cohorts.map((c) => c.until)).size).toBeGreaterThan(1);
  });

  it("only adults staff rooms", () => {
    const s = createInitialState(config);
    s.population.cohorts.push({ stage: "child", count: 10, until: 1e9 });
    s.population.count += 10;
    step(s, config);
    expect(s.workforce.total).toBe(config.colonists.start);
  });

  it("volunteers are the youngest adults", () => {
    const s = createInitialState(config);
    const youngest = Math.max(...s.population.cohorts.map((c) => c.until));
    const taken = takeAdults(s, 3);
    expect(taken).toEqual([{ stage: "adult", count: 3, until: youngest }]);
    expect(s.population.count).toBe(config.colonists.start - 3);
  });

  it("Earth's arrivals are adults", () => {
    const s = createInitialState(config);
    s.drill.active = false;
    applyCommand(s, { type: "build", room: "bunk_dorm", at: { kind: "ring", floor: 1, ring: 1, slot: 1, w: 2, d: 1 } });
    for (let i = 0; i < 5 * day; i++) step(s, config);
    const st = stageCounts(s);
    expect(st.adult).toBe(s.population.count);
    expect(st.adult).toBeGreaterThan(config.colonists.start);
  });

  it("an old save's colonists become adults", () => {
    const w = createWorld(config);
    const file = JSON.parse(serialize(w));
    file.version = 9;
    for (const h of file.state.holes) h.population = { count: 33, health: 90, needsMet: {}, sanitation: 1 };
    const loaded = deserialize(JSON.stringify(file));
    expect(loaded.ok && stageCounts(loaded.world.holes[0]!)).toEqual({ child: 0, adult: 33, elder: 0 });
  });
});

describe("aging", () => {
  it("adults retire into elders at the end of their span, and elders pass away after theirs", () => {
    const s = createInitialState(config);
    s.drill.active = false;
    s.earth.nextDropTick = 1e9;
    const first = Math.min(...s.population.cohorts.map((c) => c.until));
    s.population.cohorts.forEach((c) => (c.until -= first - 5)); // bring retirement close
    for (let i = 0; i < 6; i++) step(s, config);
    const st = stageCounts(s);
    expect(st.elder).toBeGreaterThan(0);
    expect(st.adult + st.elder).toBe(config.colonists.start);
    expect(s.messages.at(-1)?.text).toMatch(/first colonists have retired/);
    step(s, config);
    expect(s.workforce.total).toBe(st.adult); // elders don't work
    const elder = s.population.cohorts.find((c) => c.stage === "elder")!;
    const [lo, hi] = people.elder.days;
    expect(elder.until - s.tick).toBeGreaterThanOrEqual(lo * day - 10);
    expect(elder.until - s.tick).toBeLessThanOrEqual(hi * day);
    const before = s.population.count;
    const leaving = elder.count;
    elder.until = s.tick + 1;
    step(s, config);
    expect(s.population.count).toBe(before - leaving);
    expect(s.messages.at(-1)?.text).toMatch(/passed away peacefully/);
  });

  it("children need less than adults", () => {
    const a = createInitialState(config);
    const b = createInitialState(config);
    b.population.cohorts = [{ stage: "child", count: config.colonists.start, until: 1e9 }];
    expect(needsWeight(b)).toBeCloseTo(needsWeight(a) * people.child.needsFactor);
  });
});
