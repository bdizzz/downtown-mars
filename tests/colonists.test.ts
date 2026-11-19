import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { colonistStages, improveHomes, walkM, type Colonists } from "../src/sim/colonists";
import { isActive } from "../src/sim/economy";
import { updateHappiness } from "../src/sim/happiness";
import { people, setAdults, stageCounts, takeAdults, unlock } from "../src/sim/people";
import type { Location } from "../src/sim/placement";
import { roomDef } from "../src/sim/rooms";
import { deserialize, serialize } from "../src/sim/save";
import { createInitialState, type SimState } from "../src/sim/state";
import { step } from "../src/sim/step";
import type { World } from "../src/sim/world";
import { runNetwork } from "./netbot";
import { twoHoles } from "./worlds";

// Individual colonists (#523–#526, docs/PLAN-PEOPLE.md): people beside the
// cohorts, in shadow mode; homes and jobs that assign themselves; routes as
// cached distances; and needs per person.

const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });

/** Everyone's checks, for one hole: the people match the cohorts, and their jobs and beds are sound. */
function checkHole(h: SimState): void {
  const c = h.colonists!;
  // Shadow mode: the same people at each stage as the cohorts say.
  expect(colonistStages(h)).toEqual(stageCounts(h));
  expect(c.id.length).toBe(h.population.count);
  // Jobs follow the staffing exactly; only adults work.
  const jobs = new Map<number, number>();
  for (let i = 0; i < c.id.length; i++) {
    if (c.job[i]! < 0) continue;
    expect(c.stage[i]).toBe(1);
    jobs.set(c.job[i]!, (jobs.get(c.job[i]!) ?? 0) + 1);
  }
  for (const [id, st] of Object.entries(h.roomStatus)) expect(jobs.get(Number(id)) ?? 0).toBe(st.staff);
  // Nobody over a home's beds, and nobody homeless while a bed is free.
  const residents = new Map<number, number>();
  for (const home of c.home) if (home >= 0) residents.set(home, (residents.get(home) ?? 0) + 1);
  let free = 0;
  for (const r of h.layout.rooms) {
    const beds = roomDef(r.type).houses ?? 0;
    if (!beds || !isActive(r)) continue;
    expect(residents.get(r.id) ?? 0).toBeLessThanOrEqual(beds);
    free += beds - (residents.get(r.id) ?? 0);
  }
  if (free > 0) expect(c.home.filter((x) => x < 0)).toHaveLength(0);
}

