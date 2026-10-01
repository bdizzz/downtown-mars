import { describe, expect, it } from "vitest";
import { setRoomWindows, shaftBorders } from "../src/sim/windows";
import { config } from "../src/sim/config";
import { applyCommand } from "../src/sim/commands";
import { createInitialState, type SimState } from "../src/sim/state";
import { step } from "../src/sim/step";
import { CONDITION, conditionOf, maintenanceQueue, maintenanceView, overallCondition, stepCondition } from "../src/sim/condition";
import type { Location } from "../src/sim/placement";
import { homeFactors } from "../src/sim/happiness";
import { galleryEdges } from "../src/sim/edges";

const tpd = config.ticksPerDay;
const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });

function hole(): SimState {
  const s = createInitialState(config);
  s.drill.active = false;
  Object.assign(s.resources, { rock: 2000, metal: 2000, brick: 2000, machinery: 500, electronics: 500, water: 2000, rations: 2000 });
  return s;
}
function build(s: SimState, room: string, at: Location): number {
  const r = applyCommand(s, { type: "build", room, at });
  if (!r.ok) throw new Error(`${room}: ${r.reason}`);
  return r.roomId!;
}
const room = (s: SimState, id: number) => s.layout.rooms.find((r) => r.id === id)!;
/** Wear alone, no breakdowns, for a number of days. */
function wear(s: SimState, days: number) {
  const b = CONDITION.breakdown.chancePerDay;
  CONDITION.breakdown.chancePerDay = 0;
  for (let i = 0; i < days * tpd; i++) {
    s.tick++;
    stepCondition(s, config);
  }
  CONDITION.breakdown.chancePerDay = b;
}

