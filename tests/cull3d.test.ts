import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { config } from "../src/sim/config";
import { createHole } from "../src/sim/geometry";
import { createLayout, placeRoom, type Layout, type Location } from "../src/sim/placement";
import { behindSlab, clippedAway, slabBelow, type Slab } from "../src/render3d/cull3d";
import { floorSpan } from "../src/render3d/cylinder";
import { floorPlates } from "../src/render3d/rooms3d";

const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });
function room(layout: Layout, type: string, at: Location) {
  const r = placeRoom(layout, type, at);
  if (!r.ok) throw new Error(r.reason);
  return layout.rooms.find((x) => x.id === r.id)!;
}
const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
const eye = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

describe("behind a floor (#262)", () => {
  // A floor at y = 0 round a shaft 10 m across, the hole 40 m out.
  const slab: Slab = { y: 0, shaft: 10, rim: 40, openings: [], fromBelow: [] };
  const above = eye(0, 20, 15);

  it("hides what's under it, out of line with the shaft", () => {
    expect(behindSlab(slab, above, box(18, -6, -2, 22, -2, 2))).toBe(true);
  });

  it("draws what's seen down the shaft, past the rim, or through an opening", () => {
    expect(behindSlab(slab, above, box(0, -6, 0, 4, -2, 4))).toBe(false);
    // From out past the rim, the line to a room just inside it never crosses the floor.
    expect(behindSlab(slab, eye(60, 20, 0), box(36, -6, -2, 39, -2, 2))).toBe(false);
    expect(behindSlab(slab, above, box(36, -6, -2, 39, -2, 2))).toBe(true);
    expect(behindSlab({ ...slab, openings: [{ x: 20, z: 0, r: 3 }] }, above, box(18, -6, -2, 22, -2, 2))).toBe(false);
  });

  it("draws what reaches up through it or stands on it", () => {
    expect(behindSlab(slab, above, box(18, -6, -2, 22, 1, 2))).toBe(false);
    // Wall tops meet the floor above: touching it still counts as under it.
    expect(behindSlab(slab, above, box(18, -4, -2, 22, 0, 2))).toBe(true);
  });

  it("from underneath, hides what's over it, and opens up the corridors below", () => {
    const below = eye(20, -2, 0);
    const over = box(22, 2, 8, 26, 6, 12);
    expect(behindSlab(slab, below, over)).toBe(true);
    // Openings from below count only from below.
    const corridor = { ...slab, fromBelow: [{ x: 21, z: 3, r: 2 }] };
    expect(behindSlab(corridor, below, over)).toBe(false);
    expect(behindSlab(corridor, above, box(18, -6, -2, 22, -2, 2))).toBe(true);
  });

});

describe("the openings in a floor", () => {
  it("are the rooms through it, and what's see-through on it", () => {
    const layout = createLayout(createHole(10, 3, 3, config.geometry));
    const solid = room(layout, "flat", ring(1, 2, 3));
    expect(slabBelow(layout, 1).openings).toEqual([]);
    // A plan and a room being built are see-through.
    solid.planned = true;
    expect(slabBelow(layout, 1).openings.length).toBe(1);
    solid.planned = false;
    solid.building = true;
    expect(slabBelow(layout, 1).openings.length).toBe(1);
    // Not the floor under the next one down.
    expect(slabBelow(layout, 2).openings.length).toBe(0);
    solid.building = false;
    // A room on both floors (stairs, a tall room) opens the floor between them.
    solid.cells.push({ ...solid.cells[0]!, floor: 2 });
    const tall = slabBelow(layout, 1).openings;
    expect(tall.length).toBe(1);
    // Round the whole room: a cell is 10 m each way.
    expect(tall[0]!.r).toBeGreaterThan(5);
  });

  it("include corridors: those being built from either side, the rest only from below", () => {
    const layout = createLayout(createHole(10, 3, 3, config.geometry));
    layout.corridors = { "R2.2.3": "rock" };
    const under1 = slabBelow(layout, 1);
    expect(under1.openings).toEqual([]);
    expect(under1.fromBelow.length).toBeGreaterThan(0);
    expect(slabBelow(layout, 2).fromBelow).toEqual([]);
    layout.corridorsBuilding = { "R2.2.3": 0 };
    expect(slabBelow(layout, 1).openings.length).toBeGreaterThan(0);
    expect(slabBelow(layout, 2).openings.length).toBeGreaterThan(0);
  });

  it("sit at the floor's underside, and the crust's for floor 0", () => {
    const layout = createLayout(createHole(10, 3, 3, config.geometry));
    expect(slabBelow(layout, 3).y).toBe(floorSpan(3)[0]);
    expect(slabBelow(layout, 0).y).toBe(floorSpan(1)[1]);
  });
});

describe("cut away", () => {
  it("only when past every plane", () => {
    const planes = [new THREE.Plane(new THREE.Vector3(1, 0, 0), 0), new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)];
    expect(clippedAway(planes, box(-5, 0, -5, -1, 1, -1))).toBe(true);
    expect(clippedAway(planes, box(-5, 0, -5, 1, 1, -1))).toBe(false);
    expect(clippedAway(planes, box(-5, 0, 1, -1, 1, 5))).toBe(false);
    expect(clippedAway([], box(-5, 0, -5, -1, 1, -1))).toBe(false);
  });
});

describe("the plate under each floor (#262)", () => {
  /** Plan area of the plate's triangles, m². */
  const area = (layout: Layout) => {
    const g = (floorPlates(layout, null, 0x6a3a28)[0] as THREE.Mesh).geometry.getAttribute("position");
    let a = 0;
    for (let t = 0; t < g.count; t += 3) {
      const [ax, az, bx, bz, cx, cz] = [g.getX(t), g.getZ(t), g.getX(t + 1), g.getZ(t + 1), g.getX(t + 2), g.getZ(t + 2)];
      a += Math.abs((bx - ax) * (cz - az) - (cx - ax) * (bz - az)) / 2;
    }
    return a;
  };

  it("faces up just under each floor, from the shaft wall to the last ring", () => {
    const layout = createLayout(createHole(10, 3, 3, config.geometry));
    const [plate] = floorPlates(layout, null, 0x6a3a28) as THREE.Mesh[];
    const pos = plate!.geometry.getAttribute("position");
    const nrm = plate!.geometry.getAttribute("normal");
    const ys = new Set<number>();
    let inner = Infinity;
    let outer = 0;
    for (let i = 0; i < pos.count; i++) {
      expect(nrm.getY(i)).toBeCloseTo(1, 6);
      ys.add(Math.round(pos.getY(i) * 100) / 100);
      const r = Math.hypot(pos.getX(i), pos.getZ(i));
      inner = Math.min(inner, r);
      outer = Math.max(outer, r);
    }
    expect([...ys].sort((a, b) => b - a)).toEqual([1, 2, 3].map((f) => Math.round((floorSpan(f)[0] - 0.04) * 100) / 100));
    expect(inner).toBeCloseTo(10, 3);
    expect(outer).toBeCloseTo(40, 3);
  });

  it("is open where a room runs through to the floor below", () => {
    const layout = createLayout(createHole(10, 3, 3, config.geometry));
    const before = area(layout);
    const tall = room(layout, "flat", ring(1, 2, 3));
    tall.cells.push({ ...tall.cells[0]!, floor: 2 });
    // One ring-2 cell: 10 m deep and about 12 m across.
    expect(before - area(layout)).toBeGreaterThan(100);
  });
});
