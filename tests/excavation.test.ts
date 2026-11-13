import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { emptyCells, isOpen, openCells } from "../src/sim/excavation";
import { rockPerFloor, ticksToDig } from "../src/sim/digging";
import { checkPlacement, recomputeAccess, type Spot } from "../src/sim/placement";
import { deserialize, serialize, SAVE_VERSION } from "../src/sim/save";
import { createInitialState, type SimState } from "../src/sim/state";
import { step } from "../src/sim/step";
import { createWorld } from "../src/sim/world";
import { allRock, withConstructionTime } from "./worlds";
import { construction, queueView, roomWork } from "../src/sim/construction";
import { roomDef } from "../src/sim/rooms";
import { ringAt, cellAt } from "./spots";
import { GRID } from "./spots";
import { areaOf } from "../src/sim/space";
import { shaftUnits } from "../src/sim/excavation";

const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Spot => (ringAt(floor, r, slot, w, d));

function rich(): SimState {
  const s = createInitialState(config);
  s.drill.active = false;
  Object.assign(s.resources, { rock: 400, brick: 200, metal: 200, machinery: 50, electronics: 50 });
  return s;
}

describe("excavation and empty space", () => {
  it("starts with ring 1 of floor 1 dug out (and the kit's rooms), and the rest solid rock", () => {
    const s = createInitialState(config);
    expect(isOpen(s.layout, cellAt(1, 1, 4))).toBe(true);
    expect(isOpen(s.layout, cellAt(1, 2, 4))).toBe(false);
    // The battery bank the kit sets up in ring 2 has its cell dug.
    const battery = s.layout.rooms.find((r) => r.type === "battery_bank")!;
    expect(battery.cells.every((c) => isOpen(s.layout, c))).toBe(true);
    expect(isOpen(s.layout, cellAt(1, 3, 4))).toBe(false);
  });

  it("the drill brings up only the shaft's rock, and leaves the new floor's cells as rock", () => {
    const s = createInitialState(config);
    const rock0 = s.resources.rock!;
    for (let i = 0; i < ticksToDig(2, config); i++) step(s, config);
    expect(s.layout.hole.floors).toBe(2);
    expect(rockPerFloor(s, config)).toBeCloseTo(shaftUnits(s.layout) * config.digging.rockPer100m2);
    // Far less than the 36 slots of rings 1–3 would hold.
    expect(rockPerFloor(s, config)).toBeLessThan(36 * config.digging.rockPer100m2 * 0.2);
    expect(s.resources.rock! - rock0).toBeGreaterThan(0);
    expect(isOpen(s.layout, cellAt(2, 1, 0))).toBe(false);
  });

  it("demolishing leaves empty space, not rock", () => {
    const s = rich();
    allRock(s.layout);
    const r = applyCommand(s, { type: "build", room: "clinic", at: ring(1, 3, 5) });
    expect(r.ok).toBe(true);
    applyCommand(s, { type: "demolish", roomId: r.ok ? r.roomId! : 0 });
    expect(isOpen(s.layout, cellAt(1, 3, 5))).toBe(true);
    expect(emptyCells(s.layout)).toContainEqual(expect.objectContaining(cellAt(1, 3, 5)));
  });

  it("empty space is walk-through: a room beside it is reached like beside a plaza", () => {
    const s = rich();
    allRock(s.layout);
    // A ring-3 room with rock between it and the gallery: cut off.
    const r = applyCommand(s, { type: "build", room: "clinic", at: ring(1, 3, 4) });
    const room = s.layout.rooms.find((x) => x.id === (r.ok ? r.roomId : 0))!;
    expect(room.connected).toBe(false);
    // Dig out the cells between it and the gallery (ring 3 slot 4 sits against slot 2 of rings 2 and 1).
    openCells(s.layout, [cellAt(1, 1, 2), cellAt(1, 2, 2)]);
    recomputeAccess(s.layout);
    expect(room.connected).toBe(true);
  });

  it("saves keep the dug cells; old saves keep their open shaft and only their rooms' cells dug", () => {
    const w = createWorld(config, 42);
    const back = deserialize(serialize(w));
    expect(back.ok && back.world.holes[0]!.layout.open).toEqual(w.holes[0]!.layout.open);
    expect(SAVE_VERSION).toBe(25);
    const old = JSON.parse(serialize(w));
    old.version = 14;
    for (const h of old.state.holes) delete h.layout.open;
    const migrated = deserialize(JSON.stringify(old));
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    const layout = migrated.world.holes[0]!.layout;
    expect(layout.openShaft).toBe(true);
    const battery = layout.rooms.find((r) => r.type === "battery_bank")!;
    expect(isOpen(layout, battery.cells[0]!)).toBe(true);
    expect(isOpen(layout, cellAt(1, 3, 1))).toBe(false);
  });
});

