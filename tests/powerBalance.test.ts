import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { charging } from "../src/sim/economy";
import { roomDef } from "../src/sim/rooms";
import { daylightAt } from "../src/sim/weather";

// The balance target for solar and batteries (#615), on Bryon's month-38 hole: 89 people drawing
// about 73 power a month, with 9 solar arrays and 5 battery banks. It should get through a clear
// night from an empty bank with a little to spare, bank a little more each clear day, and from a
// few clear days' charge run low near the end of a two-month storm rather than at its start.
// Run tick by tick with the sim's own daylight and charging, at a steady draw. (A loaded copy of
// that save matched this within a point or two: about 13 left at the first dawn.)

const ARRAYS = 9;
const BANKS = 5;
const DRAW = 73;
const tpd = config.ticksPerDay;
const dt = 1 / tpd;
const made = roomDef("solar_array").makes.power!;
const rate = ARRAYS * roomDef("solar_array").chargePerDay!;
const cap = BANKS * roomDef("battery_bank").stores!.power!;
const storm = config.weather.dustStorm;

const sunrise = config.weather.daylight.sunrise;

/**
 * Runs `days` from sunrise with `bank` stored; `stormy(day)` says when a storm blows. Returns the
 * hours the bank was flat (rooms going dark), its lowest, and what it held at each dawn after the first.
 */
function run(days: number, bank: number, stormy: (day: number) => boolean = () => false) {
  let low = bank;
  let flat = 0;
  const dawns: number[] = [];
  for (let t = 0; t < days * tpd; t++) {
    const day = t / tpd;
    const hour = (sunrise + day * 24) % 24;
    const out = ARRAYS * made * daylightAt(hour, config) * (stormy(day) ? storm.output : 1);
    const spare = out - DRAW;
    bank = spare > 0 ? Math.min(cap, bank + charging(spare, rate, config) * dt) : bank + spare * dt;
    if (bank < 0) {
      bank = 0;
      flat++;
    }
    low = Math.min(low, bank);
    if (t > 0 && t % tpd === 0) dawns.push(bank);
  }
  return { flatHours: (flat / tpd) * 24, low, dawns, end: bank };
}

describe("solar and batteries carry a grown hole through the night (#615)", () => {
  it("gets through a clear night from an empty bank at sunrise, with some left at dawn", () => {
    const r = run(3.01, 0) // a touch over 3 days, to see the third dawn;
    expect(r.flatHours).toBe(0);
    expect(r.dawns[0]).toBeGreaterThan(5);
    // Each clear day banks more than the night draws, so the bank fills over the days.
    expect(r.dawns[1]).toBeGreaterThan(r.dawns[0]!);
    expect(r.dawns[2]).toBeGreaterThan(r.dawns[1]!);
  });

  it("from a few clear days' charge, a two-month storm runs the bank low near its end", () => {
    const charged = run(4, 0).end;
    const r = run(2, charged, () => true);
    // Lasts the storm, or nearly: at most an hour or two dark at its very end.
    expect(r.flatHours).toBeLessThan(2);
    expect(r.dawns[0]).toBeGreaterThan(0);
    // But it's a close thing.
    expect(r.low).toBeLessThan(cap * 0.1);
  });

  it("a full bank rides out the longest storm", () => {
    const r = run(storm.lastsDays[1], cap, () => true);
    expect(r.flatHours).toBe(0);
  });
});