describe("room condition", () => {
  it("wears down day by day once built, heavy rooms faster; the entrance doesn't", () => {
    const s = hole();
    const galley = build(s, "galley", ring(1, 1, 3));
    const battery = s.layout.rooms.find((r) => r.type === "battery_bank")!;
    const entrance = s.layout.rooms.find((r) => r.type === "entrance")!;
    wear(s, 10);
    expect(conditionOf(room(s, galley))).toBeCloseTo(1 - 10 * CONDITION.decayPerDay, 3);
    expect(conditionOf(battery)).toBeLessThan(conditionOf(room(s, galley)));
    expect(conditionOf(entrance)).toBe(1);
    expect(overallCondition(s)).toBeLessThan(1);
  });

  it("slows a worn room by 30%, and stops one at 0%", () => {
    const s = hole();
    const galley = build(s, "galley", ring(1, 1, 3));
    step(s, config);
    const full = s.roomStatus[galley]!.rate;
    room(s, galley).condition = 0.2;
    step(s, config);
    expect(s.roomStatus[galley]!.rate).toBeCloseTo(full * CONDITION.wornOutput, 2);
    expect(s.roomStatus[galley]!.limit).toBe("worn");
    room(s, galley).condition = 0;
    step(s, config);
    expect(s.roomStatus[galley]!.rate).toBe(0);
    expect(s.roomStatus[galley]!.limit).toBe("broken");
  });

  it("queues rooms from 60% down, worst first; nothing above", () => {
    const s = hole();
    const a = build(s, "galley", ring(1, 1, 3));
    const b = build(s, "restroom", ring(1, 1, 4));
    const c = build(s, "clinic", ring(1, 1, 5));
    room(s, a).condition = 0.5;
    room(s, b).condition = 0.3;
    room(s, c).condition = 0.7;
    expect(maintenanceQueue(s).map((r) => r.id)).toEqual([b, a]);
    // One handed back part-done goes to the front, whatever its condition.
    room(s, a).repair = { done: 1, work: 4 };
    expect(maintenanceQueue(s)[0]!.id).toBe(a);
  });

  it("maintenance repairs the worst room back to 100%, one per maintenance room at a time", () => {
    const s = hole();
    const rooms = [build(s, "galley", ring(1, 1, 3)), build(s, "restroom", ring(1, 1, 4)), build(s, "clinic", ring(1, 1, 5))];
    rooms.forEach((id, i) => (room(s, id).condition = 0.2 + i * 0.1));
    const m1 = build(s, "maintenance", ring(1, 1, 6, 2));
    step(s, config);
    // One lane: the worst.
    expect(maintenanceView(s).lanes.map((l) => l.target)).toEqual([rooms[0]]);
    const m2 = build(s, "maintenance", ring(1, 2, 1, 2));
    step(s, config);
    expect(new Set(maintenanceView(s).lanes.map((l) => l.target))).toEqual(new Set([rooms[0], rooms[1]]));
    for (let i = 0; i < 3 * tpd && conditionOf(room(s, rooms[0]!)) < 1; i++) step(s, config);
    expect(conditionOf(room(s, rooms[0]!))).toBe(1);
    expect(room(s, rooms[0]!).repair).toBeUndefined();
    expect([m1, m2].every((id) => room(s, id).type === "maintenance")).toBe(true);
  });

  it("hands a part-done room back to the front of the queue when its crew stops", () => {
    const s = hole();
    const a = build(s, "galley", ring(1, 1, 3));
    const b = build(s, "restroom", ring(1, 1, 4));
    room(s, a).condition = 0.4;
    room(s, b).condition = 0.2;
    const m = build(s, "maintenance", ring(1, 1, 6, 2));
    for (let i = 0; i < 20; i++) step(s, config);
    expect(maintenanceView(s).lanes[0]!.target).toBe(b);
    const done = room(s, b).repair!.done;
    expect(done).toBeGreaterThan(0);
    applyCommand(s, { type: "setRoomControl", roomId: m, paused: true });
    step(s, config);
    step(s, config);
    const q = maintenanceQueue(s);
    expect(q[0]!.id).toBe(b);
    expect(room(s, b).repair!.done).toBeCloseTo(done, 5);
  });

  it("cleaning services take only people-heavy rooms, the worst of those", () => {
    const s = hole();
    s.unlocks = ["cleaning"];
    const battery = s.layout.rooms.find((r) => r.type === "battery_bank")!;
    const galley = build(s, "galley", ring(1, 1, 3));
    battery.condition = 0.1;
    room(s, galley).condition = 0.5;
    build(s, "cleaning_service", ring(1, 1, 6, 2));
    step(s, config);
    expect(maintenanceView(s).lanes[0]!.target).toBe(galley);
    expect(maintenanceView(s).lanes[0]!.kind).toBe("cleanable");
  });

  it("makes residents of a worn home, and everyone around worn shared rooms, less comfortable", () => {
    const s = hole();
    const dorm = build(s, "bunk_dorm", ring(1, 1, 3, 2));
    const galley = build(s, "galley", ring(1, 1, 5));
    // Its own shaft windows (no tube in front), so its comfort isn't already at the floor.
    for (const slot of [3, 4]) delete s.layout.corridors[galleryEdges(s.layout.hole, 1)[slot]!.id];
    setRoomWindows(room(s, dorm), shaftBorders(s.layout, room(s, dorm)), true);
    const fresh = homeFactors(s, room(s, dorm), config).comfort;
    room(s, dorm).condition = 0.1;
    const wornHome = homeFactors(s, room(s, dorm), config).comfort;
    expect(wornHome).toBeLessThan(fresh);
    room(s, galley).condition = 0.1;
    expect(homeFactors(s, room(s, dorm), config).comfort).toBeLessThan(wornHome);
  });

  it("breaks something now and then, knocking a room's condition down, with a message", () => {
    const s = hole();
    build(s, "galley", ring(1, 1, 3));
    const before = new Map(s.layout.rooms.map((r) => [r.id, conditionOf(r)]));
    for (s.tick = 0; s.tick < 200 * tpd; s.tick++) {
      stepCondition(s, config);
      if (s.messages.some((m) => m.text.includes("broke down"))) break;
    }
    const msg = s.messages.find((m) => m.text.includes("broke down"));
    expect(msg).toBeDefined();
    expect(before.size).toBeGreaterThan(0);
  });

  it("unlocks the cleaning service at the population milestone", () => {
    const s = hole();
    expect(applyCommand(s, { type: "build", room: "cleaning_service", at: ring(1, 1, 6, 2) }).ok).toBe(false);
    s.unlocks = ["cleaning"];
    expect(applyCommand(s, { type: "build", room: "cleaning_service", at: ring(1, 1, 6, 2) }).ok).toBe(true);
  });
});
