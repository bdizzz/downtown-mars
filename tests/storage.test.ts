import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { capacities } from "../src/sim/economy";
import type { Location, RoomInstance } from "../src/sim/placement";
import { deserialize, serialize } from "../src/sim/save";
import { createInitialState, type SimState } from "../src/sim/state";
import { step } from "../src/sim/step";
import { freeSpace, isStorable, roomFill, settleStorage, STORABLE, storageCaps, usedSpace } from "../src/sim/storage";
import { createWorld } from "../src/sim/world";
import { withStorage } from "./worlds";
import { distancesFrom, pathsFor } from "../src/sim/paths";

const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });
const pod = (s: SimState) => s.layout.rooms.find((r) => r.type === "landing_pod")!;
const roomOf = (s: SimState, id: number) => s.layout.rooms.find((r) => r.id === id)!;

function fresh(): SimState {
  const s = createInitialState(config);
  s.drill.active = false;
  s.earth.nextDropTick = 1e9;
  return s;
}

function build(s: SimState, room: string, at: Location): RoomInstance {
  const r = applyCommand(s, { type: "build", room, at });
  if (!r.ok) throw new Error(r.reason);
  // Its cost comes out of storage now, not mixed in with the goods a test adds.
  settleStorage(s);
  return roomOf(s, r.roomId!);
}

/** The landing pod, full to the brim with metal (none of the kit's goods leave it). */
function fillPod(s: SimState): void {
  s.resources.metal = (s.resources.metal ?? 0) + freeSpace(pod(s));
  settleStorage(s);
}

