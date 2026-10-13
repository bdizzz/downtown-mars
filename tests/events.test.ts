import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { ticksToDig } from "../src/sim/digging";
import { padReady } from "../src/sim/earth";
import { capacities } from "../src/sim/economy";
import {
  choiceRefusal,
  eventData,
  eventDef,
  eventMood,
  eventsOf,
  festivalWork,
  outcomeWeight,
  raiseEvent,
  resolveWager,
  rollDiscovery,
  stakeRange,
  stepEvents,
} from "../src/sim/events";
import { airAmount, airPct } from "../src/sim/air";
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

describe("too much oxygen (T-030)", () => {
  /** Run the events check for `days`, a check at a time, with the air held where it is. */
  const run = (s: SimState, days: number) => {
    for (let t = 0; t < days * day; t += eventData.checkEveryTicks) {
      s.tick += eventData.checkEveryTicks;
      stepEvents(s, config);
    }
  };
  const highAir = () => {
    const s = hole();
    s.resources.o2 = airAmount(s, config, 25);
    return s;
  };

  it("warns of the fire risk at once, and offers to vent after half a day above the line", () => {
    const s = highAir();
    run(s, 0.25);
    expect(s.messages.some((m) => m.kind === "warn" && /Fire risk/.test(m.text))).toBe(true);
    expect(eventsOf(s).pending).toHaveLength(0);
    run(s, 0.3);
    const card = eventsOf(s).pending.find((e) => e.kind === "vent_air")!;
    expect(card.text).toMatch(/25\.0%/);
  });

  it("venting brings O2 back to the target, and what's vented is gone", () => {
    const s = highAir();
    const before = s.resources.o2!;
    run(s, 0.6);
    expect(answer(s, "vent").ok).toBe(true);
    expect(airPct(s, config, "o2")).toBeCloseTo(config.air.o2Target);
    expect(s.ledger.current.o2!.out[eventData.ventAir.label]).toBeCloseTo(before - s.resources.o2!);
  });

  it("held, the air stays high and the card doesn't come back for a while", () => {
    const s = highAir();
    run(s, 0.6);
    expect(answer(s, "hold").ok).toBe(true);
    expect(airPct(s, config, "o2")).toBeCloseTo(25);
    run(s, eventData.ventAir.cooldownDays - 1);
    expect(eventsOf(s).pending).toHaveLength(0);
    run(s, 1.5);
    expect(eventsOf(s).pending.some((e) => e.kind === "vent_air")).toBe(true);
  });

  it("comfortable air raises nothing", () => {
    const s = hole();
    run(s, 2);
    expect(eventsOf(s).pending).toHaveLength(0);
    expect(s.messages.some((m) => /Fire risk/.test(m.text))).toBe(false);
  });
});

