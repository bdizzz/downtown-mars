import { describe, expect, it } from "vitest";
import { careFactors } from "../src/sim/care";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { cryptSpace, people, RETURN_TO_SOIL } from "../src/sim/people";
import { createInitialState, type SimState } from "../src/sim/state";
import { step } from "../src/sim/step";

const at = (slot: number) => ({ kind: "ring" as const, floor: 1, ring: 1, slot, w: 2, d: 1 });

/** A hole with a few elders about to pass away. */
function elders(n = 3): SimState {
  const s = createInitialState(config);
  s.drill.active = false;
  s.earth.nextDropTick = 1e9;
  Object.assign(s.resources, { brick: 100, rock: 100, metal: 50 });
  s.unlocks = ["elders"];
  s.population.cohorts.push({ stage: "elder", count: n, until: 3 });
  s.population.count += n;
  return s;
}

describe("the composter", () => {
  it("turns organic waste and black water into soil", () => {
    const s = createInitialState(config);
    s.drill.active = false;
    Object.assign(s.resources, { organicWaste: 40, blackWater: 20, soil: 0 });
    expect(applyCommand(s, { type: "build", room: "composter", at: at(1) }).ok).toBe(true);
    for (let i = 0; i < config.ticksPerDay; i++) step(s, config);
    expect(s.resources.soil).toBeGreaterThan(2);
  });
});

describe("the departed", () => {
  it("rest in a crypt, which fills for good", () => {
    const s = elders();
    expect(applyCommand(s, { type: "build", room: "crypt", at: at(1) }).ok).toBe(true);
    const space = cryptSpace(s);
    for (let i = 0; i < 5; i++) step(s, config);
    expect(s.population.interred).toBe(3);
    expect(cryptSpace(s)).toBe(space - 3);
    expect(s.messages.at(-1)?.text).toMatch(/rest in the crypt/);
    expect(s.population.grief ?? 0).toBe(0);
  });

  it("with nowhere to rest, the hole grieves; the grief fades", () => {
    const s = elders();
    for (let i = 0; i < 5; i++) step(s, config);
    expect(s.population.grief).toBeCloseTo(3, 1);
    expect(careFactors(s).comfort).toBeCloseTo(-3 * people.death.griefPerUnrested, 1);
    expect(s.messages.at(-1)?.text).toMatch(/no crypt/);
    for (let i = 0; i < 30 * config.ticksPerDay; i++) step(s, config);
    expect(s.population.grief ?? 0).toBeLessThan(0.2);
  });

  it("under Return to the soil, the dead become soil for the farms", () => {
    const s = elders();
    s.ordinances.push("return_to_soil");
    s.resources.soil = 0;
    for (let i = 0; i < 5; i++) step(s, config);
    expect(s.resources.soil).toBeGreaterThanOrEqual(3 * people.death.soilPerPerson - 1);
    expect(s.ledger.current.soil?.in[RETURN_TO_SOIL]).toBe(3 * people.death.soilPerPerson);
    expect(s.population.grief ?? 0).toBe(0);
  });

  it("the crypt unlocks with the first elders", () => {
    const s = createInitialState(config);
    Object.assign(s.resources, { brick: 100, rock: 100 });
    expect(applyCommand(s, { type: "build", room: "crypt", at: at(1) }).ok).toBe(false);
  });
});
