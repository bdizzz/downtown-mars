import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { drillSpeed } from "../src/sim/digging";
import { computeEffects, effectAt } from "../src/sim/effects";
import { createHole } from "../src/sim/geometry";
import { stepUnlocks } from "../src/sim/people";
import { createLayout, placeRoom, type Location } from "../src/sim/placement";
import { roomDef } from "../src/sim/rooms";
import { createInitialState, type SimState } from "../src/sim/state";
import { step } from "../src/sim/step";

// The catalog rooms built for F-015 (T-132, T-141): excavator bay, plaza,
// spiral stair and lounge.

const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });

function hole(): SimState {
  const s = createInitialState(config);
  s.drill.active = false;
  Object.assign(s.resources, { rock: 2000, metal: 2000, brick: 2000, machinery: 500, electronics: 500, water: 2000, rations: 2000 });
  return s;
}

describe("excavator bay", () => {
  it("speeds the drill once it's running, by its boost at full staff", () => {
    const s = hole();
    expect(drillSpeed(s)).toBe(1);
    const r = applyCommand(s, { type: "build", room: "excavator_bay", at: ring(1, 1, 2, 2) });
    if (!r.ok) throw new Error(r.reason);
    for (let i = 0; i < 5; i++) step(s, config);
    const rate = s.roomStatus[r.roomId!]?.rate ?? 0;
    expect(rate).toBeGreaterThan(0);
    expect(drillSpeed(s)).toBeCloseTo(1 + roomDef("excavator_bay").drillBoost! * rate);
  });

  it("digs a floor sooner, with the same rock", () => {
    const dig = (bay: boolean) => {
      const s = hole();
      if (bay) applyCommand(s, { type: "build", room: "excavator_bay", at: ring(1, 1, 2, 2) });
      s.drill.active = true;
      const rock0 = s.resources.rock!;
      let ticks = 0;
      while (s.layout.hole.floors < 2) {
        step(s, config);
        ticks++;
      }
      return { ticks, rock: s.resources.rock! - rock0 };
    };
    const plain = dig(false);
    const fast = dig(true);
    expect(fast.ticks).toBeLessThan(plain.ticks);
  });
});

describe("spiral stair and plaza unlocks", () => {
  it("wait for their populations", () => {
    const s = hole();
    s.drill.active = true;
    for (let i = 0; i < 2000 && s.layout.hole.floors < 3; i++) step(s, config);
    expect(applyCommand(s, { type: "build", room: "spiral_stair", at: ring(1, 1, 5) })).toMatchObject({ ok: false, reason: "Unlocks at 200 colonists in this hole" });
    s.population.count = 200;
    s.tick = 0; // unlocks are checked once a day
    stepUnlocks(s, config);
    expect(applyCommand(s, { type: "build", room: "spiral_stair", at: ring(1, 1, 5) })).toMatchObject({ ok: true });
    expect(applyCommand(s, { type: "build", room: "plaza", at: ring(2, 1, 0, 4) })).toMatchObject({ ok: false, reason: "Unlocks at 500 colonists in this hole" });
  });

  it("a spiral stair spans two floors and no more", () => {
    const s = hole();
    s.unlocks = ["spiralStair"];
    s.drill.active = true;
    for (let i = 0; i < 4000 && s.layout.hole.floors < 3; i++) step(s, config);
    expect(s.layout.hole.floors).toBe(3);
    const r = applyCommand(s, { type: "build", room: "spiral_stair", at: ring(1, 1, 5) });
    if (!r.ok) throw new Error(r.reason);
    const stair = s.layout.rooms.find((x) => x.id === r.roomId)!;
    expect(new Set(stair.cells.map((c) => c.floor))).toEqual(new Set([1, 2]));
    expect(applyCommand(s, { type: "build", room: "spiral_stair", at: ring(3, 1, 5) })).toMatchObject({ ok: false });
  });
});

describe("lounge", () => {
  it("lifts comfort two slots out", () => {
    const l = createLayout(createHole(10, 2, 3, config.geometry));
    placeRoom(l, "lounge", ring(1, 1, 4));
    const f = computeEffects(l);
    expect(effectAt(f, "comfort", { floor: 1, ring: 1, slot: 4 })).toBeCloseTo(1);
    expect(effectAt(f, "comfort", { floor: 1, ring: 1, slot: 5 })).toBeGreaterThan(0);
    expect(effectAt(f, "comfort", { floor: 1, ring: 1, slot: 6 })).toBeGreaterThan(0);
    expect(effectAt(f, "comfort", { floor: 1, ring: 1, slot: 7 })).toBe(0);
  });

  it("is open from the start, unstaffed, on a little power", () => {
    const def = roomDef("lounge");
    expect(def.unlockedBy).toBeUndefined();
    expect(def.staff).toBe(0);
    expect(def.uses).toEqual({ power: 0.5 });
  });
});
