import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { takeVolunteers } from "../src/sim/colonists";
import { addPeopleAt, needsWeight, people, stageCounts } from "../src/sim/people";
import { deserialize, serialize } from "../src/sim/save";
import { createInitialState } from "../src/sim/state";
import { step } from "../src/sim/step";
import { createWorld } from "../src/sim/world";

const day = config.ticksPerDay;

describe("people", () => {
  it("the game starts with working adults only, each with their own span, some as couples", () => {
    const s = createInitialState(config);
    expect(stageCounts(s)).toEqual({ child: 0, adult: config.colonists.start, elder: 0 });
    expect(s.population.count).toBe(config.colonists.start);
    const c = s.colonists!;
    const [lo, hi] = people.adult.workSpanDays;
    for (const until of c.until) {
      expect(until).toBeGreaterThanOrEqual(lo * day);
      expect(until).toBeLessThanOrEqual(hi * day);
    }
    expect(new Set(c.until).size).toBeGreaterThan(config.colonists.start / 2);
    // Couples share a household and point at each other.
    const paired = c.partner.filter((p) => p >= 0).length;
    expect(paired).toBeGreaterThan(0);
    for (let i = 0; i < c.id.length; i++) {
      if (c.partner[i]! < 0) continue;
      const j = c.id.indexOf(c.partner[i]!);
      expect(c.partner[j]).toBe(c.id[i]);
      expect(c.household[j]).toBe(c.household[i]);
    }
  });

  it("only adults staff rooms", () => {
    const s = createInitialState(config);
    addPeopleAt(s, "child", 10, config, 1e9);
    step(s, config);
    expect(s.workforce.total).toBe(config.colonists.start);
  });

  it("volunteers are single adults first, then the youngest", () => {
    const s = createInitialState(config);
    const c = s.colonists!;
    const singles = c.id.filter((_, i) => c.partner[i]! < 0).length;
    const taken = takeVolunteers(s, 3);
    expect(taken).toHaveLength(3);
    expect(taken.every((m) => m.stage === 1 && m.partner < 0 && m.household === m.id)).toBe(true);
    if (singles >= 3) {
      const left = c.until.filter((_, i) => c.partner[i]! < 0);
      for (const m of taken) for (const u of left) expect(m.until).toBeGreaterThanOrEqual(u);
    }
    expect(s.colonists!.id).toHaveLength(config.colonists.start - 3);
  });

  it("Earth's arrivals are adults", () => {
    const s = createInitialState(config);
    s.drill.active = false;
    applyCommand(s, { type: "build", room: "bunk_dorm", at: { kind: "ring", floor: 1, ring: 1, slot: 1, w: 2, d: 1 } });
    for (let i = 0; i < 5 * day; i++) step(s, config);
    const st = stageCounts(s);
    expect(st.adult).toBe(s.population.count);
    expect(st.adult).toBeGreaterThan(config.colonists.start);
  });

  it("an old save's colonists become adults", () => {
    const w = createWorld(config);
    const file = JSON.parse(serialize(w));
    file.version = 9;
    for (const h of file.state.holes) {
      h.population = { count: 33, health: 90, needsMet: {}, sanitation: 1 };
      delete h.colonists;
    }
    const loaded = deserialize(JSON.stringify(file));
    expect(loaded.ok && stageCounts(loaded.world.holes[0]!)).toEqual({ child: 0, adult: 33, elder: 0 });
    expect(loaded.ok && loaded.world.holes[0]!.population.count).toBe(33);
  });
});

describe("aging", () => {
  it("adults retire into elders at the end of their span, and elders pass away after theirs, mourned by kin", () => {
    const s = createInitialState(config);
    s.drill.active = false;
    s.earth.nextDropTick = 1e9;
    const c = s.colonists!;
    const first = Math.min(...c.until);
    for (let i = 0; i < c.until.length; i++) c.until[i]! -= first - 5; // bring retirement close
    c.rev = (c.rev ?? 0) + 1;
    for (let i = 0; i < 6; i++) step(s, config);
    const st = stageCounts(s);
    expect(st.elder).toBeGreaterThan(0);
    expect(st.adult + st.elder).toBe(config.colonists.start);
    expect(s.messages.some((m) => /first colonists have retired/.test(m.text))).toBe(true);
    step(s, config);
    expect(s.workforce.total).toBe(st.adult); // elders don't work
    const i = c.stage.indexOf(2);
    const [lo, hi] = people.elder.days;
    expect(c.until[i]! - s.tick).toBeGreaterThanOrEqual(lo * day - 10);
    expect(c.until[i]! - s.tick).toBeLessThanOrEqual(hi * day);
    const before = s.population.count;
    const id = c.id[i]!;
    const kin = c.id.filter((_, j) => j !== i && c.household[j] === c.household[i]);
    c.until[i] = s.tick + 1;
    c.rev = (c.rev ?? 0) + 1;
    step(s, config);
    expect(s.population.count).toBe(before - 1);
    expect(c.id).not.toContain(id);
    expect(s.messages.at(-1)?.text).toMatch(/passed away peacefully/);
    for (const k of kin) expect(c.mourned[c.id.indexOf(k)]).toBe(s.tick);
  });

  it("children need less than adults", () => {
    const a = createInitialState(config);
    const b = createInitialState(config);
    b.colonists = undefined;
    addPeopleAt(b, "child", config.colonists.start, config, 1e9);
    expect(needsWeight(b)).toBeCloseTo(needsWeight(a) * people.child.needsFactor);
  });
});
