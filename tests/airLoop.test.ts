import { describe, expect, it } from "vitest";
import { airAmount, airPct, fillAir } from "../src/sim/air";
import { applyCommand } from "../src/sim/commands";
import { config as baseConfig, type SimConfig } from "../src/sim/config";
import { capacities } from "../src/sim/economy";
import { openCells } from "../src/sim/excavation";
import type { Location } from "../src/sim/placement";
import { roomDef } from "../src/sim/rooms";
import { createInitialState, type SimState } from "../src/sim/state";
import { step } from "../src/sim/step";

// The air loop (PLAN-M16 steps 3, 4 and 6; T-028, T-029, T-031): the CO2 scrubber turns breath back
// into oxygen, the electrolyzer makes new air from water only as the hole grows, and gas tanks are
// ballast both ways.

const config: SimConfig = { ...baseConfig, earth: { ...baseConfig.earth, firstDropDay: 1e6 } };
const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });
const days = (s: SimState, n: number) => {
  for (let i = 0; i < n * config.ticksPerDay; i++) step(s, config);
};
const build = (s: SimState, room: string, at: Location) => {
  const r = applyCommand(s, { type: "build", room, at });
  if (!r.ok) throw new Error(`${room}: ${r.reason}`);
  if (at.kind === "ring" && at.ring > 1) applyCommand(s, { type: "connectRoom", roomId: r.roomId!, finish: "rock" });
  return s.layout.rooms.find((x) => x.id === r.roomId)!;
};
/** A hole with a scrubber and an electrolyzer, its air made after building them, and plenty of water and power. */
function colony(): SimState {
  const s = createInitialState(config);
  s.drill.active = false;
  build(s, "galley", ring(1, 1, 2));
  build(s, "life_support", ring(1, 2, 3, 4));
  build(s, "electrolyzer", ring(1, 2, 8, 2));
  fillAir(s, config);
  return s;
}
const electrolyzerWater = (s: SimState) => s.ledger.days.at(-1)?.water?.out.Electrolyzer ?? 0;

describe("the air loop", () => {
  it("a steady colony uses almost no water for air; digging shows up as electrolyzer water", () => {
    const s = colony();
    days(s, 3);
    // Scrubbing turns what's breathed back into oxygen: the electrolyzer stands by.
    expect(electrolyzerWater(s)).toBeLessThan(0.5);
    expect(airPct(s, config, "o2")).toBeGreaterThan(config.air.o2Target - 0.3);
    // Dig out four cells: 1,600 m³ of new air to make, at 21%.
    openCells(s.layout, [0, 1, 2, 3].map((slot) => ({ floor: 1, ring: 3, slot })));
    days(s, 2);
    const want = 1600 * config.air.unitsPerM3 * (config.air.o2Target / 100);
    const el = roomDef("electrolyzer");
    const split = s.ledger.days.slice(-2).reduce((a, d) => a + (d.water?.out.Electrolyzer ?? 0), 0);
    const newSpace = s.ledger.days.slice(-2).reduce((a, d) => a + (d.water?.then?.Electrolyzer?.["Air for new space"] ?? 0), 0);
    // The new air's water, plus a little for breath the scrubber hasn't caught up with yet.
    expect(split).toBeGreaterThan((want * el.uses.water!) / el.makes.o2!);
    expect(split).toBeLessThan((want * el.uses.water!) / el.makes.o2! + 3);
    expect(newSpace).toBeCloseTo((want * el.uses.water!) / el.makes.o2!, 0);
    expect(airPct(s, config, "o2")).toBeCloseTo(config.air.o2Target, 0);
  });
});

describe("gas tanks", () => {
  it("hold O2 by default, or CO2 when set", () => {
    const s = colony();
    const tank = build(s, "gas_tank", ring(1, 1, 5));
    expect(capacities(s, config).o2Tank).toBe(200);
    applyCommand(s, { type: "setHolds", roomId: tank.id, holds: "co2Tank" });
    expect(capacities(s, config).o2Tank ?? 0).toBe(0);
    expect(capacities(s, config).co2Tank).toBe(200);
  });

  it("are ballast: O2 above the target goes in, and comes back out when the air runs short, before the electrolyzer runs", () => {
    const s = colony();
    build(s, "gas_tank", ring(1, 1, 5));
    s.resources.o2 = airAmount(s, config, config.air.o2Target) + 150;
    step(s, config);
    expect(s.resources.o2Tank).toBeCloseTo(150, 0);
    expect(airPct(s, config, "o2")).toBeCloseTo(config.air.o2Target, 1);
    // Dig a cell: the tanks cover it first, so the electrolyzer splits less water.
    openCells(s.layout, [{ floor: 1, ring: 3, slot: 0 }]);
    step(s, config);
    expect(s.resources.o2Tank).toBe(0);
    expect(s.ledger.current.o2Tank?.out["Into the air"]).toBeCloseTo(150, 0);
  });

  it("when full, leave the extra in the air: that's how oxygen climbs too high", () => {
    const s = colony();
    build(s, "gas_tank", ring(1, 1, 5));
    s.resources.o2 = airAmount(s, config, 25);
    step(s, config);
    expect(s.resources.o2Tank).toBe(200);
    expect(airPct(s, config, "o2")).toBeGreaterThan(config.air.o2High);
  });

  it("the tank fill slider has the electrolyzer fill the O2 tanks once the air is at its target, as the O2 reserve", () => {
    const s = colony();
    build(s, "gas_tank", ring(1, 1, 5));
    expect(applyCommand(s, { type: "setTankFill", fill: 0.5 }).ok).toBe(true);
    days(s, 1);
    expect(s.resources.o2Tank).toBeCloseTo(100, 0);
    expect(airPct(s, config, "o2")).toBeLessThan(config.air.o2Target + 0.1);
    expect(s.ledger.days.at(-1)!.water!.then!.Electrolyzer!["Into the O2 reserve"]).toBeGreaterThan(0);
  });

  it("supply drops land oxygen in the tanks first", () => {
    const s = createInitialState(baseConfig);
    s.drill.active = false;
    build(s, "gas_tank", ring(1, 1, 5));
    s.resources.o2 = airAmount(s, baseConfig, 15); // short of the target: the drop makes it up
    s.earth.nextDropTick = s.tick + 1;
    step(s, baseConfig);
    expect(s.resources.o2Tank).toBeGreaterThan(0);
    expect(s.ledger.current.o2Tank?.in["Earth drops"]).toBeGreaterThan(0);
  });

  it("at 0% condition keep what they hold but take no more", () => {
    const s = colony();
    const a = build(s, "gas_tank", ring(1, 1, 5));
    build(s, "gas_tank", ring(1, 1, 6));
    s.resources.o2Tank = 300;
    a.condition = 0;
    // One working tank (200) plus what the broken one already holds beyond it (100).
    expect(capacities(s, config).o2Tank).toBe(300);
    s.resources.o2Tank = 150;
    expect(capacities(s, config).o2Tank).toBe(200);
  });

  it("water tanks follow the same 0% rule", () => {
    const s = colony();
    const tank = build(s, "water_tank", ring(1, 1, 5));
    const base = capacities(s, config).water!;
    tank.condition = 0;
    // Holding 50 past the working tanks: it keeps those 50, and has room for no more.
    s.resources.water = base - 150;
    expect(capacities(s, config).water).toBe(base - 150);
    s.resources.water = base - 250;
    expect(capacities(s, config).water).toBe(base - 200);
  });
});
