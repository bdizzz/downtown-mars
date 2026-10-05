import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { makeSnapshot } from "../src/sim/snapshot";
import { createInitialState } from "../src/sim/state";
import { CHECKS, tutorial } from "../src/ui/tutorialGoals";
import { run } from "./bot";
import { construction } from "../src/sim/construction";
import { storage } from "../src/sim/storage";

const flags = { sawNoise: true, openedFlows: true, sawThreeD: true };

// Played with construction time and storage limits, as in the game (each test file has its own copy of the setting).
construction.instant = false;
storage.unlimited = false;

describe("tutorial", () => {
  it("every goal has a check", () => {
    for (const g of tutorial.goals) expect(CHECKS[g.id], g.id).toBeTypeOf("function");
  });

  it("nothing is done at the start (except UI-only goals)", () => {
    const s = makeSnapshot(createInitialState(config), config);
    const done = tutorial.goals.filter((g) => CHECKS[g.id]!(s, { sawNoise: false, openedFlows: false, sawThreeD: false }));
    expect(done).toEqual([]);
  });

  it("a kitchen plus a canteen counts as a galley; a kitchen alone doesn't", () => {
    const s = makeSnapshot(createInitialState(config), config);
    const room = (type: string) => ({ ...s.layout.rooms[0]!, type });
    const rooms = (...types: string[]) => ({ ...s, layout: { ...s.layout, rooms: types.map(room) } });
    expect(CHECKS.galley!(rooms("kitchen"), flags)).toBe(false);
    expect(CHECKS.galley!(rooms("canteen"), flags)).toBe(false);
    expect(CHECKS.galley!(rooms("kitchen", "canteen"), flags)).toBe(true);
    expect(CHECKS.galley!(rooms("galley"), flags)).toBe(true);
  });

  it("a colony played like the docs' first 30 minutes meets every goal", () => {
    const { state } = run(15);
    const snap = makeSnapshot(state, config);
    const missing = tutorial.goals.filter((g) => !CHECKS[g.id]!(snap, flags)).map((g) => g.id);
    expect(missing).toEqual([]);
  });
});
