import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { applyCommand } from "../src/sim/commands";
import { corridors, hasBulkhead } from "../src/sim/corridors";
import { cellEdges, galleryEdges } from "../src/sim/edges";
import { computeEffects, effectOnRoom } from "../src/sim/effects";
import { ensureFloors, type Location } from "../src/sim/placement";
import { stepsBetween } from "../src/sim/paths";
import { createInitialState, type SimState } from "../src/sim/state";

// Milestone 12: bulkheads, sealed doors across corridors. People pass; air and smell don't.

const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });
function build(s: SimState, room: string, at: Location): number {
  const r = applyCommand(s, { type: "build", room, at });
  if (!r.ok) throw new Error(`${room}: ${r.reason}`);
  return r.roomId!;
}
const finish = (s: SimState) => applyCommand(s, { type: "consoleFinish" });

/** Floor 2: a dorm and a brickworks two slots apart, joined only by a corridor behind them in ring 2's rock. */
function setup() {
  const s = createInitialState(config);
  s.drill.active = false;
  s.layout.hole.floors = 2;
  ensureFloors(s.layout);
  s.unlocks = ["brickworks"];
  Object.assign(s.resources, { rock: 900, brick: 300, metal: 300, machinery: 60 });
  const dorm = build(s, "bunk_dorm", ring(2, 1, 1, 2));
  const works = build(s, "brickworks", ring(2, 1, 5, 2));
  // Tubes from the dorm to the brickworks.
  const tubes = galleryEdges(s.layout.hole, 2).slice(1, 7).map((e) => e.id);
  expect(applyCommand(s, { type: "drawCorridors", edges: tubes, finish: "rock" }).ok).toBe(true);
  finish(s);
  return { s, dorm, works, tubes };
}

describe("bulkheads", () => {
  it("can't go in a gallery tube, or where there's no corridor", () => {
    const { s, tubes } = setup();
    expect(applyCommand(s, { type: "setBulkhead", edges: [tubes[2]!], on: true })).toMatchObject({ ok: false, reason: expect.stringMatching(/Gallery tubes/) });
    expect(applyCommand(s, { type: "setBulkhead", edges: ["R2.2.3"], on: true })).toMatchObject({ ok: false, reason: expect.stringMatching(/none here/) });
  });

  it("stop air but not people, cost metal, and come out free", () => {
    const s = createInitialState(config);
    s.drill.active = false;
    s.layout.hole.floors = 2;
    ensureFloors(s.layout);
    s.unlocks = ["brickworks"];
    Object.assign(s.resources, { rock: 900, brick: 300, metal: 300, machinery: 60 });
    // Floor 2 is rock: a dorm and a brickworks, joined only by a corridor along the back of ring 1.
    const works = build(s, "brickworks", ring(2, 1, 2, 2));
    const dorm = build(s, "bunk_dorm", ring(2, 1, 6, 2));
    const back = [3, 4, 5, 6].flatMap((slot) => cellEdges(s.layout.hole, { floor: 2, ring: 1, slot }).filter((e) => e.kind === "arc" && e.circle === 1).map((e) => e.id));
    expect(applyCommand(s, { type: "drawCorridors", edges: back, finish: "rock" }).ok).toBe(true);
    finish(s);
    expect(stepsBetween(s.layout, dorm, works, "walk")).not.toBeNull();
    expect(stepsBetween(s.layout, dorm, works, "air")).not.toBeNull();
    const seal = back[Math.floor(back.length / 2)]!;
    const metal = s.resources.metal!;
    expect(applyCommand(s, { type: "setBulkhead", edges: [seal], on: true }).ok).toBe(true);
    expect(s.resources.metal!).toBeCloseTo(metal - corridors.bulkhead.cost.metal!);
    expect(stepsBetween(s.layout, dorm, works, "walk")).not.toBeNull();
    expect(stepsBetween(s.layout, dorm, works, "air")).toBeNull();
    // The brickworks' fumes no longer reach the dorm.
    expect(effectOnRoom(computeEffects(s.layout), "airQuality", s.layout.rooms.find((r) => r.id === dorm)!)).toBe(0);
    expect(applyCommand(s, { type: "setBulkhead", edges: [seal], on: false }).ok).toBe(true);
    expect(s.resources.metal!).toBeCloseTo(metal - corridors.bulkhead.cost.metal!);
    expect(stepsBetween(s.layout, dorm, works, "air")).not.toBeNull();
  });

  it("go when their corridor is filled in", () => {
    const s = createInitialState(config);
    s.drill.active = false;
    Object.assign(s.resources, { rock: 900, metal: 300 });
    expect(applyCommand(s, { type: "drawCorridors", edges: ["R1.2.4"], finish: "rock" }).ok).toBe(true);
    finish(s);
    expect(applyCommand(s, { type: "setBulkhead", edges: ["R1.2.4"], on: true }).ok).toBe(true);
    expect(hasBulkhead(s.layout, "R1.2.4")).toBe(true);
    expect(applyCommand(s, { type: "removeCorridors", edges: ["R1.2.4"] }).ok).toBe(true);
    finish(s);
    expect(s.layout.bulkheads?.["R1.2.4"]).toBeUndefined();
  });
});
