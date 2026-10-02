import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { ticksToDig } from "../src/sim/digging";
import { eventMood, eventsOf, raiseEvent, rollDiscovery } from "../src/sim/events";
import { isOpen } from "../src/sim/excavation";
import { createInitialState, type SimState } from "../src/sim/state";
import { step } from "../src/sim/step";

// Milestone 14: events with choices, starting with what the drill strikes.

const day = config.ticksPerDay;

function hole(): SimState {
  const s = createInitialState(config);
  s.drill.active = false;
  return s;
}
const answer = (s: SimState, choice: string) => applyCommand(s, { type: "answerEvent", eventId: s.events!.pending[0]!.id, choice });

describe("drill discoveries", () => {
  it("the first floor dug always strikes something, as a card waiting for an answer", () => {
    const s = createInitialState(config);
    for (let i = 0; i < ticksToDig(2, config) + 1; i++) step(s, config);
    expect(s.layout.hole.floors).toBe(2);
    const ev = eventsOf(s);
    expect(ev.pending).toHaveLength(1);
    expect(ev.pending[0]!.floor).toBe(2);
    expect(ev.struckTick).toBeGreaterThan(0);
    expect(s.messages.some((m) => /a decision is waiting/.test(m.text))).toBe(true);
  });

  it("is the same find for the same game, and different finds turn up over many floors", () => {
    const finds = (seed: number) => {
      const s = hole();
      s.events = { ...eventsOf(s), seed };
      for (let f = 2; f <= 12; f++) rollDiscovery(s, config, f);
      return eventsOf(s).found.join(",");
    };
    expect(finds(5)).toBe(finds(5));
    const all = new Set([5, 6, 7, 8, 9].flatMap((x) => finds(x).split(",")));
    expect(all.size).toBeGreaterThanOrEqual(3);
  });

  it("tapping an aquifer gives the hole the deposit and some water", () => {
    const s = hole();
    s.deposits = s.deposits.filter((d) => d !== "aquifer");
    raiseEvent(s, config, "aquifer", { floor: 2 });
    const water = s.resources.water!;
    expect(answer(s, "tap").ok).toBe(true);
    expect(s.deposits).toContain("aquifer");
    expect(s.resources.water).toBeCloseTo(water + 150);
    expect(s.events!.pending).toHaveLength(0);
  });

  it("opening a lava tube digs its cells for free", () => {
    const s = hole();
    s.layout.hole.floors = 3;
    rollDiscovery(s, config, 3); // the first roll always strikes; force a lava tube instead
    s.events!.pending = [];
    const cells = [{ floor: 1, ring: 2, slot: 4 }, { floor: 1, ring: 2, slot: 5 }];
    raiseEvent(s, config, "lava_tube", { floor: 1, cells });
    expect(cells.every((c) => !isOpen(s.layout, c))).toBe(true);
    expect(answer(s, "open").ok).toBe(true);
    expect(cells.every((c) => isOpen(s.layout, c))).toBe(true);
  });

  it("venting gas holds the drill a day; pushing through wears the floor above and rattles everyone", () => {
    const s = hole();
    raiseEvent(s, config, "gas_pocket", { floor: 2 });
    expect(answer(s, "vent").ok).toBe(true);
    expect(s.drill.holdUntil).toBe(s.tick + day);
    s.drill.active = true;
    const progress = s.drill.progress;
    step(s, config);
    expect(s.drill.progress).toBe(progress); // held

    const t = hole();
    const before = t.layout.rooms.filter((r) => r.cells.some((c) => c.floor === 1)).map((r) => r.condition ?? 1);
    raiseEvent(t, config, "gas_pocket", { floor: 2 });
    expect(answer(t, "push").ok).toBe(true);
    const after = t.layout.rooms.filter((r) => r.cells.some((c) => c.floor === 1)).map((r) => r.condition ?? 1);
    expect(after.every((v, i) => v < before[i]!)).toBe(true);
    expect(eventMood(t)).toBeLessThan(0);
  });

  it("left unanswered, an event takes its own course", () => {
    const s = hole();
    raiseEvent(s, config, "microfossils", { floor: 6 });
    for (let i = 0; i < 2 * day + 20; i++) step(s, config);
    expect(s.events!.pending).toHaveLength(0);
    expect(s.messages.some((m) => /sulking/.test(m.text))).toBe(true);
    expect(eventMood(s)).toBeLessThan(0);
  });

  it("moods lift happiness, easing off", () => {
    const s = hole();
    raiseEvent(s, config, "aquifer", { floor: 2 });
    expect(answer(s, "seal").ok).toBe(true);
    const now = eventMood(s);
    expect(now).toBeCloseTo(4);
    for (let i = 0; i < day; i++) step(s, config);
    expect(eventMood(s)).toBeLessThan(now);
    expect(eventMood(s)).toBeGreaterThan(0);
  });
});
