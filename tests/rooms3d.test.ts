import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { createHole } from "../src/sim/geometry";
import { createLayout, placeRoom, type Location } from "../src/sim/placement";
import { roomGeometry, shaftFaces } from "../src/render3d/rooms3d";

const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });
// Each curved face is split into 4 arc steps of 2 triangles; a radial side is 2 triangles.
const CURVED = 4 * 2;
const SIDE = 2;
const triangles = (g: ReturnType<typeof roomGeometry>) => g.getAttribute("position").count / 3;

describe("3D room geometry", () => {
  const layout = createLayout(createHole(10, 3, 3, config.geometry));

  it("a one-slot room is an open-topped wedge: inner, outer, floor and two sides, no ceiling", () => {
    const r = placeRoom(layout, "clinic", ring(2, 1, 0));
    const room = layout.rooms.find((x) => x.id === r.id)!;
    expect(triangles(roomGeometry(layout, room.cells))).toBe(3 * CURVED + 2 * SIDE);
  });

  it("a wide room has no walls between its own slots", () => {
    const r = placeRoom(layout, "life_support", ring(2, 1, 3, 4));
    const room = layout.rooms.find((x) => x.id === r.id)!;
    expect(triangles(roomGeometry(layout, room.cells))).toBe(4 * 3 * CURVED + 2 * SIDE);
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
    const r = placeRoom(l, "clinic", ring(1, 2, 1)); // ring-2 slot 1: ring 3 beyond has more slots, so its outer side is in pieces
    const room = l.rooms.find((x) => x.id === r.id)!;
    const plain = roomGeometry(l, room.cells);
    l.corridors["A1.2.1/9"] = "metal"; // the first piece of its outer side
    const carved = roomGeometry(l, room.cells);
    expect(extent(carved).maxR).toBeCloseTo(extent(plain).maxR, 6); // the rest of the side is untouched
    expect(carved.getAttribute("position").count).toBeGreaterThan(plain.getAttribute("position").count); // a step wall
  });
});

describe("public rooms", () => {
  it("have no wall onto the gallery, or on a side with a corridor", () => {
    const l = createLayout(createHole(10, 3, 3, config.geometry));
    const r = placeRoom(l, "tiny_plaza", ring(1, 1, 2));
    const room = l.rooms.find((x) => x.id === r.id)!;
    const walled = triangles(roomGeometry(l, room.cells)); // as a private room would be
    const open = triangles(roomGeometry(l, room.cells, undefined, true, true));
    expect(walled - open).toBe(CURVED); // no inner wall onto the gallery
    l.corridors["R1.1.2"] = "metal"; // its left side
    expect(triangles(roomGeometry(l, room.cells, undefined, true, true))).toBe(open - SIDE);
    // A private room keeps its wall on a corridor side.
    expect(triangles(roomGeometry(l, room.cells))).toBe(walled);
  });
});

describe("windows", () => {
  it("pull back with the wall when a corridor is carved along a side, and return when it's gone", () => {
    const l = createLayout(createHole(10, 3, 3, config.geometry));
    const r = placeRoom(l, "bunk_dorm", ring(1, 1, 2, 2)); // ring-1 slots 2–3
    const room = l.rooms.find((x) => x.id === r.id)!;
    const span = (): [number, number] => {
      const faces = shaftFaces(l, room);
      return [Math.min(...faces.map((f) => f.a0)), Math.max(...faces.map((f) => f.a1))];
    };
    const [a0, a1] = span();
    l.corridors["R1.1.2"] = "rock"; // along its left side
    const [b0, b1] = span();
    expect(b0 - a0).toBeCloseTo((1.5 - 0.06) / 15, 6); // back by half a corridor, less the hairline
    expect(b1).toBeCloseTo(a1, 9);
    // The windows stay inside the room's walls.
    const geo = roomGeometry(l, room.cells);
    const pos = geo.getAttribute("position");
    let minA = Infinity;
    for (let i = 0; i < pos.count; i++) minA = Math.min(minA, Math.atan2(pos.getZ(i), pos.getX(i)));
    expect(b0).toBeGreaterThanOrEqual(minA - 1e-9);
    delete l.corridors["R1.1.2"];
    expect(span()[0]).toBeCloseTo(a0, 9);
  });
});
