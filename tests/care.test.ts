import { describe, expect, it } from "vitest";
import { careFactors, elderCoverage, schoolCoverage } from "../src/sim/care";
import { updateHappiness } from "../src/sim/happiness";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { createInitialState, type SimState } from "../src/sim/state";
import { step } from "../src/sim/step";

const at = (slot: number) => ({ kind: "ring" as const, floor: 1, ring: 1, slot, w: 2, d: 1 });

function withKids(children: number, elders = 0): SimState {
  const s = createInitialState(config);
  s.drill.active = false;
  s.earth.nextDropTick = 1e9;
  Object.assign(s.resources, { brick: 100, metal: 100 });
  s.population.cohorts.push({ stage: "child", count: children, until: 1e9 }, { stage: "elder", count: elders, until: 1e9 });
  s.population.count += children + elders;
  return s;
}

describe("school and elder care", () => {
  it("unlock with the first child and the first elder", () => {
    const s = withKids(0);
    expect(applyCommand(s, { type: "build", room: "school", at: at(1) })).toMatchObject({ ok: false, reason: expect.stringMatching(/first child/) });
    expect(applyCommand(s, { type: "build", room: "elder_care", at: at(1) })).toMatchObject({ ok: false, reason: expect.stringMatching(/retire/) });
    s.unlocks = ["children", "elders"];
    expect(applyCommand(s, { type: "build", room: "school", at: at(1) }).ok).toBe(true);
    expect(applyCommand(s, { type: "build", room: "elder_care", at: at(3) }).ok).toBe(true);
  });

  /** A tick, then the happiness update that shares out places within reach. */
  const settle = (s: ReturnType<typeof withKids>) => {
    step(s, config);
    updateHappiness(s, config, true);
    updateHappiness(s, config, true);
  };

  it("children without a school weigh on comfort; a school lifts it", () => {
    const s = withKids(10);
    settle(s);
    expect(schoolCoverage(s).missing).toBe(10);
    const without = careFactors(s).comfort;
    expect(without).toBeLessThan(-0.5);
    s.unlocks = ["children"];
    expect(applyCommand(s, { type: "build", room: "school", at: at(1) }).ok).toBe(true);
    settle(s);
    expect(schoolCoverage(s).missing).toBe(0);
    expect(careFactors(s).comfort).toBeCloseTo(0);
  });

  it("elders without care weigh on health; elder care lifts it", () => {
    const s = withKids(0, 8);
    settle(s);
    expect(elderCoverage(s).missing).toBe(8);
    expect(careFactors(s).health).toBeLessThan(-0.5);
    s.unlocks = ["elders"];
    expect(applyCommand(s, { type: "build", room: "elder_care", at: at(1) }).ok).toBe(true);
    settle(s);
    expect(careFactors(s).health).toBeCloseTo(0);
  });
});
