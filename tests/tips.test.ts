import { describe, expect, it } from "vitest";
import tutorialData from "../data/tutorial.json";
import { applyCommand } from "../src/sim/commands";
import { config as baseConfig, type SimConfig } from "../src/sim/config";
import { deserialize, serialize } from "../src/sim/save";
import { makeSnapshot } from "../src/sim/snapshot";
import { createInitialState, type SimState } from "../src/sim/state";
import { step } from "../src/sim/step";
import { createWorld } from "../src/sim/world";
import { DIAGNOSIS } from "../src/sim/diagnosis";
import { dueTip, TIPS } from "../src/view/tips";

// The deputy's one-time tips (F-018, T-177).

const config: SimConfig = { ...baseConfig, earth: { ...baseConfig.earth, firstDropDay: 1e6 } };

/** Run, holding meals and water up (or not), for so many game hours. */
function run(s: SimState, hours: number, hold: (s: SimState) => void = () => {}) {
  for (let i = 0; i < hours * 10; i++) {
    hold(s);
    step(s, config);
  }
}

const fed = (s: SimState) => {
  s.resources.meals = 500;
  s.resources.water = 500;
};

describe("the deputy's tips", () => {
  it("name only causes the diagnosis knows", () => {
    for (const t of TIPS) {
      for (const c of t.causes) {
        const [kind, id] = c.split(":");
        expect(kind === "health" ? DIAGNOSIS.health[id!] : DIAGNOSIS.happiness[id!], `${t.id}: ${c}`).toBeTruthy();
      }
    }
  });

  it("wait for the first months", () => {
    const s = createInitialState(config);
    run(s, 12, fed);
    expect(makeSnapshot(s, config).diagnosis.health.causes.some((c) => c.id === "sanitation")).toBe(true);
    expect(dueTip(makeSnapshot(s, config))).toBeNull();
  });

  it("explain restrooms when sanitation slips, once", () => {
    const s = createInitialState(config);
    run(s, tutorialData.fromDay * 24, fed);
    const tip = dueTip(makeSnapshot(s, config))!;
    expect(tip.id).toBe("restrooms");
    expect(tip.cause).toBe("health:sanitation");
    expect(tip.name).toBe(s.notables[0]!.name);
    expect(applyCommand(s, { type: "seeTip", id: "restrooms" })).toEqual({ ok: true });
    expect(dueTip(makeSnapshot(s, config))?.id).not.toBe("restrooms");
  });

  it("explain meals when people go hungry", () => {
    const s = createInitialState(config);
    applyCommand(s, { type: "seeTip", id: "restrooms" });
    run(s, tutorialData.fromDay * 24, (h) => {
      h.resources.meals = 0;
      h.resources.rations = 0;
      h.resources.water = 500;
    });
    expect(dueTip(makeSnapshot(s, config))?.id).toBe("meals");
  });

  it("are remembered in the save", () => {
    const world = createWorld(config, 7);
    applyCommand(world.holes[0]!, { type: "seeTip", id: "bulkheads" });
    applyCommand(world.holes[0]!, { type: "seeTip", id: "bulkheads" });
    const back = deserialize(serialize(world));
    expect(back.ok && back.world.holes[0]!.tipsSeen).toEqual(["bulkheads"]);
  });
});
