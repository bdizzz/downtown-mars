import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config as baseConfig, type SimConfig } from "../src/sim/config";
import { capacities, roomSpec } from "../src/sim/economy";
import { LABELS } from "../src/sim/ledger";
import type { Location } from "../src/sim/placement";
import { roomName } from "../src/sim/roomName";
import { roomDef } from "../src/sim/rooms";
import { createInitialState, type SimState } from "../src/sim/state";
import { step } from "../src/sim/step";

// Water as a closed loop (T-005): clean water used turns gray, the recycler
// treats gray back into clean, tailings and life support are the leaks.

// No Earth drops: these are about what the hole does with its own water.
const config: SimConfig = { ...baseConfig, earth: { ...baseConfig.earth, firstDropDay: 1e6 } };

const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });
const build = (s: SimState, room: string, at: Location) => {
  const r = applyCommand(s, { type: "build", room, at });
  if (!r.ok) throw new Error(`${room}: ${r.reason}`);
  if (at.kind === "ring" && at.ring > 1) applyCommand(s, { type: "connectRoom", roomId: r.roomId!, finish: "rock" });
  return s.layout.rooms.find((x) => x.id === r.roomId)!;
};
const days = (s: SimState, n: number) => {
  for (let i = 0; i < n * config.ticksPerDay; i++) step(s, config);
};

function hole(): SimState {
  const s = createInitialState(config);
  s.drill.active = false;
  Object.assign(s.resources, { metal: 200, machinery: 40, electronics: 20, rock: 300, rawFood: 100, power: 50 });
  return s;
}

describe("the water loop", () => {
  it("turns the water people and rooms use into gray, one for one", () => {
    const s = hole();
    build(s, "galley", ring(1, 1, 2));
    days(s, 1);
    const day = s.ledger.days.at(-1)!;
    const used = day.water?.out ?? {};
    const gray = day.grayWater?.in ?? {};
    expect(gray[LABELS.household]).toBeCloseTo(used[LABELS.household]!, 6);
    expect(gray.Galley).toBeCloseTo(used.Galley!, 6);
  });

  it("life support is a true sink: the water it splits for oxygen is gone", () => {
    expect(roomSpec({ ...build(hole(), "life_support", ring(1, 2, 3, 4)) }, config).makes.grayWater).toBeUndefined();
  });

  it("industry sends some of its water to tailings", () => {
    const s = hole();
    const plant = build(s, "concrete_plant", ring(1, 1, 2, 2));
    const spec = roomSpec(plant, config);
    expect(spec.makes.grayWater).toBeCloseTo(spec.uses.water! / 2);
    expect(spec.makes.tailings).toBeCloseTo(spec.uses.water! / 2);
    expect(roomDef("brickworks").returnsWater).toEqual({ grayWater: 0.75, tailings: 0.25 });
  });

  it("tailings with nowhere to go just disappear, and never hold a room back", () => {
    const s = hole();
    const plant = build(s, "concrete_plant", ring(1, 1, 2, 2));
    s.resources.tailings = capacities(s, config).tailings!;
    step(s, config);
    expect(s.roomStatus[plant.id]?.limit).toBeUndefined();
    expect(s.ledger.current.tailings?.out[LABELS.lost]).toBeGreaterThan(0);
  });

  it("with the gray tanks full, rooms that use water stall", () => {
    const s = hole();
    const galley = build(s, "galley", ring(1, 1, 2));
    s.resources.grayWater = capacities(s, config).grayWater!;
    step(s, config);
    expect(s.roomStatus[galley.id]).toMatchObject({ rate: 0, limit: "drain:grayWater" });
  });

  it("the recycler drains gray water first, so rooms keep running while it keeps up", () => {
    const s = hole();
    const galley = build(s, "galley", ring(1, 1, 2));
    build(s, "water_recycler", ring(1, 2, 3, 4));
    s.resources.grayWater = capacities(s, config).grayWater!;
    s.resources.water = 100;
    step(s, config);
    expect(s.roomStatus[galley.id]?.limit).not.toBe("drain:grayWater");
  });

  it("the recycler returns about 97% as clean water, the rest as soil", () => {
    const { uses, makes } = roomDef("water_recycler");
    expect(makes.water! / uses.grayWater!).toBeGreaterThan(0.95);
    expect(makes.water! / uses.grayWater!).toBeLessThan(0.99);
    expect(makes.soil).toBeGreaterThan(0);
    // A full soil store doesn't stop it: the sludge is a byproduct.
    const s = hole();
    const rec = build(s, "water_recycler", ring(1, 2, 3, 4));
    Object.assign(s.resources, { grayWater: 100, water: 0, soil: capacities(s, config).soil ?? 0 });
    step(s, config);
    expect(s.roomStatus[rec.id]?.rate).toBeGreaterThan(0);
  });

  it("wells bring in gray water, which needs treating", () => {
    expect(roomDef("deep_well_pump").makes).toEqual({ grayWater: expect.any(Number) });
  });
});

describe("water tanks", () => {
  it("hold clean water unless set to gray water or tailings", () => {
    const s = hole();
    const before = capacities(s, config);
    const tank = build(s, "water_tank", ring(1, 1, 2));
    const size = roomDef("water_tank").stores!.water!;
    expect(capacities(s, config).water).toBe(before.water! + size);
    expect(applyCommand(s, { type: "setHolds", roomId: tank.id, holds: "grayWater" }).ok).toBe(true);
    expect(capacities(s, config)).toMatchObject({ water: before.water, grayWater: before.grayWater! + size });
    expect(roomName(tank)).toBe("Gray water tank");
    applyCommand(s, { type: "setHolds", roomId: tank.id, holds: "water" });
    expect(tank.holds).toBeUndefined();
    expect(roomName(tank)).toBe("Water tank");
  });

  it("refuses what a room can't hold", () => {
    const s = hole();
    const tank = build(s, "water_tank", ring(1, 1, 2));
    const galley = build(s, "galley", ring(1, 1, 3));
    expect(applyCommand(s, { type: "setHolds", roomId: tank.id, holds: "o2" }).ok).toBe(false);
    expect(applyCommand(s, { type: "setHolds", roomId: galley.id, holds: "grayWater" }).ok).toBe(false);
  });
});