describe("wagers (F-016)", () => {
  // The meteorite run: 10 machinery out for a month; all, 8 or none back; 25 ore or nothing.
  const go = () => eventDef("meteorite_run").choices.find((c) => c.id === "go")!;
  // One hole for every roll (making a fresh one each time is slow): a new seed, stock and card each trip.
  let base: SimState | undefined;
  function trip(seed: number, machinery = 40): SimState {
    const s = (base ??= hole());
    s.events = { ...eventsOf(s), seed, nextId: 1, pending: [], underway: [], moods: [] };
    s.resources.machinery = machinery;
    s.resources.ore = 0;
    raiseEvent(s, config, "meteorite_run");
    return s;
  }
  const send = (s: SimState, share?: number) =>
    applyCommand(s, { type: "answerEvent", eventId: s.events!.pending[0]!.id, choice: "go", ...(share !== undefined ? { share } : {}) });
  /** Send the trip off, take it off the board and roll it now: what came of it. */
  function rollTrip(seed: number, share?: number) {
    const s = trip(seed);
    expect(send(s, share).ok).toBe(true);
    const w = s.events!.underway!.pop()!;
    const ids = resolveWager(s, config, w);
    return { ids, lost: 40 - s.resources.machinery!, ore: s.resources.ore ?? 0 };
  }

  it("holds the stake while the trip is away, and rolls the outcome when it's back", () => {
    const s = trip(3);
    expect(send(s).ok).toBe(true);
    expect(s.resources.machinery).toBe(30);
    const w = s.events!.underway![0]!;
    expect(w.held).toEqual({ machinery: 10 });
    expect(w.dueTick - s.tick).toBe(day);
    const every = eventData.checkEveryTicks;
    while (s.tick + every < w.dueTick) {
      s.tick += every;
      stepEventsOnly(s);
    }
    expect(s.events!.underway).toHaveLength(1);
    s.tick = Math.ceil(w.dueTick / every) * every;
    stepEventsOnly(s);
    expect(s.events!.underway).toHaveLength(0);
    expect([30, 38, 40]).toContain(s.resources.machinery);
    expect(s.messages.some((m) => /meteorite crew|winch|impact site/.test(m.text))).toBe(true);
  });

  it("rolls the same way for the same game", () => {
    expect(rollTrip(11).ids).toEqual(rollTrip(11).ids);
  });

  it("resolves into every outcome across seeds, with no ore after a catastrophe", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const { ids, lost, ore } = rollTrip(seed);
      ids.forEach((id) => seen.add(id));
      expect(lost).toBe(ids.includes("catastrophe") ? 10 : ids.includes("winch") ? 2 : 0);
      expect(ore).toBe(ids.includes("ore") ? 25 : 0);
      if (ids.includes("catastrophe")) expect(ids).not.toContain("ore");
    }
    expect([...seen].sort()).toEqual(["all_back", "catastrophe", "no_ore", "ore", "winch"]);
  });

  it("commits less than asked (T-152): a smaller stake, a smaller haul, and the odds shift", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { ids, lost, ore } = rollTrip(seed, 0.5);
      expect(lost).toBe(ids.includes("catastrophe") ? 5 : ids.includes("winch") ? 1 : 0);
      expect(ore).toBe(ids.includes("ore") ? 13 : 0);
    }
    // Weights run straight from weightAtMin (the least committed) to weight (all of it).
    const ore = go().outcomes![1]![0]!;
    expect(outcomeWeight(ore, 0.5, 0.5)).toBe(4);
    expect(outcomeWeight(ore, 0.75, 0.5)).toBe(5);
    expect(outcomeWeight(ore, 1, 0.5)).toBe(6);
    // Across many games, half the machinery finds ore less often, and loses it all less often.
    const count = (share: number | undefined, id: string) => Array.from({ length: 400 }, (_, i) => rollTrip(i + 1, share).ids.includes(id)).filter(Boolean).length;
    expect(count(0.5, "ore")).toBeLessThan(count(undefined, "ore"));
    expect(count(0.5, "catastrophe")).toBeLessThan(count(undefined, "catastrophe"));
  });

  it("can't put up what the hole hasn't got, and the stepper stops at what it has", () => {
    const s = trip(1, 7);
    expect(stakeRange(s, go())).toEqual({ resource: "machinery", name: "machinery", asked: 10, min: 5, max: 7 });
    expect(send(s).ok).toBe(false);
    expect(send(s, 0.7).ok).toBe(true);
    expect(s.resources.machinery).toBe(0);
    const poor = trip(1, 4);
    expect(choiceRefusal(poor, go(), true)).toMatch(/Not enough machinery/);
    expect(stakeRange(poor, go())!.max).toBeLessThan(5);
    // Asking for less than the least commits the least.
    const s2 = trip(1, 20);
    expect(send(s2, 0.1).ok).toBe(true);
    expect(s2.events!.underway![0]!.held).toEqual({ machinery: 5 });
  });

  it("declining keeps the machinery home, with a small dip", () => {
    const s = trip(1);
    expect(applyCommand(s, { type: "answerEvent", eventId: s.events!.pending[0]!.id, choice: "decline" }).ok).toBe(true);
    expect(s.resources.machinery).toBe(40);
    expect(eventMood(s)).toBeLessThan(0);
    expect(s.events!.underway ?? []).toHaveLength(0);
  });
});
