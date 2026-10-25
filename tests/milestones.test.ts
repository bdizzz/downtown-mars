import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { raiseEvent, stepEvents } from "../src/sim/events";
import { LABELS, type FlowEntry } from "../src/sim/ledger";
import { hasReached, milestoneData, milestonesOf, passed } from "../src/sim/milestones";
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

// T-060: a closed water loop, from the last whole month's ledger.
describe("a closed water loop", () => {
  const loop = milestoneData.milestones.find((m) => m.id === "closed_loop")!;
  const month = (water: FlowEntry, grayWater: FlowEntry): SimState => {
    const s = hole();
    s.ledger.days = [{ water, grayWater }];
    return s;
  };

  it("is reached once treatment puts back more than the loop loses", () => {
    // Recycler: 80 gray in, 78 clean back (2 lost as sludge). Household: 20 out, 20 back gray. Electrolyzer: 50 split for good.
    const s = month(
      { in: { "Water recycler": 78, [LABELS.earth]: 500 }, out: { [LABELS.household]: 20, Electrolyzer: 50 } },
      { in: { [LABELS.household]: 20 }, out: { "Water recycler": 80 } },
    );
    expect(passed(s, loop)).toBe(true);
    stepEvents(s, config);
    expect(hasReached(s, "closed_loop")).toBe(true);
    expect(s.messages.some((m) => m.text === "Milestone: a closed water loop.")).toBe(true);
  });

  it("isn't while the leaks outpace treatment, or with no treatment at all", () => {
    const leaky = month(
      { in: { "Water recycler": 78 }, out: { Electrolyzer: 70, "Concrete plant": 20 } },
      { in: { "Concrete plant": 10 }, out: { "Water recycler": 80, [LABELS.lost]: 5 } },
    );
    expect(passed(leaky, loop)).toBe(false);
    const untreated = month({ in: { [LABELS.earth]: 500 }, out: { [LABELS.household]: 20 } }, { in: { [LABELS.household]: 20 }, out: {} });
    expect(passed(untreated, loop)).toBe(false);
    expect(passed(hole(), loop)).toBe(false);
  });

  it("water moved in and out (rovers, a seed kit) isn't the loop leaking", () => {
    const s = month(
      { in: { "Water recycler": 78 }, out: { "Rover to Second Hole": 300, [LABELS.household]: 20 } },
      { in: { [LABELS.household]: 20 }, out: { "Water recycler": 80 } },
    );
    expect(passed(s, loop)).toBe(true);
  });
});
