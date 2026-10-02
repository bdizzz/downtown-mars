import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { ticksToDig } from "../src/sim/digging";
import { padReady } from "../src/sim/earth";
import { capacities } from "../src/sim/economy";
import { eventMood, eventsOf, festivalWork, raiseEvent, rollDiscovery, stepEvents } from "../src/sim/events";
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
const stepEventsOnly = (s: SimState) => stepEvents(s, config);
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
    // As much as there's room for.
    expect(s.resources.water).toBeCloseTo(Math.min(water + 150, capacities(s, config).water!));
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

describe("a belt ship in distress", () => {
  it("calls now and then after day 20, at most once in a while", () => {
    const s = hole();
    let calls = 0;
    for (let i = 0; i < 120 * day; i++) {
      s.tick++;
      // Just the event clock, so the colony's own troubles don't get in the way.
      if (s.tick % 10 === 0) stepEventsOnly(s);
      const p = s.events!.pending.find((e) => e.kind === "belt_ship");
      if (p) {
        expect(s.tick).toBeGreaterThanOrEqual(20 * day);
        expect(p.title).toContain(p.ship!);
        calls++;
        s.events!.pending = [];
      }
    }
    expect(calls).toBeGreaterThan(0);
    expect(calls).toBeLessThanOrEqual(Math.ceil(100 / 25));
  });

  it("brought down, its crew join the hole with their salvage, and one becomes a notable", () => {
    const s = hole();
    // A few hours in, so the landing crew has the pad staffed and powered.
    for (let i = 0; i < 30; i++) step(s, config);
    expect(padReady(s)).toBe(true);
    raiseEvent(s, config, "belt_ship", { ship: "Long Haul" });
    const pop = s.population.count;
    const notables = s.notables.length;
    const electronics = s.resources.electronics!;
    expect(answer(s, "rescue").ok).toBe(true);
    expect(s.population.count).toBe(pop + 6);
    expect(s.notables.length).toBe(notables + 1);
    expect(s.notables.at(-1)!.role).toBe("belt pilot");
    expect(s.resources.electronics).toBeCloseTo(electronics + 15);
    expect(s.events!.landingTick).toBe(s.tick);
  });

  it("sent supplies, it sends thanks later", () => {
    const s = hole();
    raiseEvent(s, config, "belt_ship", { ship: "Pallas Wren" });
    expect(answer(s, "supplies").ok).toBe(true);
    const f = s.events!.followUps[0]!;
    expect(f.dueTick - s.tick).toBeGreaterThanOrEqual(10 * day);
    expect(f.dueTick - s.tick).toBeLessThanOrEqual(15 * day);
    const machinery = s.resources.machinery!;
    s.tick = f.dueTick - 1;
    for (let i = 0; i < 20; i++) {
      s.tick++;
      stepEventsOnly(s);
    }
    expect(s.resources.machinery).toBeCloseTo(machinery + 15);
    expect(s.messages.some((m) => /thank/.test(m.text))).toBe(true);
  });

  it("can't be brought down without a working pad", () => {
    const s = hole();
    s.layout.rooms = s.layout.rooms.filter((r) => r.type !== "landing_pad");
    raiseEvent(s, config, "belt_ship", { ship: "Ida's Luck" });
    const r = answer(s, "rescue");
    expect(r.ok).toBe(false);
    expect(answer(s, "ignore").ok).toBe(true);
    expect(eventMood(s)).toBeLessThan(0);
  });
});

describe("celebrations", () => {
  it("a milestone reached proposes a celebration, once", () => {
    const s = hole();
    s.layout.hole.floors = 5;
    stepEventsOnly(s);
    const c = s.events!.pending.find((e) => e.kind === "celebration")!;
    expect(c.title).toMatch(/five floors down/);
    s.events!.pending = [];
    stepEventsOnly(s);
    expect(s.events!.pending.some((e) => e.kind === "celebration")).toBe(false);
  });

  it("a festival costs a feast, slows work for a day, and lifts everyone", () => {
    const s = hole();
    s.layout.hole.floors = 5;
    stepEventsOnly(s);
    s.resources.meals = 10;
    s.resources.rations = 100;
    expect(answer(s, "festival").ok).toBe(true);
    expect(s.resources.meals).toBe(0);
    expect(s.resources.rations).toBe(80);
    expect(s.events!.festival).toBeDefined();
    expect(festivalWork(s, config)).toBeCloseTo(0.8);
    expect(eventMood(s)).toBeCloseTo(8);
    s.tick += day + 1;
    expect(festivalWork(s, config)).toBe(1);
    expect(eventMood(s)).toBeGreaterThan(0);
  });

  it("no feast, no festival: just a toast", () => {
    const s = hole();
    s.layout.hole.floors = 5;
    stepEventsOnly(s);
    s.resources.meals = 0;
    s.resources.rations = 5;
    expect(answer(s, "festival").ok).toBe(false);
    expect(answer(s, "toast").ok).toBe(true);
  });

  it("an old save doesn't celebrate what it reached long ago", () => {
    const s = hole();
    s.layout.hole.floors = 12;
    delete s.events;
    stepEventsOnly(s);
    expect(s.events!.pending).toHaveLength(0);
    expect(s.events!.celebrated).toEqual(expect.arrayContaining(["floor_5", "floor_10"]));
  });

  it("studying microfossils is worth a celebration", () => {
    const s = hole();
    raiseEvent(s, config, "microfossils", { floor: 6 });
    expect(answer(s, "study").ok).toBe(true);
    expect(s.events!.pending.find((e) => e.kind === "celebration")!.title).toMatch(/life on Mars/);
  });
});
