import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { createHole } from "../src/sim/geometry";
import { createLayout, placeRoom, type Location } from "../src/sim/placement";
import { roomGeometry } from "../src/render3d/rooms3d";

const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });
// Each curved face is split into 4 arc steps of 2 triangles; a radial side is 2 triangles.
const CURVED = 4 * 2;
const SIDE = 2;
const triangles = (g: ReturnType<typeof roomGeometry>) => g.getAttribute("position").count / 3;

describe("3D room geometry", () => {
  const layout = createLayout(createHole(10, 3, 3, config.geometry));

  it("a one-slot room is a closed wedge: inner, outer, top, bottom and two sides", () => {
    const r = placeRoom(layout, "clinic", ring(2, 1, 0));
    const room = layout.rooms.find((x) => x.id === r.id)!;
    expect(triangles(roomGeometry(layout, room.cells))).toBe(4 * CURVED + 2 * SIDE);
  });

  it("a wide room has no walls between its own slots", () => {
    const r = placeRoom(layout, "life_support", ring(2, 1, 3, 4));
    const room = layout.rooms.find((x) => x.id === r.id)!;
    expect(triangles(roomGeometry(layout, room.cells))).toBe(4 * 4 * CURVED + 2 * SIDE);
  });

  it("stays within its cells' radii and floor", () => {
    const r = placeRoom(layout, "galley", ring(3, 1, 7));
    const room = layout.rooms.find((x) => x.id === r.id)!;
    const pos = roomGeometry(layout, room.cells).getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const radius = Math.hypot(pos.getX(i), pos.getZ(i));
      expect(radius).toBeGreaterThanOrEqual(10 - 1e-6);
      expect(radius).toBeLessThanOrEqual(20 + 1e-6);
      expect(pos.getY(i)).toBeGreaterThanOrEqual(-12 - 1e-6);
      expect(pos.getY(i)).toBeLessThanOrEqual(-8 + 1e-6);
    }
  });
});

describe("carved by corridors", () => {
  const extent = (g: ReturnType<typeof roomGeometry>) => {
    const pos = g.getAttribute("position");
    let minA = Infinity;
    let maxA = -Infinity;
    let minR = Infinity;
    let maxR = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const a = Math.atan2(pos.getZ(i), pos.getX(i));
      const r = Math.hypot(pos.getX(i), pos.getZ(i));
      minA = Math.min(minA, a);
      maxA = Math.max(maxA, a);
      minR = Math.min(minR, r);
      maxR = Math.max(maxR, r);
    }
    return { minA, maxA, minR, maxR };
  };

  it("a room gives up half a corridor's width on the side a corridor runs along", () => {
    const l = createLayout(createHole(10, 3, 3, config.geometry));
    const r = placeRoom(l, "clinic", ring(1, 1, 1));
    const room = l.rooms.find((x) => x.id === r.id)!;
    const before = extent(roomGeometry(l, room.cells));
    l.corridors["R1.1.1"] = "rock"; // its left side
    const after = extent(roomGeometry(l, room.cells));
    const rMid = 15;
    expect(after.minA - before.minA).toBeCloseTo((1.5 - 0.06) / rMid, 3);
    expect(after.maxA).toBeCloseTo(before.maxA, 6);
  });

  it("a corridor along part of a side carves just that part, with a step", () => {
    const l = createLayout(createHole(10, 3, 3, config.geometry));
    const r = placeRoom(l, "clinic", ring(1, 1, 1)); // ring-1 slot 1: its outer side is cut into pieces
    const room = l.rooms.find((x) => x.id === r.id)!;
    const plain = roomGeometry(l, room.cells);
    l.corridors["A1.1.1/9"] = "metal"; // the first piece of its outer side
    const carved = roomGeometry(l, room.cells);
    expect(extent(carved).maxR).toBeCloseTo(extent(plain).maxR, 6); // the rest of the side is untouched
    expect(carved.getAttribute("position").count).toBeGreaterThan(plain.getAttribute("position").count); // a step wall
  });
});
