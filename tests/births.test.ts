import { describe, expect, it } from "vitest";
import { birthBlockers, birthsPerDay } from "../src/sim/births";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { people, setAdults, stageCounts } from "../src/sim/people";
import { createInitialState, type SimState } from "../src/sim/state";
import { step } from "../src/sim/step";

const day = config.ticksPerDay;

/** A calm hole with a clinic, spare beds and plenty of everything. */
function nursery(): SimState {
  const s = createInitialState(config);
  s.drill.active = false;
  s.earth.nextDropTick = 1e9;
  Object.assign(s.resources, { brick: 100, metal: 100, electronics: 20, rock: 200 });
  const build = (room: string, slot: number, w = 1) => {
    const r = applyCommand(s, { type: "build", room, at: { kind: "ring", floor: 1, ring: 1, slot, w, d: 1 } });
    if (!r.ok) throw new Error(`${room}: ${r.reason}`);
  };
  build("clinic", 1);
  build("bunk_dorm", 2, 2);
  return s;
}

/** Keep everyone comfortable so only the rule under test matters. */
function run(s: SimState, ticks: number) {
  for (let i = 0; i < ticks; i++) {
    Object.assign(s.resources, { o2: 200, water: 200, meals: 60, power: 50 });
    s.happiness.average = Math.max(s.happiness.average, 70);
    step(s, config);
    s.happiness.average = Math.max(s.happiness.average, 70);
  }
}

describe("births", () => {
  it("are held back without a clinic, in an unhappy hole, or with no free beds", () => {
    const s = createInitialState(config);
    step(s, config);
    expect(birthBlockers(s)).toContain("No working clinic");
    expect(birthBlockers(s)).toContain("No free beds");
    s.happiness.average = 40;
    expect(birthBlockers(s).join()).toMatch(/Happiness 40 is below/);
  });

  it("come at a steady rate once a hole can look after children", () => {
    const s = nursery();
    run(s, 2);
    expect(birthBlockers(s)).toEqual([]);
    const expected = birthsPerDay(s) * 10;
    run(s, 10 * day);
    expect(s.population.born).toBeGreaterThanOrEqual(Math.floor(expected) - 1);
    expect(stageCounts(s).child).toBe(s.population.born);
    expect(s.messages.some((m) => /first child is born/.test(m.text))).toBe(true);
  });

  it("children of the same day share a cohort, and grow into working adults", () => {
    const s = nursery();
    setAdults(s, 20, config);
    s.population.cohorts.push({ stage: "child", count: 3, until: s.tick + 5 });
    s.population.count += 3;
    run(s, 6);
    const st = stageCounts(s);
    expect(st.adult).toBeGreaterThanOrEqual(23);
    expect(s.messages.some((m) => /grown up on Mars/.test(m.text))).toBe(true);
    const grownUp = s.population.cohorts.filter((c) => c.stage === "adult").map((c) => c.until - s.tick);
    expect(Math.max(...grownUp)).toBeLessThanOrEqual(people.adult.workSpanDays[1] * day);
  });

  it("stop when the beds run out", () => {
    const s = nursery();
    s.population.cohorts.push({ stage: "child", count: 16, until: 1e9 });
    s.population.count += 16;
    run(s, 2);
    expect(birthBlockers(s)).toContain("No free beds");
    const born = s.population.born ?? 0;
    run(s, 5 * day);
    expect(s.population.born ?? 0).toBe(born);
  });
});
