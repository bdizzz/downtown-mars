import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config as baseConfig, type SimConfig } from "../src/sim/config";
import { eventData, eventsOf, rollDiscovery } from "../src/sim/events";
import { deserialize, serialize } from "../src/sim/save";
import { makeSnapshot } from "../src/sim/snapshot";
import { createInitialState, type SimState } from "../src/sim/state";
import { step } from "../src/sim/step";
import { createWorld } from "../src/sim/world";
import { guideAt, guided, nextGuide, startGuide, stepMet, stepSpeed } from "../src/ui/guided";
import { CHECKS } from "../src/ui/tutorialGoals";
import { HUD_IDS } from "../src/view/hudItems";
import { roomDef } from "../src/sim/rooms";
import { nextSpeed } from "../src/ui/Hud";
import { revealFor } from "../src/ui/reveal";
import { FIELD_TYPES } from "../src/sim/effects";

// The guided tutorial (F-007, T-083): steps in data, their unlocks, and the calm start.

// Storms every day from the first, and belt ships too, so a calm start has something to hold off.
const config: SimConfig = {
  ...baseConfig,
  earth: { ...baseConfig.earth, firstDropDay: 1e6 },
  weather: { ...baseConfig.weather, dustStorm: { ...baseConfig.weather.dustStorm, earliestDay: 0, chancePerDay: 1 } },
};
const belt = { ...eventData.beltShip };
beforeEach(() => Object.assign(eventData.beltShip, { fromDay: 0, chancePerDay: 1 }));
afterEach(() => Object.assign(eventData.beltShip, belt));

function runDays(s: SimState, days: number) {
  for (let i = 0; i < days * config.ticksPerDay; i++) {
    s.resources.meals = 500;
    s.resources.water = 500;
    step(s, config);
  }
}

describe("the guided tutorial's data", () => {
  it("checks only goals the tutorial knows, and is calm until a step it has", () => {
    for (const s of guided.steps) if (s.check) expect(CHECKS[s.check], s.id).toBeTruthy();
    expect(guided.steps.some((s) => s.id === guided.calmUntil)).toBe(true);
    expect(new Set(guided.steps.map((s) => s.id)).size).toBe(guided.steps.length);
  });

  it("unlocks only interface elements that exist", () => {
    const modes = ["build", "view", "charts", "map"];
    const charts = ["people", "flows", "network", "construction", "maintenance", "trends", "directory", "milestones"];
    const views = ["cameras", "2d", "see"];
    const tools = ["corridors", "demolish", "linings", "bulkhead", "windows", "refit"];
    for (const s of guided.steps) {
      expect(["slow", "read"]).toContain(s.pace);
      for (const u of s.unlocks) {
        const [kind, id] = u.split(":");
        const known =
          (id === "*" && ["hud", "mode", "room", "tool", "view", "overlay", "chart"].includes(kind!)) ||
          (kind === "hud" && ([...HUD_IDS, "floors"] as string[]).includes(id!)) ||
          (kind === "mode" && modes.includes(id!)) ||
          (kind === "room" && !!roomDef(id!)) ||
          (kind === "overlay" && [...FIELD_TYPES, "happiness", "condition"].includes(id!)) ||
          (kind === "tool" && tools.includes(id!)) ||
          (kind === "view" && views.includes(id!)) ||
          (kind === "chart" && charts.includes(id!));
        expect(known, `${s.id}: ${u}`).toBe(true);
      }
    }
  });

  it("points only at what's already on screen", () => {
    // Highlights named for where they lead: Flows is a Charts button; the 3D view is View's.
    const shownAs: Record<string, string> = { "hud:flows": "chart:flows", "hud:view": "mode:view" };
    guided.steps.forEach((s, i) => {
      if (!s.highlight) return;
      expect(revealFor(guideAt(i)).shown(shownAs[s.highlight] ?? s.highlight), `${s.id}: ${s.highlight}`).toBe(true);
    });
  });

  it("introduces every room it asks for before asking", () => {
    guided.steps.forEach((s, i) => {
      const room = s.check && { galley: "galley", restroom: "restroom", dorm: "bunk_dorm", farm: "farm" }[s.check];
      if (room) expect(revealFor(guideAt(i)).shown(`room:${room}`), s.id).toBe(true);
    });
  });
});

