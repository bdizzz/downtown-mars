import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { applyCommand } from "../src/sim/commands";
import { galleryEdges, radialEdge, arcAt } from "../src/sim/edges";
import { ensureFloors, type Location } from "../src/sim/placement";
import { buildPaths, distancesFrom, pathsFor, STEP_M, stepsBetween } from "../src/sim/paths";
import { createInitialState, type SimState } from "../src/sim/state";

// Milestone 11, step 4: the sealed network as a graph with distances.

const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });

/** Two dug floors; floor 2 is rock but for what's built on it. */
function deep(): SimState {
  const s = createInitialState(config);
  s.drill.active = false;
  s.layout.hole.floors = 2;
  ensureFloors(s.layout);
  Object.assign(s.resources, { rock: 900, brick: 300, metal: 300, machinery: 60, electronics: 60 });
  return s;
}
function build(s: SimState, room: string, at: Location): number {
  const r = applyCommand(s, { type: "build", room, at });
  if (!r.ok) throw new Error(`${room}: ${r.reason}`);
  return r.roomId!;
}
function corridors(s: SimState, ids: string[]): void {
  const r = applyCommand(s, { type: "drawCorridors", edges: ids, finish: "rock" });
  if (!r.ok) throw new Error(r.reason);
}
const finish = (s: SimState) => applyCommand(s, { type: "consoleFinish" });
const tubes = (s: SimState, floor: number, slots: number[]) => slots.map((i) => galleryEdges(s.layout.hole, floor)[i]!.id);

describe("the network graph", () => {
  it("measures walks along gallery tubes, longer for rooms further apart", () => {
    const s = deep();
    const dorm = build(s, "bunk_dorm", ring(2, 1, 1, 2));
    const near = build(s, "clinic", ring(2, 1, 3));
    const far = build(s, "galley", ring(2, 1, 6));
    corridors(s, tubes(s, 2, [1, 2, 3, 4, 5, 6]));
    finish(s);
    const a = stepsBetween(s.layout, dorm, near)!;
    const b = stepsBetween(s.layout, dorm, far)!;
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    // The same both ways.
    expect(stepsBetween(s.layout, far, dorm)).toBeCloseTo(b);
  });

  it("has no way across a gap in the tubes", () => {
    const s = deep();
    const dorm = build(s, "bunk_dorm", ring(2, 1, 1, 2));
    const clinic = build(s, "clinic", ring(2, 1, 5));
    corridors(s, tubes(s, 2, [1, 2, 4, 5]));
    finish(s);
    expect(stepsBetween(s.layout, dorm, clinic)).toBeNull();
    corridors(s, tubes(s, 2, [3]));
    finish(s);
    expect(stepsBetween(s.layout, dorm, clinic)).not.toBeNull();
  });

  it("never walks through a private room: corridors on both its sides don't join through it", () => {
    const s = deep();
    const dorm = build(s, "bunk_dorm", ring(2, 1, 1, 2));
    build(s, "galley", ring(2, 1, 3));
    const clinic = build(s, "clinic", ring(2, 1, 4));
    // A corridor on each side of the galley: the dorm's right side and the clinic's left.
    corridors(s, [radialEdge(s.layout.hole, 2, 1, 3).id, radialEdge(s.layout.hole, 2, 1, 4).id]);
    finish(s);
    expect(stepsBetween(s.layout, dorm, clinic)).toBeNull();
    // A corridor round the back of the galley joins them.
    corridors(s, [arcAt(s.layout.hole, 2, 1, 3.5 / 9)!.id]);
    finish(s);
    expect(stepsBetween(s.layout, dorm, clinic)).not.toBeNull();
  });

  it("links floors by stairs, for people and air; an elevator carries people only", () => {
    const s = deep();
    const up = build(s, "galley", ring(1, 1, 3)); // on floor 1's gallery
    const down = build(s, "clinic", ring(2, 1, 7));
    build(s, "stairwell", ring(1, 1, 8));
    corridors(s, tubes(s, 2, [7, 8]));
    finish(s);
    expect(stepsBetween(s.layout, up, down, "walk")).not.toBeNull();
    expect(stepsBetween(s.layout, up, down, "air")).not.toBeNull();

    const t = deep();
    t.unlocks = ["cargo"];
    const up2 = build(t, "galley", ring(1, 1, 3));
    const down2 = build(t, "clinic", ring(2, 1, 7));
    build(t, "elevator", ring(1, 1, 8));
    corridors(t, tubes(t, 2, [7, 8]));
    finish(t);
    expect(stepsBetween(t.layout, up2, down2, "walk")).not.toBeNull();
    expect(stepsBetween(t.layout, up2, down2, "air")).toBeNull();
  });

  it("counts a step as about a room across, and stops at a reach", () => {
    const s = deep();
    const dorm = build(s, "bunk_dorm", ring(2, 1, 1, 2));
    const clinic = build(s, "clinic", ring(2, 1, 6));
    corridors(s, tubes(s, 2, [1, 2, 3, 4, 5, 6]));
    finish(s);
    const paths = buildPaths(s.layout);
    const all = distancesFrom(paths, dorm, "walk");
    const m = all.get(clinic)!;
    expect(m / STEP_M).toBeGreaterThan(2);
    expect(m / STEP_M).toBeLessThan(8);
    expect(distancesFrom(paths, dorm, "walk", m - 1).has(clinic)).toBe(false);
    // Cached until the layout changes.
    expect(pathsFor(s.layout)).toBe(pathsFor(s.layout));
  });
});
