import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config as baseConfig, type SimConfig } from "../src/sim/config";
import { openCells } from "../src/sim/excavation";
import { homeParts, updateHappiness } from "../src/sim/happiness";
import type { Location } from "../src/sim/placement";
import { roomDef } from "../src/sim/rooms";
import { makeSnapshot } from "../src/sim/snapshot";
import { createInitialState, type SimState } from "../src/sim/state";
import { step } from "../src/sim/step";
import { comfortAt, floorHeats, referenceCells, restBand } from "../src/sim/temperature";
import { createWorld } from "../src/sim/world";
import { config as cfg0 } from "../src/sim/config";

// #393: each floor has a temperature. It rests where the rock is (by latitude and
// depth), body heat and waste heat lift it, heaters bring it up to the thermostat
// and radiators down to it, and it moves there slowly. Comfort follows it.

// No Earth drops, no events or storms in the numbers.
const config: SimConfig = { ...baseConfig, earth: { ...baseConfig.earth, firstDropDay: 1e6 } };
const F = (c: number) => (c * 9) / 5 + 32;
const C = (f: number) => ((f - 32) * 5) / 9;
const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });
const day = (s: SimState, days = 1) => {
  for (let i = 0; i < days * config.ticksPerDay; i++) step(s, config);
};

/** A hole with floor 1 dug out across its three rings, plenty of power, and no one living there yet. */
function hole(): SimState {
  const s = createInitialState(config);
  s.drill.active = false;
  Object.assign(s.resources, { rock: 900, brick: 300, metal: 300, machinery: 60, electronics: 60, glass: 100 });
  const h = s.layout.hole;
  const cells = [];
  for (let r = 1; r <= 3; r++) for (let slot = 0; slot < h.ringSlots[r - 1]!; slot++) cells.push({ floor: 1, ring: r, slot });
  openCells(s.layout, cells);
  // Power to spare: a heater's draw is the question here, not whether the battery lasts the night.
  s.resources.power = 50;
  return s;
}

function build(s: SimState, room: string, at: Location): number {
  const r = applyCommand(s, { type: "build", room, at });
  if (!r.ok) throw new Error(`${room}: ${r.reason}`);
  applyCommand(s, { type: "connectRoom", roomId: r.roomId!, finish: "rock" });
  applyCommand(s, { type: "consoleFinish" });
  return r.roomId!;
}

/** Keep the batteries topped up, as if there were solar to spare. */
function powered(s: SimState, days: number) {
  for (let i = 0; i < days * config.ticksPerDay; i++) {
    s.resources.power = 50;
    step(s, config);
  }
}

const floor1 = (s: SimState) => floorHeats(s, config)[0]!;

describe("resting temperature", () => {
  it("runs by latitude: 40-45 °F at the starter's 20-25°, 0-15 °F at the poles, warmer toward the equator but never above 50 °F", () => {
    const [lo, hi] = restBand(22.5, config);
    expect(F(lo)).toBeCloseTo(40, 0);
    expect(F(hi)).toBeCloseTo(45, 0);
    const [plo, phi] = restBand(-90, config);
    expect(F(plo)).toBeCloseTo(0, 0);
    expect(F(phi)).toBeCloseTo(15, 0);
    const [elo, ehi] = restBand(0, config);
    expect(elo).toBeGreaterThan(lo);
    expect(F(ehi)).toBeLessThanOrEqual(50.01);
    expect(F(restBand(10, config)[1])).toBeCloseTo(50, 0);
    // Further from the equator, colder.
    expect(restBand(50, config)[0]).toBeLessThan(restBand(30, config)[0]);
  });

  it("a new game's first hole sits at 20-25° north and its first floor rests at 40-45 °F", () => {
    for (const seed of [1, 2, 3, 7, 42]) {
      const home = createWorld(cfg0, seed).holes[0]!;
      expect(home.site!.lat).toBeGreaterThanOrEqual(20);
      expect(home.site!.lat).toBeLessThanOrEqual(25);
      expect(F(home.temperature!.rest)).toBeGreaterThanOrEqual(39.5);
      expect(F(home.temperature!.rest)).toBeLessThanOrEqual(45.5);
    }
  });

  it("deeper floors rest a little warmer", () => {
    const s = hole();
    s.layout.hole.floors = 3;
    const [f1, , f3] = floorHeats(s, config);
    expect(f3!.rest).toBeGreaterThan(f1!.rest);
    expect(f3!.rest - f1!.rest).toBeLessThan(1);
  });

  it("an unheated floor drifts to rest, and stays there", () => {
    const s = hole();
    s.temperature!.floors = [20];
    day(s, 3);
    expect(floor1(s).now).toBeCloseTo(floor1(s).rest + floor1(s).body + floor1(s).waste, 1);
  });
});

