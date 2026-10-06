import { describe, expect, it } from "vitest";
import { cellEdges, galleryEdges } from "../src/sim/edges";
import { config } from "../src/sim/config";
import { createHole } from "../src/sim/geometry";
import { createLayout, placeRoom, type Location } from "../src/sim/placement";
import * as THREE from "three";
import { loweredAt, openingsOf, outlineGeometry, roomGeometry, setWallsDown, shaftFaces, stairWells, WALLS_DOWN } from "../src/render3d/rooms3d";
import { floorSpan, ringRadii, slotAngles } from "../src/render3d/cylinder";
import { corridorJoints } from "../src/sim/corridors";
import { DOOR, doorways } from "../src/view/doors";
import { setRoomWindows, shaftBorders } from "../src/sim/windows";

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
      expect(pos.getY(i)).toBeGreaterThanOrEqual(floorSpan(3)[0] - 1e-6);
      expect(pos.getY(i)).toBeLessThanOrEqual(floorSpan(3)[1] + 1e-6);
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
    const geo = roomGeometry(l, room.cells);
    const after = extent(geo);
    expect(after.maxA).toBeCloseTo(before.maxA, 6);
    // The side stands parallel to the corridor: half its width from the centreline at the room's inner end and outer end alike.
    const [s0] = slotAngles(1, l.hole.ringSlots[0]!);
    const pos = geo.getAttribute("position");
    const gap = (near: (r: number) => boolean) => {
      let d = Infinity;
      for (let i = 0; i < pos.count; i++) {
        const r = Math.hypot(pos.getX(i), pos.getZ(i));
        if (near(r)) d = Math.min(d, r * Math.sin(Math.atan2(pos.getZ(i), pos.getX(i)) - s0));
      }
      return d;
    };
    expect(gap((r) => r < 10.2)).toBeCloseTo(1.5, 3);
    expect(gap((r) => r > 19.8)).toBeCloseTo(1.5, 3);
  });

  it("a corridor along part of a side carves just that part, with a step", () => {
    const l = createLayout(createHole(10, 3, 3, config.geometry));
    const r = placeRoom(l, "flat", ring(1, 2, 1)); // ring-2 slot 1: ring 3 beyond has more slots, so its outer side is in pieces
    const room = l.rooms.find((x) => x.id === r.id)!;
    const plain = roomGeometry(l, room.cells);
    l.corridors["A1.2.1/9"] = "metal"; // the first piece of its outer side
    const carved = roomGeometry(l, room.cells);
    expect(extent(carved).maxR).toBeCloseTo(extent(plain).maxR, 6); // the rest of the side is untouched
    expect(carved.getAttribute("position").count).toBeGreaterThan(plain.getAttribute("position").count); // a step wall
  });
});

describe("public rooms", () => {
  it("have no wall onto a gallery tube (walled off from the shaft without one), or on a side with a corridor", () => {
    const l = createLayout(createHole(10, 3, 3, config.geometry));
    const r = placeRoom(l, "tiny_plaza", ring(1, 1, 2));
    const room = l.rooms.find((x) => x.id === r.id)!;
    const walled = triangles(roomGeometry(l, room.cells)); // as a private room would be
    // No tube along it yet: the shaft side keeps its wall.
    expect(triangles(roomGeometry(l, room.cells, undefined, true, true))).toBe(walled);
    for (const e of galleryEdges(l.hole, 1)) l.corridors[e.id] = "gallery";
    const open = triangles(roomGeometry(l, room.cells, undefined, true, true));
    expect(walled - open).toBe(CURVED); // no inner wall onto the gallery
    l.corridors["R1.1.2"] = "metal"; // its left side
    expect(triangles(roomGeometry(l, room.cells, undefined, true, true))).toBe(open - SIDE);
    // A private room keeps its wall on a corridor side.
    expect(triangles(roomGeometry(l, room.cells))).toBe(walled);
  });
});