describe("excavating, then building", () => {
  withConstructionTime();
  const HOUR = config.ticksPerDay / 24;
  const hours = (s: SimState, h: number) => {
    for (let i = 0; i < Math.round(h * HOUR); i++) step(s, config);
  };
  /** Work-hours to dig out so many slots of ring 3's grid (about 122 m² each): digging goes by floor area. */
  const slotArea = areaOf(GRID, [cellAt(1, 3, 5)]);
  const dig = (slots = 1) => ((slots * slotArea) / 100) * construction.excavationHoursPer100m2;
  function site(): SimState {
    const s = rich();
    s.earth.nextDropTick = 1e9;
    return s;
  }

  it("a room on rock is dug out first, cell by cell, bringing up rock as it goes", () => {
    const s = site();
    const rock0 = s.resources.rock!;
    const r = applyCommand(s, { type: "build", room: "water_tank", at: ring(1, 3, 5) });
    expect(r.ok).toBe(true);
    const job = s.construction.queue[0]!;
    expect(job.dig).toBeCloseTo(dig());
    expect(job.work).toBeCloseTo(dig() + roomWork("water_tank"));
    expect(queueView(s).jobs[0]).toMatchObject({ phase: "excavating", label: "Water tank (excavating)" });
    hours(s, dig() / 2);
    expect(isOpen(s.layout, cellAt(1, 3, 5))).toBe(false);
    const cost = roomDef("water_tank").cost.rock ?? 0;
    expect(s.resources.rock!).toBeGreaterThan(rock0 - cost);
    hours(s, dig() / 2 + 0.2);
    expect(isOpen(s.layout, cellAt(1, 3, 5))).toBe(true);
    expect(s.resources.rock!).toBeCloseTo(rock0 - cost + (slotArea / 100) * config.digging.rockPer100m2, 0);
    expect(queueView(s).jobs[0]).toMatchObject({ phase: "building", label: "Water tank" });
  });

  it("on empty space there's nothing to dig, and nothing gained", () => {
    const s = site();
    const r = applyCommand(s, { type: "build", room: "water_tank", at: ring(1, 1, 5) }); // ring 1 starts dug out
    expect(r.ok).toBe(true);
    const job = s.construction.queue[0]!;
    expect(job.dig).toBeUndefined();
    expect(job.work).toBe(roomWork("water_tank"));
  });

  it("an empty room digs ahead: when it's done it's gone, leaving empty space", () => {
    const s = site();
    expect(checkPlacement(s.layout, "empty_room_s", ring(1, 1, 5))).toMatchObject({ ok: false, reason: "Already dug out" });
    const r = applyCommand(s, { type: "build", room: "empty_room_s", at: ring(1, 3, 6, 2) });
    expect(r.ok).toBe(true);
    expect(s.construction.queue[0]!.work).toBeCloseTo(dig(2));
    hours(s, dig(2) + 0.2);
    expect(s.layout.rooms.find((x) => x.type === "empty_room_s")).toBeUndefined();
    expect(emptyCells(s.layout)).toEqual(expect.arrayContaining([expect.objectContaining(cellAt(1, 3, 6)), expect.objectContaining(cellAt(1, 3, 7))]));
    // A room there now goes straight to building.
    applyCommand(s, { type: "build", room: "water_tank", at: ring(1, 3, 6) });
    expect(s.construction.queue[0]!.dig).toBeUndefined();
  });

  it("cancelled partway through, what's dug stays dug", () => {
    const s = site();
    const r = applyCommand(s, { type: "build", room: "empty_room_s", at: ring(1, 3, 6, 2) });
    expect(r.ok).toBe(true);
    hours(s, dig() + 0.2);
    applyCommand(s, { type: "cancelJob", jobId: s.construction.queue[0]!.id });
    expect(isOpen(s.layout, cellAt(1, 3, 6))).toBe(true);
    expect(isOpen(s.layout, cellAt(1, 3, 7))).toBe(false);
  });
});
