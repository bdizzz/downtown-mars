import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config as baseConfig, type SimConfig } from "../src/sim/config";
import { deserialize, serialize } from "../src/sim/save";
import { makeSnapshot } from "../src/sim/snapshot";
import type { SimState } from "../src/sim/state";
import { step } from "../src/sim/step";
import { GREETER, visitDef } from "../src/sim/visits";
import { createWorld } from "../src/sim/world";
import { guided } from "../src/ui/guided";
import { CHECKS, tutorial } from "../src/ui/tutorialGoals";

// The tutorial's office step brings someone to say hello (T-080).

const config: SimConfig = { ...baseConfig, earth: { ...baseConfig.earth, firstDropDay: 1e6 } };
const flags = { sawNoise: false, openedFlows: false, sawThreeD: false };

function runDays(s: SimState, days: number) {
  for (let i = 0; i < days * config.ticksPerDay; i++) {
    s.resources.meals = 500;
    s.resources.water = 500;
    step(s, config);
  }
}

const fresh = () => createWorld(config, 7).holes[0]!;

describe("the tutorial's greeter", () => {
  it("never comes on their own", () => {
    const s = fresh();
    runDays(s, 10);
    expect(s.office.waiting.some((v) => v.kind === GREETER)).toBe(false);
  });

  it("comes when sent for, and isn't the deputy", () => {
    const s = fresh();
    s.office.waiting = [];
    expect(applyCommand(s, { type: "greet" })).toEqual({ ok: true });
    const v = s.office.waiting.find((x) => x.kind === GREETER)!;
    expect(v).toBeDefined();
    expect(v.notableId).not.toBe(s.notables[0]!.id);
    expect(v.leavesTick).toBeUndefined();
    expect(v.text).toContain(s.notables.find((n) => n.id === v.notableId)!.name);
  });

  it("doesn't come when someone's already waiting, or twice", () => {
    const s = fresh();
    s.office.waiting = [];
    applyCommand(s, { type: "greet" });
    applyCommand(s, { type: "greet" });
    expect(s.office.waiting.length).toBe(1);
  });

  it("waits as long as it takes, and saying goodbye meets the office step", () => {
    const s = fresh();
    s.office.waiting = [];
    applyCommand(s, { type: "greet" });
    runDays(s, 30);
    const v = s.office.waiting.find((x) => x.kind === GREETER)!;
    expect(v).toBeDefined();
    expect(CHECKS.visit!(makeSnapshot(s, config), flags)).toBe(false);
    const choice = visitDef(GREETER).choices[0]!.id;
    expect(applyCommand(s, { type: "answerVisit", visitId: v.id, choice })).toEqual({ ok: true });
    expect(CHECKS.visit!(makeSnapshot(s, config), flags)).toBe(true);
  });

  it("is kept in the save, still waiting", () => {
    const world = createWorld(config, 7);
    const s = world.holes[0]!;
    s.office.waiting = [];
    applyCommand(s, { type: "greet" });
    const back = deserialize(serialize(world));
    const v = back.ok ? back.world.holes[0]!.office.waiting[0] : undefined;
    expect(v?.kind).toBe(GREETER);
    expect(v?.leavesTick).toBeUndefined();
  });

  it("is what both tutorials' office steps wait for", () => {
    expect(tutorial.goals.some((g) => g.id === "visit")).toBe(true);
    expect(guided.steps.find((x) => x.id === "office")?.check).toBe("visit");
  });
});