describe("the interface the guide reveals", () => {
  it("is everything outside the guide, and once it's over", () => {
    expect(revealFor(null).shown("mode:map")).toBe(true);
    expect(revealFor(guideAt(guided.steps.length)).shown("mode:map")).toBe(true);
  });

  it("starts with only the first step's, and adds as it goes", () => {
    const first = revealFor(startGuide());
    for (const u of guided.steps[0]!.unlocks) expect(first.shown(u)).toBe(true);
    expect(first.shown("mode:build")).toBe(false);
    expect(first.shown("room:galley")).toBe(false);
    expect(first.shown("hud:office")).toBe(false);
    const galley = guided.steps.findIndex((s) => s.id === "galley");
    const at = revealFor(guideAt(galley));
    expect(at.shown("mode:build") && at.shown("room:galley")).toBe(true);
    expect(at.shown("room:farm")).toBe(false);
    // Only what this step brought glows.
    expect(at.fresh("room:galley")).toBe(true);
    expect(at.fresh("hud:speed")).toBe(false);
  });

  it("takes <kind>:* for every one of a kind", () => {
    const r = revealFor({ step: 0, unlocked: ["overlay:*"], calm: true });
    expect(r.shown("overlay:noise") && r.shown("overlay:smell")).toBe(true);
    expect(r.shown("room:galley")).toBe(false);
  });
});

describe("the guided tutorial's steps", () => {
  it("record what each step unlocks, and stay calm until the basics are done", () => {
    const g0 = startGuide();
    expect(g0).toEqual({ step: 0, unlocked: guided.steps[0]!.unlocks, calm: true });
    const g1 = nextGuide(g0);
    expect(g1.unlocked).toEqual([...guided.steps[0]!.unlocks, ...guided.steps[1]!.unlocks]);
    const calmEnd = guided.steps.findIndex((s) => s.id === guided.calmUntil);
    expect(guideAt(calmEnd).calm).toBe(true);
    expect(guideAt(calmEnd + 1).calm).toBe(false);
  });

  it("pause to read, run slow otherwise, and go back to 1× when done", () => {
    expect(stepSpeed({ ...guided.steps[0]!, pace: "read" })).toBe(0);
    expect(stepSpeed({ ...guided.steps[0]!, pace: "slow" })).toBe(config.slowSpeed);
    expect(stepSpeed(null)).toBe(1);
    expect(config.slowSpeed).toBeLessThan(1);
    // + from the slow pace goes to 1×, not past it.
    expect(nextSpeed(config.slowSpeed, 1)).toBe(1);
  });

  it("are met by their checks; a step to read never is", () => {
    const s = createInitialState(config);
    const read = guided.steps.find((x) => !x.check)!;
    const galley = guided.steps.find((x) => x.check === "galley")!;
    const flags = { sawNoise: true, openedFlows: true, sawThreeD: true };
    expect(stepMet(read, makeSnapshot(s, config), flags)).toBe(false);
    expect(stepMet(galley, makeSnapshot(s, config), flags)).toBe(false);
  });
});

describe("the calm start", () => {
  it("holds off storms and belt ships while it lasts", () => {
    const s = createInitialState(config);
    expect(applyCommand(s, { type: "setGuide", guide: startGuide() })).toEqual({ ok: true });
    runDays(s, 30);
    expect(s.weather?.storm).toBeUndefined();
    expect(eventsOf(s).lastTick.belt_ship).toBeUndefined();
    expect(makeSnapshot(s, config).guide?.calm).toBe(true);
  });

  it("lets them come once the basics are done", () => {
    const s = createInitialState(config);
    applyCommand(s, { type: "setGuide", guide: guideAt(guided.steps.length) });
    runDays(s, 30);
    expect(s.weather?.storm).toBeDefined();
    expect(eventsOf(s).lastTick.belt_ship).toBeDefined();
  });

  it("strikes nothing while digging, and the first find still comes after", () => {
    const s = createInitialState(config);
    applyCommand(s, { type: "setGuide", guide: startGuide() });
    rollDiscovery(s, config, 2);
    expect(eventsOf(s).pending).toEqual([]);
    applyCommand(s, { type: "setGuide", guide: null });
    expect(s.guide).toBeUndefined();
    rollDiscovery(s, config, 2);
    if (eventData.discoveries.firstAlways) expect(eventsOf(s).pending.length).toBe(1);
  });

  it("is kept in the save", () => {
    const world = createWorld(config, 7);
    applyCommand(world.holes[0]!, { type: "setGuide", guide: nextGuide(startGuide()) });
    const back = deserialize(serialize(world));
    expect(back.ok && back.world.holes[0]!.guide).toEqual(nextGuide(startGuide()));
  });
});