describe("storage", () => {
  withStorage();

  it("dry goods need storage; water, air and power keep their own", () => {
    expect(isStorable("metal")).toBe(true);
    expect(isStorable("rations")).toBe(true);
    expect(isStorable("water")).toBe(false);
    expect(isStorable("o2")).toBe(false);
    expect(isStorable("power")).toBe(false);
  });

  it("a new colony's landing pod holds its starting stock, with room to spare", () => {
    const s = createInitialState(config);
    for (const [id, amount] of Object.entries(config.startingStock)) {
      if (isStorable(id)) expect(pod(s).contents?.[id], id).toBe(amount);
    }
    expect(freeSpace(pod(s))).toBeGreaterThan(0);
    // The free space is open to every good, ore included.
    expect(capacities(s, config).ore).toBe(freeSpace(pod(s)));
  });

  it("a new storage room allows everything, and its space counts for every good", () => {
    const s = fresh();
    const w = build(s, "warehouse", ring(1, 1, 2, 2));
    expect(w.allows).toBeUndefined();
    const caps = storageCaps(s);
    for (const id of STORABLE) expect(caps[id], id).toBeCloseTo((pod(s).contents?.[id] ?? 0) + freeSpace(pod(s)) + 200);
  });

  it("a room's goods can be chosen: all, some or none, storable goods only", () => {
    const s = fresh();
    const w = build(s, "storeroom", ring(1, 1, 2));
    expect(applyCommand(s, { type: "setAllows", roomId: w.id, allows: ["metal", "brick"] }).ok).toBe(true);
    expect(w.allows).toEqual(["brick", "metal"].sort((a, b) => STORABLE.indexOf(a) - STORABLE.indexOf(b)));
    expect(applyCommand(s, { type: "setAllows", roomId: w.id, allows: [] }).ok).toBe(true);
    expect(w.allows).toEqual([]);
    expect(applyCommand(s, { type: "setAllows", roomId: w.id, allows: STORABLE }).ok).toBe(true);
    expect(w.allows).toBeUndefined();
    expect(applyCommand(s, { type: "setAllows", roomId: w.id, allows: ["water"] }).ok).toBe(false);
    const farm = build(s, "farm", ring(1, 2, 9, 4));
    expect(applyCommand(s, { type: "setAllows", roomId: farm.id, allows: ["metal"] })).toMatchObject({ ok: false, reason: "The farm doesn't store goods" });
  });

  it("goods share a room's space first come, first served: rock can fill a warehouse", () => {
    const s = fresh();
    const w = build(s, "warehouse", ring(1, 1, 2, 2));
    fillPod(s);
    s.resources.rock = (s.resources.rock ?? 0) + 150;
    settleStorage(s);
    expect(w.contents?.rock).toBeCloseTo(150);
    // Rock keeps coming: it takes the rest, and there's no room left for food.
    s.resources.rock! += 100;
    settleStorage(s);
    expect(usedSpace(w)).toBeCloseTo(200);
    expect(storageCaps(s).rations).toBeCloseTo(s.resources.rations!);
  });

  it("what doesn't fit is lost", () => {
    const s = fresh();
    s.resources.metal = 1000;
    step(s, config);
    expect(s.resources.metal).toBeCloseTo((pod(s).contents?.metal ?? 0));
    expect(usedSpace(pod(s))).toBeCloseTo(600);
    expect(s.ledger.current.metal?.out.Overflow).toBeGreaterThan(0);
  });

  it("a good goes to the allowing room nearest to where it's made", () => {
    const s = fresh();
    const a = build(s, "storeroom", ring(1, 1, 5));
    const b = build(s, "storeroom", ring(1, 1, 1));
    const farm = build(s, "farm", ring(1, 2, 9, 4));
    expect(applyCommand(s, { type: "connectRoom", roomId: farm.id, finish: "rock" }).ok).toBe(true);
    applyCommand(s, { type: "setCrop", roomId: farm.id, crop: "hemp" });
    // The pod (by the entrance) keeps out the fiber.
    applyCommand(s, { type: "setAllows", roomId: pod(s).id, allows: STORABLE.filter((id) => id !== "fiber") });
    const d = distancesFrom(pathsFor(s.layout), farm.id, "walk");
    const [near, far] = d.get(a.id)! < d.get(b.id)! ? [a, b] : [b, a];
    for (let i = 0; i < config.ticksPerDay; i++) step(s, config);
    expect(s.resources.fiber ?? 0).toBeGreaterThan(0);
    expect(near.contents?.fiber ?? 0).toBeCloseTo(s.resources.fiber!);
    expect(far.contents?.fiber ?? 0).toBe(0);
    // Not allowed there: it goes to the next nearest.
    applyCommand(s, { type: "setAllows", roomId: near.id, allows: ["metal"] });
    step(s, config);
    expect(near.contents?.fiber ?? 0).toBe(0);
    expect(far.contents?.fiber ?? 0).toBeCloseTo(s.resources.fiber!);
  });

  it("goods a room no longer allows move out to rooms that do", () => {
    const s = fresh();
    const a = build(s, "storeroom", ring(1, 1, 2));
    const b = build(s, "storeroom", ring(1, 1, 5));
    fillPod(s);
    applyCommand(s, { type: "setAllows", roomId: b.id, allows: [] });
    s.resources.rock! += 50;
    settleStorage(s);
    expect(a.contents?.rock).toBeCloseTo(50);
    applyCommand(s, { type: "setAllows", roomId: b.id, allows: ["rock"] });
    applyCommand(s, { type: "setAllows", roomId: a.id, allows: ["metal"] });
    settleStorage(s);
    expect(a.contents?.rock ?? 0).toBe(0);
    expect(b.contents?.rock).toBeCloseTo(50);
  });

  it("what's used comes out of the rooms", () => {
    const s = fresh();
    const w = build(s, "warehouse", ring(1, 1, 2, 2));
    fillPod(s);
    s.resources.brick! += 100;
    settleStorage(s);
    expect(w.contents?.brick).toBeCloseTo(100);
    s.resources.brick! -= 40;
    settleStorage(s);
    const total = s.layout.rooms.reduce((n, r) => n + (r.contents?.brick ?? 0), 0);
    expect(total).toBeCloseTo(s.resources.brick!);
    expect(roomFill(s, w).byGood.brick).toBeLessThan(100);
  });

  it("a demolished room's goods move to rooms with space, or are lost", () => {
    const s = fresh();
    const a = build(s, "storeroom", ring(1, 1, 2));
    const w = build(s, "warehouse", ring(1, 1, 4, 2));
    applyCommand(s, { type: "setAllows", roomId: w.id, allows: [] });
    fillPod(s);
    s.resources.rock! += 80;
    settleStorage(s);
    expect(a.contents?.rock).toBeCloseTo(80);
    applyCommand(s, { type: "setAllows", roomId: w.id, allows: STORABLE });
    expect(applyCommand(s, { type: "demolish", roomId: a.id }).ok).toBe(true);
    settleStorage(s);
    expect(w.contents?.rock ?? 0).toBeGreaterThanOrEqual(80 - 1e-6);
    expect(s.resources.rock).toBeCloseTo((pod(s).contents?.rock ?? 0) + (w.contents?.rock ?? 0));
  });

  it("old saves: space set aside becomes the goods allowed, and each room keeps its share", () => {
    const w = createWorld(config);
    const file = JSON.parse(serialize(w));
    file.version = 21;
    const rooms = file.state.holes[0].layout.rooms as RoomInstance[];
    const p = rooms.find((r) => r.type === "landing_pod")!;
    delete p.contents;
    p.allocation = { rock: 300, metal: 100, rations: 200 };
    file.state.holes[0].resources.rock = 150;
    const loaded = deserialize(JSON.stringify(file));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const after = pod(loaded.world.holes[0]!);
    expect(after.allocation).toBeUndefined();
    expect(after.allows).toEqual(["rock", "metal", "rations"].sort((a, b) => STORABLE.indexOf(a) - STORABLE.indexOf(b)));
    expect(after.contents?.rock).toBe(150);
  });

  it("very old saves keep what they could hold, in the landing pod", () => {
    const w = createWorld(config);
    const file = JSON.parse(serialize(w));
    file.version = 13;
    const p = file.state.holes[0].layout.rooms.find((r: { type: string }) => r.type === "landing_pod");
    delete p.allocation;
    delete p.contents;
    const loaded = deserialize(JSON.stringify(file));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const after = pod(loaded.world.holes[0]!);
    expect(after.storageUnits).toBeGreaterThan(600);
    expect(after.allows).toContain("rock");
    expect(after.allows).toContain("glass");
  });
});
