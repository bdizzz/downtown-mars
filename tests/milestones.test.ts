import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { raiseEvent, stepEvents } from "../src/sim/events";
import { milestoneData, milestonesOf } from "../src/sim/milestones";
import { deserialize, serialize } from "../src/sim/save";
import { makeSnapshot } from "../src/sim/snapshot";
import { createInitialState, type SimState } from "../src/sim/state";
import { createWorld } from "../src/sim/world";

// F-005 / T-055: one milestone catalog, tracked per hole with the day each was reached.

const day = config.ticksPerDay;

function hole(): SimState {
  const s = createInitialState(config);
  s.drill.active = false;
  return s;
}

describe("milestones", () => {
  it("the catalog holds the old celebrations, each in a known group", () => {
    const groups = new Set(milestoneData.groups.map((g) => g.id));
    for (const m of milestoneData.milestones) expect(groups.has(m.group)).toBe(true);
    expect(milestoneData.milestones.map((m) => m.id)).toEqual(expect.arrayContaining(["first_birth", "pop_50", "floor_5", "dome", "microfossils"]));
  });

  it("a new hole has reached none", () => {
    const s = hole();
    stepEvents(s, config);
    expect(s.milestones).toEqual([]);
  });

  it("is reached once, on the day it's passed, with the news", () => {
    const s = hole();
    s.tick = 10 * day;
    s.layout.hole.floors = 5;
    stepEvents(s, config);
    expect(s.milestones).toEqual([{ id: "floor_5", day: 11 }]);
    expect(s.messages.some((m) => m.text === "Milestone: five floors down." && m.kind === "good")).toBe(true);
    s.tick += day;
    stepEvents(s, config);
    expect(s.milestones).toHaveLength(1);
    expect(s.messages.filter((m) => m.text.startsWith("Milestone:")).length).toBe(1);
  });

  it("several at once are all reached, but celebrated one at a time", () => {
    const s = hole();
    s.layout.hole.floors = 10;
    stepEvents(s, config);
    expect(s.milestones!.map((m) => m.id)).toEqual(["floor_5", "floor_10"]);
    expect(s.events!.pending.filter((e) => e.kind === "celebration")).toHaveLength(1);
    s.events!.pending = [];
    s.tick += config.ticksPerDay;
    stepEvents(s, config);
    expect(s.events!.pending.find((e) => e.kind === "celebration")!.title).toMatch(/ten floors down/);
  });

  it("an event's milestone is reached by the event", () => {
    const s = hole();
    raiseEvent(s, config, "microfossils", { floor: 6 });
    expect(applyCommand(s, { type: "answerEvent", eventId: s.events!.pending[0]!.id, choice: "study" }).ok).toBe(true);
    expect(s.milestones!.map((m) => m.id)).toEqual(["microfossils"]);
    expect(s.milestones![0]!.day).not.toBeNull();
  });

  it("is saved, and shown in the snapshot", () => {
    const w = createWorld(config, 42);
    const h = w.holes[0]!;
    h.layout.hole.floors = 5;
    stepEvents(h, config);
    const back = deserialize(serialize(w));
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.world.holes[0]!.milestones).toEqual(h.milestones);
    expect(makeSnapshot(back.world.holes[0]!, config).milestones).toEqual(h.milestones);
  });

  it("an older save marks what it's already passed, day unknown, without news", () => {
    const s = hole();
    s.layout.hole.floors = 12;
    s.events!.celebrated = ["floor_5", "floor_10", "microfossils"];
    delete s.milestones;
    stepEvents(s, config);
    expect(s.milestones).toEqual([
      { id: "floor_5", day: null },
      { id: "floor_10", day: null },
      { id: "microfossils", day: null },
    ]);
    expect(s.messages.some((m) => m.text.startsWith("Milestone:"))).toBe(false);
    expect(s.events!.pending).toHaveLength(0);
  });

  it("an older save without events either catches up quietly", () => {
    const s = hole();
    s.layout.hole.floors = 5;
    delete s.milestones;
    delete s.events;
    expect(milestonesOf(s)).toEqual([{ id: "floor_5", day: null }]);
    stepEvents(s, config);
    expect(s.events!.celebrated).toEqual(["floor_5"]);
    expect(s.events!.pending).toHaveLength(0);
  });
});
