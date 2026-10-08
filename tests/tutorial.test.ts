import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { makeSnapshot } from "../src/sim/snapshot";
import { createInitialState } from "../src/sim/state";
import { advanceStep, CHECKS, FOLLOW, pickGoal, shownGoal, tutorial } from "../src/ui/tutorialGoals";
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

  describe("stepping through goals", () => {
    const F = false;
    const T = true;

    it("follows the first unmet goal until a step is picked", () => {
      expect(shownGoal(FOLLOW, [T, F, F])).toBe(1);
      expect(advanceStep(FOLLOW, [T, T, F])).toBe(FOLLOW);
      expect(shownGoal(FOLLOW, [T, T, F])).toBe(2);
    });

    it("stays on a picked step when another goal is met", () => {
      const step = pickGoal(3, [F, F, F, F, F]);
      expect(shownGoal(step, [F, F, F, F, F])).toBe(3);
      expect(advanceStep(step, [T, F, F, F, F])).toBe(step);
    });

    it("meeting the picked goal moves on to the next unmet one, round to the start", () => {
      const step = pickGoal(3, [F, F, F, F, T]);
      const next = advanceStep(step, [F, F, F, T, T]);
      expect(shownGoal(next, [F, F, F, T, T])).toBe(0);
    });

    it("browsing back to a done goal stays there, and the arrows wrap", () => {
      const met = [T, F, F];
      const back = pickGoal(0, met);
      expect(advanceStep(back, met)).toBe(back);
      expect(shownGoal(back, met)).toBe(0);
      expect(pickGoal(-1, met).at).toBe(2);
      expect(pickGoal(3, met).at).toBe(0);
    });

    it("ends when every goal is met, whatever step is picked", () => {
      expect(shownGoal(pickGoal(1, [T, T, T]), [T, T, T])).toBe(-1);
    });
  });

  it("a colony played like the docs' first 30 minutes meets every goal", () => {
    const { state } = run(15);
    const snap = makeSnapshot(state, config);
    const missing = tutorial.goals.filter((g) => !CHECKS[g.id]!(snap, flags)).map((g) => g.id);
    expect(missing).toEqual([]);
  });
});