describe("solid walls", () => {
  const solid = (l: ReturnType<typeof createLayout>, cells: Parameters<typeof roomGeometry>[1]) => roomGeometry(l, cells, undefined, true, false, null, [], undefined, true);
  const points = (g: THREE.BufferGeometry) => {
    const pos = g.getAttribute("position");
    return Array.from({ length: pos.count }, (_, i) => ({ r: Math.hypot(pos.getX(i), pos.getZ(i)), a: Math.atan2(pos.getZ(i), pos.getX(i)), y: pos.getY(i) }));
  };

  it("keep half a wall each side of a border between two rooms, so they share one wall", () => {
    const l = createLayout(createHole(10, 3, 3, config.geometry));
    const aId = placeRoom(l, "flat", ring(1, 2, 2)).id;
    const a = l.rooms.find((x) => x.id === aId)!;
    const bId = placeRoom(l, "flat", ring(1, 2, 3)).id;
    const b = l.rooms.find((x) => x.id === bId)!;
    const border = slotAngles(3, l.hole.ringSlots[1]!)[0];
    const pa = points(solid(l, a.cells));
    const pb = points(solid(l, b.cells));
    // Neither crosses the border, and both reach it (the wall's top runs to it from either side).
    expect(Math.max(...pa.map((p) => p.a))).toBeCloseTo(border, 6);
    expect(Math.min(...pb.map((p) => p.a))).toBeCloseTo(border, 6);
    // The inner faces stand half a wall in from it.
    const top = floorSpan(1)[1];
    // Signed distance from the border line, into each room.
    const faceAt = (ps: typeof pa, side: 1 | -1) => ps.filter((p) => Math.abs(p.y - top) < 1e-6).map((p) => side * p.r * Math.sin(p.a - border)).filter((d) => Math.abs(d) < 0.5);
    expect(Math.max(...faceAt(pa, 1).filter((d) => d < -1e-6))).toBeCloseTo(-0.125, 2);
    expect(Math.max(...faceAt(pb, -1).filter((d) => d < -1e-6))).toBeCloseTo(-0.125, 2);
  });

  it("stand centred on a corridor's edge, with a face on the corridor side", () => {
    const l = createLayout(createHole(10, 3, 3, config.geometry));
    const roomId = placeRoom(l, "flat", ring(1, 2, 2)).id;
    const room = l.rooms.find((x) => x.id === roomId)!;
    const [r0] = ringRadii(l.hole, 2);
    const before = Math.min(...points(solid(l, room.cells)).map((p) => p.r));
    const innerEdge = cellEdges(l.hole, room.cells[0]!).find((e) => e.kind === "arc" && e.circle === 1)!;
    l.corridors[innerEdge.id] = "rock";
    const pts = points(solid(l, room.cells));
    // Without a corridor, the inner wall's half reaches the border; with one, it stands half a corridor back, half a wall either side.
    expect(before).toBeCloseTo(r0, 4);
    const walls = pts.filter((p) => p.y > floorSpan(1)[0] + 0.5);
    const radii = [...new Set(walls.map((p) => p.r.toFixed(3)))].map(Number).filter((r) => r < r0 + 2);
    expect(radii).toContain(Number((r0 + 1.375).toFixed(3)));
    expect(radii).toContain(Number((r0 + 1.625).toFixed(3)));
  });

  it("have a top: wall pieces at the ceiling between the two faces", () => {
    const l = createLayout(createHole(10, 3, 3, config.geometry));
    const roomId = placeRoom(l, "flat", ring(1, 2, 2)).id;
    const room = l.rooms.find((x) => x.id === roomId)!;
    const top = floorSpan(1)[1];
    const g = solid(l, room.cells);
    const pos = g.getAttribute("position");
    let flatAtTop = 0;
    for (let t = 0; t < pos.count; t += 3) if ([0, 1, 2].every((k) => Math.abs(pos.getY(t + k) - top) < 1e-6)) flatAtTop++;
    expect(flatAtTop).toBeGreaterThan(0);
    // Tagged as walls, so they come down with them.
    const tags = g.getAttribute("aWall");
    for (let t = 0; t < pos.count; t += 3) if ([0, 1, 2].every((k) => Math.abs(pos.getY(t + k) - top) < 1e-6)) expect(Math.hypot(tags.getX(t), tags.getY(t))).toBeGreaterThan(0);
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
    // Back to where the side wall meets the shaft face (r = 10): half a corridor and half a wall from the border, where there was only half a wall.
    expect(b0 - a0).toBeCloseTo(Math.asin(1.625 / 10) - Math.asin(0.125 / 10), 6);
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

describe("doors and windows", () => {
  /** Does a wall on the shaft face (radius about r) cover this angle and height? By each triangle's span, as walls are quads. */
  const covers = (g: THREE.BufferGeometry, r: number, a: number, y: number) => {
    const p = g.getAttribute("position");
    for (let i = 0; i < p.count; i += 3) {
      const k = [0, 1, 2];
      if (k.some((j) => Math.abs(Math.hypot(p.getX(i + j), p.getZ(i + j)) - r) > 0.2)) continue;
      const as = k.map((j) => Math.atan2(p.getZ(i + j), p.getX(i + j)));
      const ys = k.map((j) => p.getY(i + j));
      if (a >= Math.min(...as) && a <= Math.max(...as) && y >= Math.min(...ys) && y <= Math.max(...ys)) return true;
    }
    return false;
  };

  it("cut the doorway and the window band through a private room's shaft face", () => {
    const l = createLayout(createHole(10, 3, 3, config.geometry));
    const r = placeRoom(l, "bunk_dorm", ring(1, 1, 2, 2));
    const room = l.rooms.find((x) => x.id === r.id)!;
    // No gallery tube along it: all window, no door.
    expect(doorways(l, room)).toEqual([]);
    for (const e of galleryEdges(l.hole, 1)) l.corridors[e.id] = "gallery";
    setRoomWindows(room, shaftBorders(l, room), true);
    const [door] = doorways(l, room);
    const r0 = ringRadii(l.hole, 1)[0];
    const base = floorSpan(1)[0];
    const solid = roomGeometry(l, room.cells);
    const cut = roomGeometry(l, room.cells, undefined, true, false, openingsOf(l, room));
    // In the doorway at knee height, and in the window band beside it: open only once cut.
    for (const [a, y] of [[door!.angle, base + 0.5], [door!.angle + 3 / r0, base + 2]] as const) {
      expect(covers(solid, r0, a, y)).toBe(true);
      expect(covers(cut, r0, a, y)).toBe(false);
    }
    // Below the window beside the door, and above the door: still wall.
    expect(covers(cut, r0, door!.angle + 3 / r0, base + 0.5)).toBe(true);
    expect(covers(cut, r0, door!.angle, base + DOOR.height + 0.8)).toBe(true);
  });

  it("cut a door into a side wall where a corridor runs along it and no tube does", () => {
    const l = createLayout(createHole(10, 3, 3, config.geometry));
    const r = placeRoom(l, "life_support", ring(1, 2, 2, 2, 2)); // rings 2–3, no shaft face
    const room = l.rooms.find((x) => x.id === r.id)!;
    expect(doorways(l, room)).toEqual([]);
    l.corridors["R1.2.2"] = "rock"; // along its left side, on ring 2
    const [door] = doorways(l, room);
    expect(door).toMatchObject({ side: "left", edge: "R1.2.2" });
    const parts = { glass: [] as number[], frames: [] as number[] };
    const solid = triangles(roomGeometry(l, room.cells));
    const cut = triangles(roomGeometry(l, room.cells, undefined, true, false, openingsOf(l, room), [], parts));
    expect(cut).toBeGreaterThan(solid); // the wall split round the doorway
    expect(parts.frames.length).toBeGreaterThan(0);
    expect(parts.glass.length).toBe(0); // no windows on it
  });
});

describe("corridor corners", () => {
  it("the room on the outer corner of a turn is notched, so the joint doesn't overlap it", () => {
    const l = createLayout(createHole(10, 3, 3, config.geometry));
    const r = placeRoom(l, "clinic", ring(1, 1, 4)); // ring-1 slot 4
    const room = l.rooms.find((x) => x.id === r.id)!;
    const plain = roomGeometry(l, room.cells);
    // A turn at the corner above-left of slot 5's inner side... far from the clinic: no change.
    l.corridors["R1.2.7"] = "rock";
    l.corridors["A1.1.7/9"] = "rock";
    expect(roomGeometry(l, room.cells).getAttribute("position").count).toBe(plain.getAttribute("position").count);
    // A turn at the clinic's outer-right corner (angle 5/9 on circle 1), made of corridors that don't run along the clinic.
    l.corridors["R1.2.5"] = "rock"; // out along ring 2 from that corner
    l.corridors["A1.1.5/9"] = "rock"; // along the next cell's outer side
    const notched = roomGeometry(l, room.cells);
    expect(notched.getAttribute("position").count).toBeGreaterThan(plain.getAttribute("position").count);
  });

  it("finds turns, not straight runs", () => {
    const l = createLayout(createHole(10, 3, 3, config.geometry));
    l.corridors["R1.1.3"] = "rock";
    l.corridors["R1.2.3"] = "rock"; // straight on outward
    expect(corridorJoints(l).size).toBe(0);
    l.corridors["A1.1.1/3"] = "rock"; // and a turn along the circle
    expect(corridorJoints(l).size).toBe(1);
  });
});

describe("walls down", () => {
  const layout = createLayout(createHole(10, 3, 3, config.geometry));
  const r = placeRoom(layout, "clinic", ring(2, 2, 1));
  const room = layout.rooms.find((x) => x.id === r.id)!;
  const geo = roomGeometry(layout, room.cells);
  const pos = geo.getAttribute("position");
  const walls = geo.getAttribute("aWall");
  const [r0, r1] = ringRadii(layout.hole, 2);
  const [a0, a1] = slotAngles(1, layout.hole.ringSlots[1]!);

  it("tags every wall with the side its room is on, and floors not at all", () => {
    let tagged = 0;
    for (let i = 0; i < pos.count; i++) {
      const [nx, nz] = [walls.getX(i), walls.getY(i)];
      if (nx === 0 && nz === 0) continue;
      tagged++;
      // A step along the tag from any wall corner lands inside the room.
      const x = pos.getX(i) + nx * 0.5;
      const z = pos.getZ(i) + nz * 0.5;
      const rad = Math.hypot(x, z);
      const ang = (Math.atan2(z, x) + 2 * Math.PI) % (2 * Math.PI);
      expect(rad).toBeGreaterThan(r0);
      expect(rad).toBeLessThan(r1);
      expect(ang).toBeGreaterThan(a0);
      expect(ang).toBeLessThan(a1);
      expect([walls.getZ(i), walls.getW(i)].every((y) => y >= floorSpan(2)[0] && y <= floorSpan(2)[1])).toBe(true);
    }
    // Inner, outer and two sides; the floor is untagged.
    expect(tagged).toBe((2 * CURVED + 2 * SIDE) * 3);
  });

  it("gives the outline the walls each line borders", () => {
    const edges = outlineGeometry(geo);
    const w1 = edges.getAttribute("aWall");
    const ep = edges.getAttribute("position");
    let top = 0;
    for (let i = 0; i < ep.count; i += 2) {
      // Every line along a wall's top belongs to exactly that wall.
      if (ep.getY(i) > floorSpan(2)[1] - 0.5 && ep.getY(i + 1) > floorSpan(2)[1] - 0.5) {
        top++;
        expect(w1.getX(i) !== 0 || w1.getY(i) !== 0).toBe(true);
      }
    }
    expect(top).toBeGreaterThan(0);
  });

  it("only lowers walls seen from behind, and only above the stub", () => {
    // The inner wall, seen from the shaft (behind it) and from inside the room.
    const mid = (a0 + a1) / 2;
    const i = [...Array(pos.count).keys()].find((k) => walls.getX(k) * Math.cos(mid) + walls.getY(k) * Math.sin(mid) > 0.9 && Math.abs(Math.hypot(pos.getX(k), pos.getZ(k)) - r0) < 0.2)!;
    const face = { a: i, b: i, c: i, normal: new THREE.Vector3(), materialIndex: 0 };
    const [y0, y1] = [walls.getZ(i), walls.getW(i)];
    const at = (y: number) => new THREE.Vector3(r0 * Math.cos(mid), y, r0 * Math.sin(mid));
    const hit = (y: number) => ({ distance: 1, point: at(y), face, object: new THREE.Mesh(geo) }) as THREE.Intersection;
    const inShaft = new THREE.Vector3(0, y1, 0);
    const inRoom = at(y1).multiplyScalar(((r0 + r1) / 2) / r0);
    const high = y0 + (y1 - y0) * 0.8;
    const low = y0 + (y1 - y0) * WALLS_DOWN.stub * 0.5;
    setWallsDown(false);
    expect(loweredAt(hit(high), inShaft)).toBe(false);
    setWallsDown(true);
    expect(loweredAt(hit(high), inShaft)).toBe(true);
    expect(loweredAt(hit(low), inShaft)).toBe(false);
    expect(loweredAt(hit(high), inRoom)).toBe(false);
    setWallsDown(false);
  });
});

describe("walls down, with neighbours", () => {
  it("a wall with a room across it comes down from its own side too; one against rock doesn't", () => {
    const layout = createLayout(createHole(10, 3, 3, config.geometry));
    const placed = placeRoom(layout, "clinic", ring(2, 2, 1));
    expect(placed.ok ? "" : placed.reason).toBe("");
    const near = layout.rooms.find((x) => x.id === placed.id)!;
    const behind = placeRoom(layout, "galley", ring(2, 3, 2)); // ring 3, behind slot 1's outer wall
    expect(behind.ok ? "" : behind.reason).toBe("");
    const geo = roomGeometry(layout, near.cells);
    const pos = geo.getAttribute("position");
    const walls = geo.getAttribute("aWall");
    const [r0, r1] = ringRadii(layout.hole, 2);
    // The camera inside the near room: its outer wall (a room behind) comes down, its inner wall (rock behind) stays.
    const [a0, a1] = slotAngles(1, layout.hole.ringSlots[1]!);
    const mid = (a0 + a1) / 2;
    const inside = new THREE.Vector3(((r0 + r1) / 2) * Math.cos(mid), floorSpan(2)[1], ((r0 + r1) / 2) * Math.sin(mid));
    const face = (r: number) => [...Array(pos.count).keys()].find((k) => Math.abs(Math.hypot(pos.getX(k), pos.getZ(k)) - r) < 0.2 && (walls.getX(k) !== 0 || walls.getY(k) !== 0))!;
    const hitAt = (i: number) => {
      const a = Math.atan2(pos.getZ(i), pos.getX(i));
      const r = Math.hypot(pos.getX(i), pos.getZ(i));
      const f = { a: i, b: i, c: i, normal: new THREE.Vector3(), materialIndex: 0 };
      return { distance: 1, point: new THREE.Vector3(r * Math.cos(a), floorSpan(2)[1] - 0.2, r * Math.sin(a)), face: f, object: new THREE.Mesh(geo) } as THREE.Intersection;
    };
    setWallsDown(true);
    expect(loweredAt(hitAt(face(r1)), inside)).toBe(true);
    expect(loweredAt(hitAt(face(r0)), inside)).toBe(false);
    setWallsDown(false);
  });
});

describe("stair wells", () => {
  it("are cut from a stairwell's floors above its flights", () => {
    const l = createLayout(createHole(10, 4, 3, config.geometry));
    placeRoom(l, "stairwell", ring(1, 2, 4));
    placeRoom(l, "stairwell", ring(2, 2, 4));
    const room = l.rooms.find((x) => x.type === "stairwell")!;
    // The extension, built.
    room.cells.push(...(room.pendingCells ?? []));
    delete room.pendingCells;
    const wells = stairWells(l, room);
    // Floors 1 and 2 each have a well (the flights from 2 and 3 come up through them); 3, the bottom, has none.
    expect(wells.map((w) => w.floor).sort()).toEqual([1, 2]);
    const geo = roomGeometry(l, room.cells, undefined, true, true, null, wells);
    const pos = geo.getAttribute("position");
    for (const w of wells) {
      const y = floorSpan(w.floor)[0] + 0.06;
      const [rm, am] = [(w.r0 + w.r1) / 2, (w.a0 + w.a1) / 2];
      // Nothing of the floor covers the well's middle.
      for (let i = 0; i < pos.count; i += 3) {
        const ys = [0, 1, 2].map((k) => pos.getY(i + k));
        if (ys.some((v) => Math.abs(v - y) > 1e-4)) continue;
        const rs = [0, 1, 2].map((k) => Math.hypot(pos.getX(i + k), pos.getZ(i + k)));
        // Angles from the well's middle, so none wraps round past ±π.
        const as = [0, 1, 2].map((k) => {
          const d = Math.atan2(pos.getZ(i + k), pos.getX(i + k)) - am;
          return Math.atan2(Math.sin(d), Math.cos(d));
        });
        const covers = rm > Math.min(...rs) && rm < Math.max(...rs) && 0 > Math.min(...as) && 0 < Math.max(...as);
        expect(covers).toBe(false);
      }
    }
  });
});
