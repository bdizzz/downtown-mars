import { describe, expect, it } from "vitest";
import { applyCommand, CONSOLE } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { holeGates } from "../src/sim/people";
import { capacities } from "../src/sim/economy";
import { createInitialState } from "../src/sim/state";
import { construction } from "../src/sim/construction";

/** With construction taking time (the test setup makes it instant). */
function withConstruction(f: () => void) {
  construction.instant = false;
  try {
    f();
  } finally {
    construction.instant = true;
  }
}

describe("console commands", () => {
  it("builds a showcase colony: dug, filled with built rooms, everyone connected", () => {
    const s = createInitialState(config);
    expect(applyCommand(s, { type: "consoleShowcase", floors: 6 }).ok).toBe(true);
    const layout = s.layout;
    expect(layout.hole.floors).toBe(6);
    expect(layout.rooms.length).toBeGreaterThan(6 * 10);
    expect(layout.rooms.some((r) => r.planned || r.building)).toBe(false);
    for (let floor = 1; floor <= 6; floor++) expect(layout.rooms.some((r) => r.type === "stairwell" && r.cells.some((c) => c.floor === floor))).toBe(true);
    expect(layout.rooms.filter((r) => !r.connected).length).toBe(0);
  });

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

  it("finishes the construction queue at once", () => {
    withConstruction(() => {
      const s = createInitialState(config);
      Object.assign(s.resources, { rock: 500, metal: 200, brick: 200 });
      const r = applyCommand(s, { type: "build", room: "galley", at: { kind: "ring", floor: 1, ring: 1, slot: 3, w: 1, d: 1 } });
      expect(r.ok).toBe(true);
      const room = s.layout.rooms.find((x) => x.id === (r.ok ? r.roomId : -1))!;
      expect(room.building).toBe(true);
      expect(applyCommand(s, { type: "consoleFinish" }).ok).toBe(true);
      expect(room.building).toBeFalsy();
      expect(s.construction.queue).toHaveLength(0);
      expect(applyCommand(s, { type: "consoleFinish" }).ok).toBe(false);
    });
  });
});
