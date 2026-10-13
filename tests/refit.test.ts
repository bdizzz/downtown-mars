import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { applyCommand } from "../src/sim/commands";
import { finishAll, queueView, stepConstruction } from "../src/sim/construction";
import { homeFactors } from "../src/sim/happiness";
import { liningOf, MATERIALS, refitPlan, refitting, wallStep } from "../src/sim/materials";
import type { Location } from "../src/sim/placement";
import { createInitialState, type SimState } from "../src/sim/state";
import { step } from "../src/sim/step";
import { withConstructionTime } from "./worlds";

// Refits (T-033, docs/PLAN-M15.md "Upgrading"): a room's walls changed to any
// other lining through the construction queue, paid on commit, at half output
// while the crews work, and salvaging part of the old lining when it comes out.

const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });

function hole(): SimState {
  const s = createInitialState(config);
  s.drill.active = false;
  Object.assign(s.resources, { rock: 2000, metal: 2000, brick: 2000, glass: 100, machinery: 500, electronics: 500, water: 2000, rations: 2000 });
  return s;
}
function build(s: SimState, type: string, at: Location): number {
  const r = applyCommand(s, { type: "build", room: type, at });
  if (!r.ok) throw new Error(`${type}: ${r.reason}`);
  finishAll(s, config);
  return r.roomId!;
}
const room = (s: SimState, id: number) => s.layout.rooms.find((r) => r.id === id)!;
const line = (s: SimState, id: number, material: string, finish = "base") => applyCommand(s, { type: "consoleLining", roomId: id, material, finish });
const upgrade = (s: SimState, id: number, material: string, finish = "base") => applyCommand(s, { type: "upgradeRoom", roomId: id, material, finish });
const refitJob = (s: SimState, id: number) => s.construction?.queue.find((j) => j.kind === "upgrade" && j.roomId === id);
/** Work the queue until the room's refit is done. */
function finishRefit(s: SimState, id: number) {
  for (let i = 0; i < 100 * config.ticksPerDay && refitJob(s, id); i++) stepConstruction(s, config);
}

describe("refit pricing", () => {
  // An M dorm is 2 cells.
  const s = hole();
  const dorm = build(s, "bunk_dorm", ring(1, 1, 3, 2));
  const plan = (from: [string, string], to: [string, string]) => {
    line(s, dorm, ...from);
    return refitPlan(room(s, dorm), wallStep(to[0], to[1]))!;
  };

  it("pays the new lining per cell, both steps when it skips one", () => {
    expect(plan(["rock", "base"], ["brick", "base"])).toMatchObject({ cost: { brick: 16 }, work: 6, salvage: {} });
    expect(plan(["rock", "base"], ["brick", "fine"])).toMatchObject({ cost: { brick: 24 }, work: 12, salvage: {} });
    expect(plan(["brick", "base"], ["brick", "fine"])).toMatchObject({ cost: { brick: 8 }, work: 6, salvage: {} });
  });

  it("stripping back to bare rock is free, takes half the work and gives back half the material, rounded down", () => {
    expect(plan(["brick", "base"], ["rock", "base"])).toMatchObject({ cost: {}, work: 3, salvage: { brick: 8 } });
    expect(plan(["brick", "fine"], ["rock", "base"])).toMatchObject({ cost: {}, work: 6, salvage: { brick: 12 } });
    // The inlay's glass is lost; smoothed rock gives nothing back.
    expect(plan(["metal", "fine"], ["rock", "base"])).toMatchObject({ cost: {}, work: 7, salvage: { metal: 9 } });
    expect(plan(["rock", "fine"], ["rock", "base"]).salvage).toEqual({});
  });

  it("a finish taken off, or another material, salvages what comes out", () => {
    expect(plan(["brick", "fine"], ["brick", "base"])).toMatchObject({ cost: {}, work: 3, salvage: { brick: 4 } });
    expect(plan(["brick", "base"], ["metal", "base"])).toMatchObject({ cost: { metal: 12 }, work: 9, salvage: { brick: 8 } });
  });

  it("nothing to do to the lining it has", () => {
    line(s, dorm, "brick");
    expect(refitPlan(room(s, dorm), wallStep("brick", "base"))).toBeNull();
  });
});

describe("with construction time off", () => {
  it("a refit is done at once", () => {
    const s = hole();
    const dorm = build(s, "bunk_dorm", ring(1, 1, 3, 2));
    expect(upgrade(s, dorm, "brick", "fine").ok).toBe(true);
    expect(liningOf(room(s, dorm)).name).toBe("Patterned brick");
    expect(s.construction?.queue ?? []).toHaveLength(0);
  });
});

