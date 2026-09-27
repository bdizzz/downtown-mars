import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { makeSnapshot } from "../src/sim/snapshot";
import { createInitialState } from "../src/sim/state";
import { CHECKS, tutorial } from "../src/ui/tutorialGoals";
import { run } from "./bot";

const flags = { sawNoise: true, openedFlows: true, sawThreeD: true };

describe("tutorial", () => {
  it("every goal has a check", () => {
    for (const g of tutorial.goals) expect(CHECKS[g.id], g.id).toBeTypeOf("function");
  });

  it("nothing is done at the start (except UI-only goals)", () => {
    const s = makeSnapshot(createInitialState(config), config);
    const done = tutorial.goals.filter((g) => CHECKS[g.id]!(s, { sawNoise: false, openedFlows: false, sawThreeD: false }));
    expect(done).toEqual([]);
  });

  it("a colony played like the docs' first 30 minutes meets every goal", () => {
    const { state } = run(15);
    const snap = makeSnapshot(state, config);
    const missing = tutorial.goals.filter((g) => !CHECKS[g.id]!(snap, flags)).map((g) => g.id);
    expect(missing).toEqual([]);
  });
});
