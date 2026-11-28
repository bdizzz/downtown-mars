import { afterEach, describe, expect, it } from "vitest";
import { config as baseConfig, type SimConfig } from "../src/sim/config";
import { chargeRate, charging, powerFlow } from "../src/sim/economy";
import { roomDef } from "../src/sim/rooms";
import { createInitialState, type SimState } from "../src/sim/state";
import { step } from "../src/sim/step";

// Batteries charge only as fast as they take power, and keep half of it (#609).
const config: SimConfig = { ...baseConfig, earth: { ...baseConfig.earth, firstDropDay: 1e6 } };
const dt = 1 / config.ticksPerDay;
const battery = roomDef("battery_bank");
const rate = battery.chargePerDay!;

function fresh(): SimState {
  const s = createInitialState(config);
  s.drill.active = false; // keep the numbers about power
  return s;
}

/** Steps one tick, returning what the battery gained and the flow the rooms ran at. */
function tick(s: SimState) {
  const before = s.resources.power ?? 0;
  step(s, config);
  return { gained: (s.resources.power ?? 0) - before, flow: powerFlow(s, config) };
}

afterEach(() => {
  battery.chargePerDay = rate;
});

describe("battery charging (#609)", () => {
  it("keeps the configured share of what it takes, and caps intake at its charge rate", () => {
    expect(config.economy.batteryEfficiency).toBe(0.5);
    expect(charging(30, 100, config)).toBeCloseTo(15);
    expect(charging(30, 20, config)).toBeCloseTo(10);
    expect(charging(-5, 100, config)).toBe(0);
  });

  it("adds up every working battery bank's rate", () => {
    const s = fresh();
    expect(chargeRate(s)).toBe(rate);
    const kit = s.layout.rooms.find((r) => r.type === "battery_bank")!;
    s.layout.rooms.push({ ...kit, id: 9999 });
    expect(chargeRate(s)).toBe(2 * rate);
    s.layout.rooms[s.layout.rooms.length - 1]!.building = { progress: 0 } as never;
    expect(chargeRate(s)).toBe(rate);
  });

  it("stores half the spare solar by day", () => {
    const s = fresh();
    const { gained, flow } = tick(s);
    expect(flow.made - flow.used).toBeGreaterThan(10);
    expect(gained).toBeCloseTo((flow.made - flow.used) * 0.5 * dt, 6);
    expect(flow.charging).toBeCloseTo((flow.made - flow.used) * 0.5, 6);
  });

  it("stores no faster than the batteries' charge rate, however much is spare", () => {
    battery.chargePerDay = 5;
    const s = fresh();
    const { gained, flow } = tick(s);
    expect(flow.made - flow.used).toBeGreaterThan(5);
    expect(gained).toBeCloseTo(5 * 0.5 * dt, 6);
  });

  it("loses nothing on the way out: rooms draw from the battery at night as before", () => {
    const s = fresh();
    s.resources.power = 30;
    // Run to the dead of night, when the arrays make nothing.
    let t = 0;
    while (powerFlow(s, config).made > 0 || t < 10) {
      step(s, config);
      t++;
    }
    const { gained, flow } = tick(s);
    expect(flow.made).toBe(0);
    expect(gained).toBeCloseTo(-flow.used * dt, 6);
  });
});

describe("what the player reads about charging (#609)", () => {
  it("the Power cell and the battery's panel say how much is charging, of how much spare, and the loss", async () => {
    const { makeSnapshot } = await import("../src/sim/snapshot");
    const { barItems } = await import("../src/view/hudItems");
    const { panelRows } = await import("../src/view/roomPanel");
    const s = fresh();
    for (let i = 0; i < 10; i++) step(s, config);
    const snap = makeSnapshot(s, config);
    const cell = barItems(snap).flat().find((b) => b.id === "res:power:flow")!;
    const note = cell.notes!.find((n) => n.startsWith("Charging"))!;
    expect(note).toMatch(/^Charging \S+ a month of \S+ spare, half lost to charging$/);
    const bank = s.layout.rooms.find((r) => r.type === "battery_bank")!;
    const row = panelRows(snap, bank).before.find((r) => r.k === "Charges")!;
    expect(row.text).toBe("up to 100/month, half lost");
    expect(row.tip).toBe(note);
  });
});
