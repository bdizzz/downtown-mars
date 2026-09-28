import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { bandwidth, construction, corridorWork, roomWork } from "../src/sim/construction";
import type { Location } from "../src/sim/placement";
import { deserialize, serialize } from "../src/sim/save";
import { createInitialState, type SimState } from "../src/sim/state";
import { step } from "../src/sim/step";
import { createWorld } from "../src/sim/world";
import { withConstructionTime } from "./worlds";

const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });
const HOUR = config.ticksPerDay / 24;

function site(): SimState {
  const s = createInitialState(config);
  s.drill.active = false;
  s.earth.nextDropTick = 1e9;
  Object.assign(s.resources, { rock: 300, brick: 150, metal: 150, machinery: 30, electronics: 30 });
  return s;
}
const hours = (s: SimState, h: number) => {
  for (let i = 0; i < Math.round(h * HOUR); i++) step(s, config);
};
const build = (s: SimState, room: string, at: Location) => {
  const r = applyCommand(s, { type: "build", room, at });
  if (!r.ok) throw new Error(`${room}: ${r.reason}`);
  return s.layout.rooms.find((x) => x.id === r.roomId)!;
};
const room = (s: SimState, id: number) => s.layout.rooms.find((r) => r.id === id);

describe("construction time", () => {
  withConstructionTime();

  it("a committed room holds its slots but doesn't run until it's built", () => {
    const s = site();
    const galley = build(s, "galley", ring(1, 1, 2));
    expect(galley.building).toBe(true);
    expect(s.construction.queue).toHaveLength(1);
    step(s, config);
    expect(s.roomStatus[galley.id]).toBeUndefined(); // not active: no staff, no output
    expect(applyCommand(s, { type: "build", room: "restroom", at: ring(1, 1, 2) })).toMatchObject({ ok: false, reason: "Overlaps Galley" });
    hours(s, roomWork("galley") / construction.baseBandwidth + 0.2);
    expect(room(s, galley.id)!.building).toBe(false);
    expect(s.construction.queue).toHaveLength(0);
    expect(s.messages.at(-1)?.text).toMatch(/Galley built/);
    step(s, config);
    expect(s.roomStatus[galley.id]!.staff).toBeGreaterThan(0);
  });

  it("builds one job at a time, in the order committed", () => {
    const s = site();
    const a = build(s, "galley", ring(1, 1, 2)); // 6 h
    const b = build(s, "restroom", ring(1, 1, 3)); // 6 h
    hours(s, 7);
    expect(room(s, a.id)!.building).toBe(false);
    expect(room(s, b.id)!.building).toBe(true);
    hours(s, 6);
    expect(room(s, b.id)!.building).toBe(false);
  });

  it("priority construction moves a job to the front", () => {
    const s = site();
    const a = build(s, "galley", ring(1, 1, 2));
    const b = build(s, "restroom", ring(1, 1, 3));
    const job = s.construction.queue.find((j) => j.roomId === b.id)!;
    expect(applyCommand(s, { type: "prioritize", jobId: job.id }).ok).toBe(true);
    hours(s, 7);
    expect(room(s, b.id)!.building).toBe(false);
    expect(room(s, a.id)!.building).toBe(true);
  });

  it("cancelling a room still in the queue refunds it in full", () => {
    const s = site();
    const metal = s.resources.metal!;
    const g = build(s, "galley", ring(1, 1, 2));
    hours(s, 2);
    applyCommand(s, { type: "demolish", roomId: g.id });
    expect(s.resources.metal).toBe(metal);
    expect(s.construction.queue).toHaveLength(0);
  });

  it("a blueprint on a floor still being dug doesn't hold up the queue", () => {
    const s = site();
    const f = s.layout.hole.floors + 1;
    const deep = build(s, "galley", ring(f, 1, 2));
    const near = build(s, "restroom", ring(1, 1, 3));
    hours(s, 7);
    expect(room(s, near.id)!.building).toBe(false);
    expect(room(s, deep.id)!.building).toBe(true);
  });

  it("corridors wait in the queue too, by length, and don't link until built", () => {
    const s = site();
    build(s, "galley", ring(1, 1, 2));
    hours(s, 7);
    expect(applyCommand(s, { type: "drawCorridors", edges: ["R1.1.2"], finish: "rock" }).ok).toBe(true);
    expect(s.layout.corridorLinked?.["R1.1.2"]).toBe(false);
    const job = s.construction.queue.at(-1)!;
    expect(job).toMatchObject({ kind: "corridors", edges: ["R1.1.2"] });
    expect(job.work).toBeCloseTo(corridorWork(s.layout, ["R1.1.2"], config));
    expect(job.work).toBeLessThan(roomWork("galley"));
    hours(s, job.work + 0.2);
    expect(s.layout.corridorLinked?.["R1.1.2"]).toBe(true);
  });

  it("filling in a corridor not built yet takes it off the plan with a full refund", () => {
    const s = site();
    build(s, "galley", ring(1, 1, 2));
    const rock = s.resources.rock!;
    applyCommand(s, { type: "drawCorridors", edges: ["R1.1.2"], finish: "rock" });
    applyCommand(s, { type: "removeCorridors", edges: ["R1.1.2"] });
    expect(s.resources.rock).toBe(rock);
    expect(s.layout.corridors["R1.1.2"]).toBeUndefined();
    expect(s.construction.queue.some((j) => j.kind === "corridors")).toBe(false);
  });

  it("stairs reach their new floor when the extension is built", () => {
    const s = site();
    s.layout.hole.floors = 4;
    while (s.layout.grid.length < 5) s.layout.grid.push(s.layout.hole.ringSlots.map((n) => new Array(n).fill(0)));
    const stairs = build(s, "stairwell", ring(1, 1, 3));
    hours(s, roomWork("stairwell") + 0.2);
    applyCommand(s, { type: "build", room: "stairwell", at: ring(2, 1, 3) });
    const floors = () => new Set(room(s, stairs.id)!.cells.map((c) => c.floor));
    expect(floors()).toEqual(new Set([1, 2]));
    expect(room(s, stairs.id)!.pendingCells?.map((c) => c.floor)).toEqual([3]);
    hours(s, roomWork("stairwell") + 0.2);
    expect(floors()).toEqual(new Set([1, 2, 3]));
  });

  it("base bandwidth without a construction office", () => {
    expect(bandwidth(site())).toBe(construction.baseBandwidth);
  });

  it("the queue survives a save", () => {
    const w = createWorld(config);
    const s = w.holes[0]!;
    Object.assign(s.resources, { rock: 999, metal: 999 });
    applyCommand(s, { type: "build", room: "galley", at: ring(1, 1, 2) });
    const loaded = deserialize(serialize(w));
    expect(loaded.ok && loaded.world.holes[0]!.construction.queue).toEqual(s.construction.queue);
  });
});