describe("the upgradeRoom command", () => {
  withConstructionTime();

  it("charges on commit, queues a refit and lines the room when done, with a fresh condition", () => {
    const s = hole();
    const dorm = build(s, "bunk_dorm", ring(1, 1, 3, 2));
    room(s, dorm).condition = 0.4;
    const brick = s.resources.brick!;
    expect(upgrade(s, dorm, "brick").ok).toBe(true);
    expect(s.resources.brick).toBe(brick - 16);
    expect(room(s, dorm).material).toBeUndefined();
    expect(queueView(s).jobs.find((j) => j.roomId === dorm)).toMatchObject({ kind: "upgrade", lead: "Refit", note: "in brick", label: "Refit Bunk dorm in brick" });
    finishRefit(s, dorm);
    expect(liningOf(room(s, dorm)).name).toBe("Brick");
    expect(room(s, dorm).condition).toBe(1);
    expect(s.messages.at(-1)?.text).toMatch(/refitted in brick\.$/);
  });

  it("strips a brick dorm back to rock and gets brick back when it's done", () => {
    const s = hole();
    const dorm = build(s, "bunk_dorm", ring(1, 1, 3, 2));
    line(s, dorm, "brick");
    const brick = s.resources.brick!;
    expect(upgrade(s, dorm, "rock").ok).toBe(true);
    expect(s.resources.brick).toBe(brick);
    expect(queueView(s).jobs.find((j) => j.roomId === dorm)?.label).toBe("Strip Bunk dorm back to bare rock");
    finishRefit(s, dorm);
    expect(room(s, dorm).material).toBeUndefined();
    expect(s.resources.brick).toBe(brick + 8);
    expect(s.messages.at(-1)?.text).toMatch(/stripped back to bare rock: brick 8 salvaged\.$/);
  });

  it("cancelling refunds in full and leaves the lining", () => {
    const s = hole();
    const dorm = build(s, "bunk_dorm", ring(1, 1, 3, 2));
    line(s, dorm, "brick");
    const metal = s.resources.metal!;
    const brick = s.resources.brick!;
    expect(upgrade(s, dorm, "metal").ok).toBe(true);
    stepConstruction(s, config);
    expect(applyCommand(s, { type: "cancelJob", jobId: refitJob(s, dorm)!.id }).ok).toBe(true);
    expect(s.resources.metal).toBe(metal);
    expect(s.resources.brick).toBe(brick);
    expect(room(s, dorm).material).toBe("brick");
  });

  it("one refit at a time: a new one replaces the queued one, refunding it", () => {
    const s = hole();
    const dorm = build(s, "bunk_dorm", ring(1, 1, 3, 2));
    const brick = s.resources.brick!;
    const metal = s.resources.metal!;
    expect(upgrade(s, dorm, "brick").ok).toBe(true);
    expect(upgrade(s, dorm, "brick").ok).toBe(false);
    expect(upgrade(s, dorm, "metal").ok).toBe(true);
    expect(s.construction!.queue.filter((j) => j.roomId === dorm)).toHaveLength(1);
    expect(s.resources.brick).toBe(brick);
    expect(s.resources.metal).toBe(metal - 12);
    // Asking for what it has calls the refit off.
    expect(upgrade(s, dorm, "rock").ok).toBe(true);
    expect(refitJob(s, dorm)).toBeUndefined();
    expect(s.resources.metal).toBe(metal);
  });

  it("demolishing the room refunds its refit", () => {
    const s = hole();
    const dorm = build(s, "bunk_dorm", ring(1, 1, 3, 2));
    const brick = s.resources.brick!;
    expect(upgrade(s, dorm, "brick").ok).toBe(true);
    expect(applyCommand(s, { type: "demolish", roomId: dorm }).ok).toBe(true);
    expect(s.resources.brick).toBe(brick);
    expect(s.construction!.queue).toHaveLength(0);
  });

  it("refuses rooms that can't have a lining, unbuilt rooms and what it can't afford", () => {
    const s = hole();
    const dorm = build(s, "bunk_dorm", ring(1, 1, 3, 2));
    const stairs = s.layout.rooms.find((r) => r.type === "entrance")!;
    expect(upgrade(s, stairs.id, "brick")).toMatchObject({ ok: false });
    expect(upgrade(s, dorm, "rock")).toMatchObject({ ok: false, reason: "It's bare rock already" });
    s.resources.metal = 5;
    expect(upgrade(s, dorm, "metal")).toMatchObject({ ok: false, reason: "Needs 7 more metal" });
    applyCommand(s, { type: "build", room: "galley", at: ring(1, 1, 6) });
    const galley = s.layout.rooms.at(-1)!;
    expect(upgrade(s, galley.id, "brick")).toMatchObject({ ok: false, reason: "Build it first" });
  });
});

describe("while a refit is under way", () => {
  withConstructionTime();
  it("only once crews start, the room runs at half output and a home's comfort dips", () => {
    const s = hole();
    const dorm = build(s, "bunk_dorm", ring(1, 1, 3, 2));
    const galley = build(s, "galley", ring(1, 1, 2));
    for (let i = 0; i < 20; i++) step(s, config);
    const rate = s.roomStatus[galley]!.rate;
    const comfort = homeFactors(s, room(s, dorm), config).comfort;
    expect(rate).toBeGreaterThan(0);

    // Queued behind another job: not yet.
    applyCommand(s, { type: "build", room: "restroom", at: ring(1, 1, 5) });
    expect(upgrade(s, galley, "brick").ok).toBe(true);
    expect(upgrade(s, dorm, "brick").ok).toBe(true);
    expect(refitting(s, room(s, galley))).toBe(false);
    step(s, config);
    expect(s.roomStatus[galley]!.limit).not.toBe("refit");

    // Started: half speed, and the home's comfort down.
    const restroom = s.layout.rooms.find((r) => r.type === "restroom" && r.building)!;
    applyCommand(s, { type: "prioritize", jobId: refitJob(s, galley)!.id });
    // The crews start this tick; the rooms run before they do, so it shows the next.
    step(s, config);
    step(s, config);
    expect(refitting(s, room(s, galley))).toBe(true);
    expect(s.roomStatus[galley]!.rate).toBeLessThanOrEqual(rate * MATERIALS.refit.output + 1e-9);
    expect(s.roomStatus[galley]!.limit).toBe("refit");
    applyCommand(s, { type: "prioritize", jobId: refitJob(s, dorm)!.id });
    step(s, config);
    expect(refitting(s, room(s, dorm))).toBe(true);
    expect(homeFactors(s, room(s, dorm), config).comfort).toBeCloseTo(comfort + MATERIALS.refit.comfort, 5);
    expect(restroom.building).toBe(true);
  });
});