describe("heaters", () => {
  it("one holds a fully dug small floor around 65 °F at full power, warming it in about a month", () => {
    const s = hole();
    applyCommand(s, { type: "setThermostat", celsius: 30 });
    build(s, "heater", ring(1, 2, 2));
    expect(floor1(s).cells).toBe(referenceCells(config));
    const start = floor1(s).now;
    powered(s, 0.5);
    expect(floor1(s).now).toBeGreaterThan(start + 3); // well on its way
    expect(floor1(s).now).toBeLessThan(C(64));
    powered(s, 1.5);
    expect(F(floor1(s).now)).toBeGreaterThan(62);
    expect(F(floor1(s).now)).toBeLessThan(68);
  });

  it("stop at the thermostat, and draw less power once they're there", () => {
    const s = hole();
    applyCommand(s, { type: "setThermostat", celsius: 30 });
    const id = build(s, "heater", ring(1, 2, 2));
    powered(s, 0.2);
    const flat = s.temperature!.heat[0]!;
    expect(flat).toBe(1); // still warming: full power
    applyCommand(s, { type: "setThermostat", celsius: C(55) });
    powered(s, 2);
    expect(F(floor1(s).now)).toBeCloseTo(55, 0);
    expect(s.temperature!.heat[0]!).toBeLessThan(0.8);
    expect(s.temperature!.heat[0]!).toBeGreaterThan(0);
    // The power it asks for follows.
    const used = (makeSnapshot(s, config).roomStatus[id]?.rate ?? 0) * roomDef("heater").uses.power! * s.temperature!.heat[0]!;
    expect(used).toBeLessThan(roomDef("heater").uses.power! * 0.8);
  });

  it("two warm a floor faster, and hold a warmer thermostat (76 °F) that one can't", () => {
    const one = hole();
    const two = hole();
    for (const s of [one, two]) applyCommand(s, { type: "setThermostat", celsius: C(76) });
    build(one, "heater", ring(1, 2, 2));
    build(two, "heater", ring(1, 2, 2));
    build(two, "heater", ring(1, 2, 4));
    powered(one, 0.25);
    powered(two, 0.25);
    expect(floor1(two).now - floor1(two).rest).toBeGreaterThan(1.6 * (floor1(one).now - floor1(one).rest));
    powered(one, 3);
    powered(two, 3);
    expect(F(floor1(two).now)).toBeCloseTo(76, 0);
    expect(F(floor1(one).now)).toBeLessThan(70);
  });

  it("without power, the floor cools slowly back to rest", () => {
    const s = hole();
    build(s, "heater", ring(1, 2, 2));
    powered(s, 2);
    const warm = floor1(s).now;
    // The power's gone.
    for (const r of s.layout.rooms) if (roomDef(r.type).makes.power) r.paused = true;
    s.resources.power = 0;
    day(s, 0.5);
    expect(floor1(s).now).toBeLessThan(warm - 1);
    expect(floor1(s).now).toBeGreaterThan(floor1(s).rest + 3); // not straight back down
    day(s, 2);
    expect(floor1(s).now).toBeCloseTo(floor1(s).rest + floor1(s).body + floor1(s).waste, 0);
  });

  it("a floor can have its own thermostat, and go back to the hole's", () => {
    const s = hole();
    s.layout.hole.floors = 2;
    expect(applyCommand(s, { type: "setThermostat", celsius: 15, floor: 2 }).ok).toBe(true);
    expect(floorHeats(s, config)[1]!.setpoint).toBe(15);
    expect(floorHeats(s, config)[1]!.override).toBe(true);
    expect(floorHeats(s, config)[0]!.setpoint).toBe(config.temperature.setpointC);
    applyCommand(s, { type: "setThermostat", celsius: null, floor: 2 });
    expect(floorHeats(s, config)[1]!.override).toBe(false);
    expect(applyCommand(s, { type: "setThermostat", celsius: 15, floor: 9 }).ok).toBe(false);
    // Kept within range.
    applyCommand(s, { type: "setThermostat", celsius: 99 });
    expect(s.temperature!.setpoint).toBe(config.temperature.setpointRangeC[1]);
  });

  it("lose power after life support and before industry", () => {
    const rank = (p: string) => config.economy.priorities.indexOf(p as never);
    expect(rank(roomDef("heater").priority!)).toBeGreaterThan(rank(roomDef("life_support").priority!));
    expect(rank(roomDef("heater").priority!)).toBeLessThan(rank(roomDef("smelter").priority ?? config.economy.defaultPriority));
  });
});