describe("construction offices", () => {
  withConstructionTime();

  it("add bandwidth by size, scaled by how they're staffed", () => {
    const s = site();
    const office = build(s, "site_office", ring(1, 1, 2));
    hours(s, roomWork("site_office") + 0.5);
    step(s, config);
    expect(bandwidth(s)).toBeCloseTo(construction.baseBandwidth + 1 * s.roomStatus[office.id]!.rate);
    // A bigger office adds more.
    build(s, "construction_office", ring(1, 1, 3, 2));
    hours(s, roomWork("construction_office") / bandwidth(s) + 0.5);
    step(s, config);
    expect(bandwidth(s)).toBeGreaterThan(construction.baseBandwidth + 3);
    // Paused: it adds nothing.
    applyCommand(s, { type: "setRoomControl", roomId: office.id, paused: true });
    step(s, config);
    expect(bandwidth(s)).toBeLessThan(construction.baseBandwidth + 3);
  });

  it("speed the queue up", () => {
    const slow = site();
    const fast = site();
    build(fast, "construction_office", ring(1, 1, 5, 2));
    hours(fast, roomWork("construction_office") + 0.5); // the office is up and staffed
    const a = build(slow, "life_support", ring(1, 1, 1, 4));
    const b = build(fast, "life_support", ring(1, 1, 1, 4));
    hours(slow, 12);
    hours(fast, 12);
    const progress = (s: SimState, id: number) => s.construction.queue.find((j) => j.roomId === id)?.done ?? Infinity; // done: gone from the queue
    expect(progress(fast, b.id)).toBeGreaterThan(progress(slow, a.id) * 2);
  });
});
