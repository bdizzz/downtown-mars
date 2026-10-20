import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config as baseConfig, type SimConfig } from "../src/sim/config";
import { diagnose } from "../src/sim/diagnosis";
import { effectOnRoom, effectSources } from "../src/sim/effects";
import { updateHappiness } from "../src/sim/happiness";
import { createHistory, stepHistory } from "../src/sim/history";
import type { Location } from "../src/sim/placement";
import { roomDef } from "../src/sim/rooms";
import { makeSnapshot } from "../src/sim/snapshot";
import { createInitialState, type SimState } from "../src/sim/state";
import { step } from "../src/sim/step";
import { causeBand } from "../src/ui/trends";
import { roomTints, SPOT_COLORS } from "../src/view/reachView";
import { factorRows, feltByRows } from "../src/view/roomPanel";
import { whyContent } from "../src/view/whyPanel";

// F-018's "Why?" panel, home breakdown and trend bands (T-173, T-174, T-175): the rooms behind each
// neighbour effect, the panel's causes and Show me, and the causes recorded over time.

const config: SimConfig = { ...baseConfig, earth: { ...baseConfig.earth, firstDropDay: 1e6 } };
const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });

function withRooms(rooms: [string, Location][]): SimState {
  const s = createInitialState(config);
  s.drill.active = false;
  Object.assign(s.resources, { metal: 500, rock: 500, brick: 500, machinery: 50, electronics: 50 });
  for (const [room, at] of rooms) {
    const r = applyCommand(s, { type: "build", room, at });
    if (!r.ok) throw new Error(`${room}: ${r.reason}`);
    const c = applyCommand(s, { type: "connectRoom", roomId: r.roomId!, finish: "rock" });
    if (!c.ok) throw new Error(`${room}: ${c.reason}`);
  }
  s.population.count = s.happiness.pools.reduce((n, p) => n + p.capacity, 0) || s.population.count;
  updateHappiness(s, config, true);
  s.population.count = s.happiness.pools.reduce((n, p) => n + p.capacity, 0);
  updateHappiness(s, config, true);
  return s;
}

const noisy = () => withRooms([["life_support", ring(1, 1, 1, 4)], ["bunk_dorm", ring(1, 1, 5, 2)]]);

describe("effect sources", () => {
  it("names the room behind the noise in a home, adding up to the noise it feels", () => {
    const s = noisy();
    const dorm = s.layout.rooms.find((r) => r.type === "bunk_dorm")!;
    const plant = s.layout.rooms.find((r) => r.type === "life_support")!;
    const list = effectSources(s.layout, [dorm]).get(dorm.id)!;
    const noise = list.filter((x) => x.type === "noise");
    expect(noise.map((x) => x.from)).toContain(plant.id);
    expect(noise.reduce((sum, x) => sum + x.value, 0)).toBeCloseTo(effectOnRoom(s.effects.field, "noise", dorm), 1);
  });

  it("the diagnosis names the noisy room for the noise cause, and the snapshot carries every home's sources", () => {
    const s = noisy();
    const plant = s.layout.rooms.find((r) => r.type === "life_support")!;
    const d = diagnose(s, config);
    expect(d.happiness.causes.find((c) => c.id === "noise")!.rooms?.[0]).toBe(plant.id);
    const dorm = s.layout.rooms.find((r) => r.type === "bunk_dorm")!;
    expect(d.sources[dorm.id]!.some((x) => x.from === plant.id && x.type === "noise" && x.value < 0)).toBe(true);
  });
});

