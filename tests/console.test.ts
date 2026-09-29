import { describe, expect, it } from "vitest";
import { applyCommand, CONSOLE } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { holeGates } from "../src/sim/people";
import { capacities } from "../src/sim/economy";
import { createInitialState } from "../src/sim/state";

describe("console commands", () => {
  it("set and add resources, never below zero, recorded in the ledger", () => {
    const s = createInitialState(config);
    s.resources.metal = 10;
    expect(applyCommand(s, { type: "consoleResources", set: { rock: 500 }, add: { metal: 40 } }).ok).toBe(true);
    expect(s.resources.rock).toBe(500);
    expect(s.resources.metal).toBe(50);
    expect(s.ledger.current.metal!.in[CONSOLE]).toBe(40);
    applyCommand(s, { type: "consoleResources", add: { metal: -80 } });
    expect(s.resources.metal).toBe(0);
    expect(s.ledger.current.metal!.out[CONSOLE]).toBe(50);
  });

  it("makes room for more than the hole can hold, so it isn't thrown away", () => {
    const s = createInitialState(config);
    applyCommand(s, { type: "consoleResources", set: { metal: 5000 } });
    expect(capacities(s, config).metal).toBeGreaterThanOrEqual(5000);
  });

  it("refuses unknown resources and non-numbers, changing nothing", () => {
    const s = createInitialState(config);
    const rock = s.resources.rock;
    expect(applyCommand(s, { type: "consoleResources", set: { rock: 1, gold: 5 } }).ok).toBe(false);
    expect(applyCommand(s, { type: "consoleResources", set: { rock: Number.NaN } }).ok).toBe(false);
    expect(s.resources.rock).toBe(rock);
  });

  it("unlocks rooms that wait on a milestone, one gate or all", () => {
    const s = createInitialState(config);
    expect(applyCommand(s, { type: "consoleUnlock", gate: "cargo" }).ok).toBe(true);
    expect(holeGates(s)).toContain("cargo");
    expect(holeGates(s)).not.toContain("children");
    expect(applyCommand(s, { type: "consoleUnlock", gate: "dragons" }).ok).toBe(false);
    applyCommand(s, { type: "consoleUnlock" });
    expect(holeGates(s)).toEqual(expect.arrayContaining(["children", "elders", "cargo"]));
    // A deposit, only by name.
    expect(holeGates(s)).not.toContain("ore");
    applyCommand(s, { type: "consoleUnlock", gate: "ore" });
    expect(s.deposits).toContain("ore");
  });
});