describe("colonists in shadow mode (#523)", () => {
  // Ninety days of the two-hole bot: births, aging, Earth's arrivals, volunteers founding a hole.
  const days: { world: World; day: number }[] = [];
  const seen = new Map<number, number>(); // id → holeId it was last in
  let moved = 0;
  const net = runNetwork(90, config.seed, true, (world, day) => {
    for (const h of world.holes) {
      for (const id of h.colonists?.id ?? []) {
        const was = seen.get(id);
        if (was !== undefined && was !== h.holeId) moved++;
        seen.set(id, h.holeId);
      }
    }
    if (day % 10 === 0) days.push({ world, day });
  });

  it("keeps the same people at each stage as the cohorts, every day, in every hole", () => {
    for (const h of net.world.holes) checkHole(h);
  });

  it("has children, adults and, by day 90, the first who grew up or retired, each a person", () => {
    const all = net.world.holes.flatMap((h) => h.colonists!.stage);
    expect(all.filter((s) => s === 0).length).toBe(net.world.holes.reduce((n, h) => n + stageCounts(h).child, 0));
    expect(all.filter((s) => s === 1).length).toBeGreaterThan(0);
  });

  it("ids are unique across the network, and volunteers keep theirs in the hole they found", () => {
    const ids = net.world.holes.flatMap((h) => h.colonists!.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(net.world.holes.length).toBeGreaterThan(1);
    // Some people now live in a hole other than the one they were first seen in.
    expect(moved).toBeGreaterThan(0);
  });

  it("volunteers travel as themselves: names and ids", () => {
    const w = twoHoles();
    const [home, founded] = w.holes;
    const ids = new Set(home!.colonists!.id);
    // twoHoles founds the second hole from the first: its people were the first's.
    const theirs = founded!.colonists!.id.filter((id) => Math.floor(id / 1_000_000) === home!.holeId);
    expect(theirs.length).toBe(founded!.population.count);
    for (const id of theirs) expect(ids.has(id)).toBe(false);
  });

  it("someone taken keeps their name, birthday and traits", () => {
    const s = createInitialState(config);
    const c = s.colonists!;
    const before = new Map(c.id.map((id, i) => [id, [c.first[i], c.last[i], c.born[i], c.traitA[i], c.traitB[i]]]));
    const taken = takeAdults(s, 4);
    const members = taken.flatMap((t) => t.members ?? []);
    expect(members).toHaveLength(4);
    for (const m of members) expect([m.first, m.last, m.born, m.traitA, m.traitB]).toEqual(before.get(m.id));
    for (const m of members) expect(c.id).not.toContain(m.id);
  });

  it("a cohort that moves on takes its people with it, and elders who pass away are gone", () => {
    const s = createInitialState(config);
    s.drill.active = false;
    const ids = s.colonists!.id.slice();
    // Bring the first cohort's retirement to the next tick.
    const first = s.population.cohorts[0]!;
    first.until = s.tick + 1;
    step(s, config);
    const c = s.colonists!;
    const retired = ids.filter((id) => c.stage[c.id.indexOf(id)] === 2);
    expect(retired).toHaveLength(first.count);
    // Now they pass away.
    first.until = s.tick + 1;
    step(s, config);
    for (const id of retired) expect(s.colonists!.id).not.toContain(id);
    expect(colonistStages(s)).toEqual(stageCounts(s));
  });

  it("saves keep who everyone is, where they sleep and work; the rest is worked out again", () => {
    const w = net.world;
    const back = deserialize(serialize(w));
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    for (const [i, h] of w.holes.entries()) {
      const a = h.colonists!;
      const b = back.world.holes[i]!.colonists!;
      for (const k of ["id", "cohort", "stage", "born", "until", "gen", "first", "last", "traitA", "traitB", "home", "job"] as const) expect(b[k]).toEqual(a[k]);
      // Routes come back from the layout.
      step(back.world.holes[i]!, config);
    }
    // The packed people are small: base64 columns, not lists of numbers.
    const text = serialize(w);
    expect(text).not.toMatch(/"colonists":\{"nextSeq":\d+,"id":\[/);
  });

  it("old saves get their people from their cohorts", () => {
    const file = JSON.parse(serialize(net.world)) as { version: number; state: { holes: Record<string, unknown>[] } };
    file.version = 24;
    for (const h of file.state.holes) delete h.colonists;
    const back = deserialize(JSON.stringify(file));
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    const h = back.world.holes[0]!;
    step(h, config);
    checkHole(h);
  });
});

/** A hole with two studios apart and a workplace beside each, every bed taken. */
function twoStudios(): { s: SimState; c: Colonists; a: number; b: number; nearA: number; nearB: number; pod: number } {
  const s = createInitialState(config);
  s.drill.active = false;
  s.earth.nextDropTick = 1e9;
  Object.assign(s.resources, { metal: 500, rock: 500, brick: 500, machinery: 50, electronics: 50 });
  unlock(s, "basicHomes");
  const build = (room: string, at: Location) => {
    const r = applyCommand(s, { type: "build", room, at });
    if (!r.ok) throw new Error(`${room}: ${r.reason}`);
    return r.roomId!;
  };
  const a = build("studio", ring(1, 1, 2));
  const nearA = build("site_office", ring(1, 1, 1));
  const b = build("studio", ring(1, 1, 6));
  const nearB = build("clinic", ring(1, 1, 7));
  setAdults(s, 30, config); // the pod's 20 beds and both studios' 5
  updateHappiness(s, config, true);
  const c = s.colonists!;
  const pod = s.layout.rooms.find((r) => r.type === "landing_pod")!.id;
  // Five in studio A who work beside B, five in B who work beside A; the rest fill the pod, out of work.
  for (let i = 0; i < c.id.length; i++) {
    c.home[i] = i < 5 ? a : i < 10 ? b : pod;
    c.job[i] = i < 5 ? nearB : i < 10 ? nearA : -1;
    c.gainDays[i] = 0;
    c.gainWith[i] = -1;
  }
  // Every home as nice as the next, unless a test says otherwise.
  for (const p of s.happiness.pools) p.base = 50;
  return { s, c, a, b, nearA, nearB, pod };
}

describe("homes and jobs assign themselves (#524)", () => {
  it("two workers who'd both gain swap beds, but only after gaining for a few days running", () => {
    const { s, c, a, b, nearA, nearB } = twoStudios();
    const { metresPerPoint, swapGainPoints } = people.colonists.assign;
    expect((walkM(s.layout, nearB, a) - walkM(s.layout, nearB, b)) / metresPerPoint).toBeGreaterThanOrEqual(swapGainPoints);
    expect((walkM(s.layout, nearA, b) - walkM(s.layout, nearA, a)) / metresPerPoint).toBeGreaterThanOrEqual(swapGainPoints);
    const days = people.colonists.assign.swapAfterDays;
    for (let d = 1; d < days; d++) {
      improveHomes(s, c);
      expect(c.home.slice(0, 10)).toEqual([a, a, a, a, a, b, b, b, b, b]);
      expect(c.gainDays[0]).toBe(d);
    }
    improveHomes(s, c);
    // All five pairs trade: each now sleeps beside their job.
    expect(c.home.slice(0, 10)).toEqual([b, b, b, b, b, a, a, a, a, a]);
    expect(c.gainDays.slice(0, 10).every((x) => x === 0)).toBe(true);
    // And nobody else moved.
    expect(c.home.slice(10).every((h) => h === c.home[10])).toBe(true);
  });

  it("a gain that stops resets the count, so beds don't churn", () => {
    const { s, c, a } = twoStudios();
    improveHomes(s, c);
    improveHomes(s, c);
    expect(c.gainDays[0]).toBe(2);
    // One of the partners loses their job: they'd gain nothing now.
    for (let i = 5; i < 10; i++) c.job[i] = -1;
    improveHomes(s, c);
    expect(c.gainDays[0]).toBe(0);
    expect(c.home.slice(0, 5).every((h) => h === a)).toBe(true);
  });

  it("a worker moves into a free bed that's clearly nearer work, turning nobody out", () => {
    const { s, c, a, b } = twoStudios();
    // Studio B empties (its five move to the pod's spare beds... there are none: they leave the hole).
    for (let i = 5; i < 10; i++) c.home[i] = -1;
    improveHomes(s, c);
    expect(c.home.slice(0, 5)).toEqual([b, b, b, b, b]);
    expect(c.home.filter((h) => h === a)).toHaveLength(0);
  });

  it("a nicer home is worth a longer walk, at metresPerPoint metres a point, and no further", () => {
    const pick = (nicerBy: number) => {
      const { s, c, a, b, nearB, pod } = twoStudios();
      // Person 0 (works beside B) sleeps in the pod, the worst home; a bed is free in each studio.
      c.home[0] = pod;
      c.home[10] = -1;
      c.home[5] = -1;
      for (const p of s.happiness.pools) p.base = p.roomId === pod ? 0 : p.roomId === a ? 50 + nicerBy : 50;
      const further = walkM(s.layout, nearB, a) - walkM(s.layout, nearB, b);
      improveHomes(s, c);
      return { home: c.home[0], a, b, worth: further / people.colonists.assign.metresPerPoint };
    };
    // A is the longer walk: worth it only if it's nicer by more than the walk costs.
    const { worth } = pick(0);
    expect(worth).toBeGreaterThan(1);
    const far = pick(worth + 1);
    expect(far.home).toBe(far.a);
    const near = pick(worth - 1);
    expect(near.home).toBe(near.b);
  });

  it("the homeless take free beds, a worker the one nearest their job", () => {
    const { s, c, b, nearB } = twoStudios();
    for (let i = 0; i < 10; i++) c.home[i] = -1;
    updateHappiness(s, config, true);
    // The ones who work beside B got B's beds.
    for (let i = 0; i < 5; i++) expect(c.job[i] === nearB ? c.home[i] : b).toBe(b);
  });
});

describe("routes and needs per person (#525, #526)", () => {
  const net = runNetwork(60);
  const h = net.world.holes[0]!;
  const c = h.colonists!;

  it("each person's walks are cached distances from their rooms", () => {
    for (let i = 0; i < c.id.length; i++) {
      if (c.job[i]! >= 0 && c.home[i]! >= 0) expect(c.workM[i]).toBe(walkM(h.layout, c.job[i]!, c.home[i]!));
      else expect(c.workM[i]).toBe(0);
      if (c.food[i]! >= 0) expect(c.foodM[i]).toBe(walkM(h.layout, c.home[i]!, c.food[i]!));
    }
    expect(c.workM.some((m) => m > 0)).toBe(true);
  });

  it("the hole's happiness is its people's average", () => {
    updateHappiness(h, config);
    const mean = c.happiness.reduce((a, b) => a + b, 0) / c.happiness.length;
    expect(h.happiness.average).toBeCloseTo(mean, 6);
  });

  it("a long commute costs a person comfort their neighbours with short ones don't feel", () => {
    updateHappiness(h, config);
    const w = config.happiness.weights.comfort;
    for (const pool of h.happiness.pools.filter((p) => p.residents > 1)) {
      const here = [...c.home.keys()].filter((i) => c.home[i] === pool.roomId);
      const own = (i: number) => {
        const m = c.workM[i]!;
        const k = people.colonists.commute;
        const commute = m <= k.freeM ? 0 : Math.max(k.worstComfort, ((m - k.freeM) / 10) * k.comfortPerStep);
        return commute * w;
      };
      for (const i of here) for (const j of here) {
        // Same home, same food walk (the galley nearest it): the difference is their commutes.
        expect(c.happiness[i]! - c.happiness[j]!).toBeCloseTo(own(i) - own(j), 6);
      }
    }
  });

  it("each person's needs come from their home and their own walks; the hole's are their average", () => {
    const needs = h.happiness.needs!;
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(needs.comfort).toBeCloseTo(mean(c.comfort), 6);
    expect(needs.health).toBeCloseTo(mean(c.health), 6);
    expect(needs.fed).toBeCloseTo(mean(c.fed), 6);
    for (let i = 0; i < c.id.length; i++) {
      const pool = h.happiness.pools.find((p) => p.roomId === c.home[i]);
      if (pool) expect(c.health[i]).toBe(pool.factors.health);
    }
  });
});

describe("colonists at scale", () => {
  it("a year of ticks with 10,000 people in a hole stays inside a generous limit", () => {
    const s = createInitialState(config);
    setAdults(s, 10_000, config);
    const t = performance.now();
    for (let i = 0; i < 12 * config.ticksPerDay; i++) step(s, config);
    // About 1.5 s on an M4 (the people about a third of it); 5× that and more fails.
    expect(performance.now() - t).toBeLessThan(10_000);
    checkHole(s);
  }, 60_000);
});