describe("the Why? panel (T-173)", () => {
  it("ranks the noise with Show me on the noisy room and the homes that hear it", () => {
    const s = noisy();
    const snap = makeSnapshot(s, config);
    const plant = s.layout.rooms.find((r) => r.type === "life_support")!;
    const dorm = s.layout.rooms.find((r) => r.type === "bunk_dorm")!;
    const noise = whyContent(snap).happiness.items.find((i) => i.id === "noise")!;
    expect(noise.bad).toBe(true);
    expect(noise.fix).toBeTruthy();
    expect(noise.from).toContain("floor 1, ring 1");
    expect(noise.spot).toMatchObject({ focus: plant.id, rooms: [plant.id] });
    expect(noise.spot!.homes).toContain(dorm.id);
    // Show me tints the source red and the home amber; a selected service's reach still comes first.
    const tints = roomTints(snap.layout, null, noise.spot);
    expect(tints.find((t) => t.room.id === plant.id)!.color).toBe(SPOT_COLORS.source);
    expect(tints.find((t) => t.room.id === dorm.id)!.color).toBe(SPOT_COLORS.home);
  });

  it("health lists its drains with fixes, and the unhappiest homes are named", () => {
    const s = noisy();
    for (let i = 0; i < 3; i++) {
      s.resources.meals = 0;
      s.resources.rations = 0;
      step(s, config);
    }
    const why = whyContent(makeSnapshot(s, config));
    expect(why.health.headline).toMatch(/falling/);
    expect(why.health.items[0]).toMatchObject({ id: "meals", bad: true });
    expect(why.health.items[0]!.fix).toBeTruthy();
    expect(why.worst[0]!.name).toMatch(/floor \d, ring \d/);
  });
});

describe("the home's breakdown (T-174)", () => {
  it("a home's noise names the noisy room, and the noisy room says how many homes it bothers", () => {
    const s = noisy();
    const snap = makeSnapshot(s, config);
    const dorm = s.layout.rooms.find((r) => r.type === "bunk_dorm")!;
    const plant = s.layout.rooms.find((r) => r.type === "life_support")!;
    const rows = factorRows(snap, dorm.id);
    expect(rows.map((r) => r.k)).toEqual(["Noise", "Comfort", "Wellbeing"]);
    expect(rows[0]!.text).toMatch(new RegExp(`^−.* = ${roomDef("life_support").name}`));
    const bothers = feltByRows(snap, plant.id).find((r) => r.k === "Bothers")!;
    expect(bothers.text).toMatch(/noise felt in \d+ homes?/);
  });

  it("each factor's parts add up to the factor", () => {
    const s = noisy();
    const pool = s.happiness.pools.find((p) => p.residents > 0)!;
    const w = config.happiness.weights;
    for (const f of ["noise", "comfort", "health"] as const) {
      const sum = Object.entries(pool.points ?? {})
        .filter(([id]) => (diagnose(s, config).happiness.causes.find((c) => c.id === id)?.factor ?? f) === f)
        .reduce((n, [, v]) => n + v / w[f], 0);
      expect(sum).toBeCloseTo(pool.factors[f], 0);
    }
  });
});

describe("causes over time (T-175)", () => {
  it("records health's drain by cause, starting when the meals ran out", () => {
    const s = createInitialState(config);
    s.drill.active = false;
    s.history = createHistory(config);
    const every = config.history.everyTicks;
    for (let i = 0; i < every * 4; i++) {
      const out = i >= every * 2;
      s.resources.meals = out ? 0 : 100;
      s.resources.rations = out ? 0 : 100;
      s.resources.water = 100;
      step(s, config);
      stepHistory(s, config);
    }
    const meals = s.history.hourly["drain:meals"]!;
    expect(meals[0]).toBe(0);
    expect(meals.at(-1)).toBeGreaterThan(0);
    const band = causeBand(s.history, "health", "2d", config.ticksPerDay)!;
    expect(band.layers.find((l) => l.label === "Meals")!.values.at(-1)).toBeLessThan(0);
    expect(causeBand(s.history, "happiness", "2d", config.ticksPerDay)!.layers.map((l) => l.label)).toEqual(["Noise", "Comfort", "Wellbeing", "Mood"]);
  });

  it("an older save's history gets a gap, not zeros, before the causes were recorded", () => {
    const s = createInitialState(config);
    s.history = createHistory(config);
    const every = config.history.everyTicks;
    // As an old save: no cause series yet.
    for (const id of Object.keys(s.history.hourly)) if (id.includes(":")) delete s.history.hourly[id];
    s.history.hourly.population = [5, 5, 5];
    s.tick = every * 10;
    stepHistory(s, config);
    const meals = s.history.hourly["drain:meals"]!;
    expect(meals.slice(0, 3).every((v) => Number.isNaN(v))).toBe(true);
    expect(Number.isFinite(meals.at(-1)!)).toBe(true);
  });
});
