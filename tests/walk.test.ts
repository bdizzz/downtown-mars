import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { ensureFloors, roomAt, type Location } from "../src/sim/placement";
import { createInitialState, type SimState } from "../src/sim/state";
import { openShaftRadius, ringRadii, slotAngles } from "../src/render3d/cylinder";
import { clear, flights, OPEN, regionAt, stairLift, stairsHere, step, walkable } from "../src/view/walk";
import { doorways } from "../src/view/doors";
import { furnish, isFlat } from "../src/view/furnish";
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

  it("public rooms and empty space are open ground; a private room is walled off on its own", () => {
    const s = site();
    applyCommand(s, { type: "build", room: "tiny_plaza", at: ring(1, 1, 3) });
    applyCommand(s, { type: "build", room: "galley", at: ring(1, 1, 4) });
    const galley = roomAt(s.layout, { floor: 1, ring: 1, slot: 4 })!;
    const r = applyCommand(s, { type: "build", room: "water_tank", at: ring(1, 1, 5) });
    if (r.ok) applyCommand(s, { type: "demolish", roomId: r.roomId! });
    expect(regionAt(s.layout, 1, ...mid(s, 1, 3))).toBe(OPEN);
    expect(regionAt(s.layout, 1, ...mid(s, 1, 4))).toBe(`room:${galley.id}`);
    expect(regionAt(s.layout, 1, ...mid(s, 1, 5))).toBe(OPEN);
  });

  it("goes into a private room through its door, and nowhere else", () => {
    const s = site();
    const h = s.layout.hole;
    applyCommand(s, { type: "build", room: "galley", at: ring(1, 1, 4) });
    const room = roomAt(s.layout, { floor: 1, ring: 1, slot: 4 })!;
    const [door] = doorways(s.layout, room);
    expect(door).toBeDefined();
    // Walk straight out from the gallery at an angle: returns how far out it got.
    const walkOut = (a: number) => {
      let [x, z] = [(h.shaftRadiusM - 1) * Math.cos(a), (h.shaftRadiusM - 1) * Math.sin(a)];
      for (let i = 0; i < 30; i++) [x, z] = step(s.layout, 1, x, z, 0.1 * Math.cos(a), 0.1 * Math.sin(a));
      return Math.hypot(x, z);
    };
    // Through the doorway and on into the room.
    expect(walkOut(door!.angle)).toBeGreaterThan(h.shaftRadiusM + 1.5);
    expect(regionAt(s.layout, 1, (h.shaftRadiusM + 1.5) * Math.cos(door!.angle), (h.shaftRadiusM + 1.5) * Math.sin(door!.angle))).toBe(`room:${room.id}`);
    // Beside the door: the wall stops it on the gallery.
    const beside = door!.angle + 1.5 / h.shaftRadiusM;
    expect(walkOut(beside)).toBeLessThan(h.shaftRadiusM);
    // Under construction, it has no way in.
    room.building = true;
    expect(regionAt(s.layout, 1, ...mid(s, 1, 4))).toBeNull();
  });

  it("goes in through a side door from a corridor running along a room with no shaft face", () => {
    const s = site();
    const h = s.layout.hole;
    applyCommand(s, { type: "build", room: "bunk_dorm", at: ring(1, 2, 3, 2) });
    applyCommand(s, { type: "drawCorridors", edges: ["R1.2.3"], finish: "rock" });
    applyCommand(s, { type: "consoleFinish" });
    const room = roomAt(s.layout, { floor: 1, ring: 2, slot: 3 })!;
    const [door] = doorways(s.layout, room);
    expect(door).toMatchObject({ side: "left", edge: "R1.2.3" });
    // From the corridor's middle, straight across the wall into the room.
    const b = slotAngles(3, h.ringSlots[1]!)[0];
    const n = [-Math.sin(b), Math.cos(b)];
    const walkIn = (along: number) => {
      let [x, z] = [along * Math.cos(b), along * Math.sin(b)];
      for (let i = 0; i < 40; i++) [x, z] = step(s.layout, 1, x, z, 0.1 * n[0]!, 0.1 * n[1]!);
      return regionAt(s.layout, 1, x, z);
    };
    expect(walkIn(door!.r)).toBe(`room:${room.id}`);
    // Further along the wall, past the door: it stays in the corridor.
    expect(walkIn(door!.r + 3)).toBe(OPEN);
  });

  it("bumps into furniture, but walks over rugs", () => {
    const s = site();
    applyCommand(s, { type: "build", room: "bunk_dorm", at: ring(1, 1, 4, 2) });
    const room = roomAt(s.layout, { floor: 1, ring: 1, slot: 4 })!;
    const items = furnish(s.layout, room);
    const standing = items.find((f) => !isFlat(f.item))!;
    expect(walkable(s.layout, 1, standing.x, standing.z)).toBe(true);
    expect(clear(s.layout, 1, standing.x, standing.z)).toBe(false);
    const rug = items.find((f) => isFlat(f.item));
    if (rug && !items.some((f) => !isFlat(f.item) && Math.hypot(f.x - rug.x, f.z - rug.z) < 1.5)) expect(clear(s.layout, 1, rug.x, rug.z)).toBe(true);
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
    // Straight out from the gallery into rock (slot 4, away from the entrance): it never goes in,
    // and doesn't stop dead either: it slides round the gallery.
    const [a0, a1] = slotAngles(4, h.ringSlots[0]!);
    const a = (a0 + a1) / 2;
    const [x, z] = step(s.layout, 1, g * Math.cos(a), g * Math.sin(a), 0.5 * Math.cos(a), 0.5 * Math.sin(a));
    expect(clear(s.layout, 1, x, z)).toBe(true);
    expect(Math.hypot(x, z)).toBeLessThan(h.shaftRadiusM);
    expect(Math.hypot(x - g * Math.cos(a), z - g * Math.sin(a))).toBeGreaterThan(0.01);
    // Diagonally into the wall: it keeps moving, along the gallery, and never through.
    let [px, pz] = [g * Math.cos(a), g * Math.sin(a)];
    const out = [Math.cos(a), Math.sin(a)];
    const along = [-Math.sin(a), Math.cos(a)];
    for (let i = 0; i < 20; i++) [px, pz] = step(s.layout, 1, px, pz, 0.1 * (out[0]! + along[0]!), 0.1 * (out[1]! + along[1]!));
    expect(Math.hypot(px, pz)).toBeLessThan(h.shaftRadiusM);
    expect(clear(s.layout, 1, px, pz)).toBe(true);
    expect(Math.hypot(px - g * Math.cos(a), pz - g * Math.sin(a))).toBeGreaterThan(1);
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

describe("stairs in first person", () => {
  /** A stairwell from floor 1 down to floor 3, built, in ring 2 slot 0. */
  function stairs() {
    const s = site();
    s.layout.hole.floors = 3;
    ensureFloors(s.layout);
    allRock(s.layout);
    const at = (floor: number) => ({ kind: "ring" as const, floor, ring: 1, slot: 4, w: 1, d: 1 });
    applyCommand(s, { type: "build", room: "stairwell", at: at(1) });
    applyCommand(s, { type: "build", room: "stairwell", at: at(2) });
    // Built, the extension too (it waits in the queue otherwise).
    for (const r of s.layout.rooms) {
      r.building = false;
      if (r.pendingCells) {
        r.cells.push(...r.pendingCells);
        delete r.pendingCells;
      }
    }
    s.layout.version++;
    return s;
  }

  it("climbs a flight from its foot to the floor above, rising as it goes", () => {
    const s = stairs();
    const [fl] = flights(s.layout, 2);
    expect(fl).toBeDefined();
    // Stand just before its foot, facing up it, and walk.
    let [x, z, floor] = [fl!.foot[0] - fl!.up[0] * 0.4, fl!.foot[1] - fl!.up[1] * 0.4, 2];
    let highest = 0;
    for (let i = 0; i < 120 && floor === 2; i++) {
      [x, z, floor] = step(s.layout, floor, x, z, fl!.up[0] * 0.1, fl!.up[1] * 0.1);
      highest = Math.max(highest, stairLift(s.layout, floor, x, z));
    }
    expect(floor).toBe(1);
    expect(highest).toBeGreaterThan(3);
    // Back down: into the well from its head, onto the flight, and off its foot.
    for (let i = 0; i < 120 && !(floor === 2 && stairLift(s.layout, floor, x, z) === 0); i++) {
      [x, z, floor] = step(s.layout, floor, x, z, -fl!.up[0] * 0.1, -fl!.up[1] * 0.1);
    }
    expect(floor).toBe(2);
  });

  it("can't step onto a flight from its side, nor fall into a well", () => {
    const s = stairs();
    const [fl] = flights(s.layout, 2);
    // Beside the flight halfway up, walking sideways into it: stopped by the rails.
    const mid = [fl!.foot[0] + fl!.up[0] * fl!.length * 0.5, fl!.foot[1] + fl!.up[1] * fl!.length * 0.5];
    const [bx, bz] = [mid[0]! + fl!.across[0] * (fl!.half + 0.6), mid[1]! + fl!.across[1] * (fl!.half + 0.6)];
    const [, , f1] = step(s.layout, 2, bx, bz, -fl!.across[0] * 0.5, -fl!.across[1] * 0.5);
    expect(f1).toBe(2);
    expect(stairLift(s.layout, 2, ...(step(s.layout, 2, bx, bz, -fl!.across[0] * 0.5, -fl!.across[1] * 0.5).slice(0, 2) as [number, number]))).toBe(0);
    // On the floor above, beside the well halfway along, walking into it: it stays on floor 1.
    const [, , f2] = step(s.layout, 1, bx, bz, -fl!.across[0] * 0.5, -fl!.across[1] * 0.5);
    expect(f2).toBe(1);
  });
});