describe("body heat, waste heat and radiators", () => {
  it("people and a smelter warm their floor; a radiator cools it back to the thermostat", () => {
    const s = hole();
    s.deposits = ["ore"];
    s.resources.ore = 500;
    const quiet = floor1(s).target;
    const smelter = build(s, "smelter", ring(1, 3, 0, 4));
    powered(s, 0.1);
    expect(floor1(s).waste).toBeGreaterThan(0);
    expect(floor1(s).body).toBeGreaterThan(0); // its crew
    expect(floor1(s).target).toBeGreaterThan(quiet + 4);
    // A packed, busy floor overheats; a radiator brings it down to the thermostat.
    build(s, "smelter", ring(1, 3, 4, 4));
    build(s, "smelter", ring(1, 3, 8, 4));
    applyCommand(s, { type: "setThermostat", celsius: 20 });
    s.temperature!.floors = [35];
    powered(s, 3);
    const passive = floor1(s).rest + floor1(s).body + floor1(s).waste;
    expect(F(passive)).toBeGreaterThan(80); // too hot to live by
    expect(floor1(s).now).toBeCloseTo(passive, 0);
    build(s, "radiator", ring(1, 2, 2));
    build(s, "radiator", ring(1, 2, 4));
    powered(s, 3);
    expect(floor1(s).cooling).toBeGreaterThan(0);
    expect(floor1(s).now).toBeCloseTo(20, 0);
    expect(s.layout.rooms.some((r) => r.id === smelter)).toBe(true);
  });

  it("heavy industry adds CO2 to the air", () => {
    const s = hole();
    s.deposits = ["ore"];
    s.resources.ore = 500;
    build(s, "smelter", ring(1, 3, 0, 4));
    const before = s.resources.co2 ?? 0;
    powered(s, 0.2);
    expect((s.resources.co2 ?? 0) - before).toBeGreaterThan(0.5);
  });
});

describe("comfort", () => {
  it("by temperature: a boost in the 60s and 70s, a little off in the 50s, more in the 40s, a lot below, and too hot past 80", () => {
    expect(comfortAt(C(70), config)).toBeGreaterThan(0);
    expect(comfortAt(C(62), config)).toBeGreaterThan(0);
    expect(comfortAt(C(55), config)).toBeLessThan(0);
    expect(comfortAt(C(45), config)).toBeLessThan(comfortAt(C(55), config));
    expect(comfortAt(C(30), config)).toBeLessThan(comfortAt(C(45), config));
    expect(comfortAt(C(85), config)).toBeLessThan(0);
    expect(comfortAt(C(95), config)).toBeLessThan(comfortAt(C(85), config));
  });

  it("homes feel their floor's temperature", () => {
    const s = hole();
    const dorm = build(s, "bunk_dorm", ring(1, 1, 1, 2));
    const room = s.layout.rooms.find((r) => r.id === dorm)!;
    s.temperature!.floors = [C(40)];
    updateHappiness(s, config, true);
    const cold = homeParts(s, room, config).find((p) => p.id === "temperature")!.value;
    s.temperature!.floors = [C(70)];
    updateHappiness(s, config, true);
    const warm = homeParts(s, room, config).find((p) => p.id === "temperature")!.value;
    expect(cold).toBeLessThan(-1);
    expect(warm).toBeGreaterThan(0);
  });
});

describe("the kits", () => {
  it("a new game's first hole has a heater, and its first floor warms toward the thermostat", () => {
    const w = createWorld(cfg0, 1);
    const home = w.holes[0]!;
    expect(home.layout.rooms.some((r) => r.type === "heater")).toBe(true);
    const snap = makeSnapshot(home, cfg0);
    expect(snap.temperature.floors[0]!.heaters).toBe(1);
    expect(snap.temperature.setpoint).toBe(cfg0.temperature.setpointC);
  });
});

describe("the views", () => {
  it("read °F by default, °C by the setting, and change the units back and forth", async () => {
    const t = await import("../src/view/temperature");
    expect(t.formatTemperature(18.3)).toBe("65 °F");
    expect(t.formatTemperature(18.3, "C")).toBe("18 °C");
    expect(t.formatTemperatureChange(12.5)).toBe("+23 °F");
    expect(t.fromUnits(t.inUnits(21.4))).toBeCloseTo(21.4, 6);
    expect(t.temperatureTint(0).color).toBe(t.TEMPERATURE_COLORS.cold);
    expect(t.temperatureTint(20).color).toBe(t.TEMPERATURE_COLORS.comfortable);
    expect(t.temperatureTint(35).color).toBe(t.TEMPERATURE_COLORS.hot);
  });

  it("the room panel shows a room's floor temperature, and a heater's lift, load and thermostat", async () => {
    const { panelModel } = await import("../src/view/roomPanel");
    const s = hole();
    const id = build(s, "heater", ring(1, 2, 2));
    powered(s, 0.2);
    const snap = makeSnapshot(s, config);
    const room = s.layout.rooms.find((r) => r.id === id)!;
    const m = panelModel(snap, room);
    const rows = m.sections.flatMap((x) => x.rows);
    expect(rows.find((r) => r.k === "Temperature")?.text).toMatch(/°F/);
    expect(rows.find((r) => r.k === "Heats")?.text).toMatch(/^\+\d+ °F at full power/);
    expect(rows.find((r) => r.k === "Working")?.text).toMatch(/% of full power/);
    expect(rows.find((r) => r.k === "Working")?.tip).toMatch(/°F/);
    expect(m.sections.find((x) => x.id === "work")?.open).toBe(true);
    expect(m.glance.some((c) => c.label === "Temperature")).toBe(true);
  });

  it("the charts record the floors' average, the coldest and the thermostat", () => {
    const s = hole();
    day(s, 0.2);
    expect(s.history!.hourly.tempAverage!.length).toBeGreaterThan(0);
    expect(s.history!.hourly.thermostat!.at(-1)).toBeCloseTo(config.temperature.setpointC, 1);
  });
});
