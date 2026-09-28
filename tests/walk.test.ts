import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { ensureFloors, type Location } from "../src/sim/placement";
import { createInitialState, type SimState } from "../src/sim/state";
import { openShaftRadius, ringRadii, slotAngles } from "../src/render3d/cylinder";
import { clear, stairsHere, step, walkable } from "../src/view/walk";
import { allRock } from "./worlds";

const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });

function site(): SimState {
  const s = createInitialState(config);
  s.drill.active = false;
  s.layout.hole.floors = 2;
  ensureFloors(s.layout);
  Object.assign(s.resources, { rock: 400, brick: 200, metal: 200, machinery: 50, electronics: 50 });
  allRock(s.layout);
  return s;
}
/** The middle of a cell, in metres. */
function mid(s: SimState, r: number, slot: number): [number, number] {
  const h = s.layout.hole;
  const [a0, a1] = slotAngles(slot, h.ringSlots[r - 1]!);
  const [r0, r1] = ringRadii(h, r);
  const a = (a0 + a1) / 2;
  const rr = (r0 + r1) / 2;
  return [rr * Math.cos(a), rr * Math.sin(a)];
}

describe("walking in first person", () => {
  it("the gallery is walkable, the open shaft and the rock aren't", () => {
    const s = site();
    const h = s.layout.hole;
    const g = (openShaftRadius(h) + h.shaftRadiusM) / 2;
    expect(walkable(s.layout, 1, g, 0.5)).toBe(true);
    expect(walkable(s.layout, 1, openShaftRadius(h) - 0.5, 0)).toBe(false);
    expect(walkable(s.layout, 1, ...mid(s, 3, 4))).toBe(false);
  });

  it("public rooms and empty space are walkable; private rooms are behind walls", () => {
    const s = site();
    applyCommand(s, { type: "build", room: "tiny_plaza", at: ring(1, 1, 3) });
    applyCommand(s, { type: "build", room: "galley", at: ring(1, 1, 4) });
    const r = applyCommand(s, { type: "build", room: "water_tank", at: ring(1, 1, 5) });
    if (r.ok) applyCommand(s, { type: "demolish", roomId: r.roomId! });
    expect(walkable(s.layout, 1, ...mid(s, 1, 3))).toBe(true);
    expect(walkable(s.layout, 1, ...mid(s, 1, 4))).toBe(false);
    expect(walkable(s.layout, 1, ...mid(s, 1, 5))).toBe(true);
  });

  it("corridors are walkable, through rock or along a room's side", () => {
    const s = site();
    // A spoke through the rock of ring 3, at the start of slot 6.
    applyCommand(s, { type: "drawCorridors", edges: ["R1.3.6"], finish: "rock" });
    const h = s.layout.hole;
    const [a] = slotAngles(6, h.ringSlots[2]!);
    const [r0, r1] = ringRadii(h, 3);
    const rr = (r0 + r1) / 2;
    expect(walkable(s.layout, 1, rr * Math.cos(a), rr * Math.sin(a))).toBe(true);
    // Well off to the side of it: rock.
    expect(walkable(s.layout, 1, ...mid(s, 3, 7))).toBe(false);
  });

  it("slides along a wall instead of stopping dead, and never walks into one", () => {
    const s = site();
    const h = s.layout.hole;
    const g = (openShaftRadius(h) + h.shaftRadiusM) / 2;
    // Walking straight out from the gallery into rock: blocked.
    const [x, z] = step(s.layout, 1, g, 0.1, 5, 0);
    expect(clear(s.layout, 1, x, z)).toBe(true);
    expect(Math.hypot(x, z)).toBeLessThan(h.shaftRadiusM);
    // Diagonally: the part along the gallery goes through.
    const [x2, z2] = step(s.layout, 1, 0.1, g, 0.5, 2);
    expect(x2).toBeCloseTo(0.6);
    expect(z2).toBeCloseTo(g);
  });

  it("stairs lead to the floors they reach", () => {
    const s = site();
    applyCommand(s, { type: "build", room: "stairwell", at: ring(1, 1, 2) });
    expect(stairsHere(s.layout, 1, ...mid(s, 1, 2))).toEqual({ up: null, down: 2 });
    expect(stairsHere(s.layout, 2, ...mid(s, 1, 2))).toEqual({ up: 1, down: null });
    expect(stairsHere(s.layout, 1, ...mid(s, 1, 6))).toBeNull();
    expect(walkable(s.layout, 2, ...mid(s, 1, 2))).toBe(true);
  });
});
