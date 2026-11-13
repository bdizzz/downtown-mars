import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { arcPieces, cellEdges, edgeById, edgeLengthM, edgeSides, edgeVertices, floorEdges, galleryEdges, isGalleryEdge, nearestEdge, outsideEdges, sharedEdges } from "../src/sim/edges";
import { createHole, ringSize } from "../src/sim/geometry";
import { createLayout, footprint, placeRoom } from "../src/sim/placement";
import { circleCuts, piecesOn } from "../src/sim/space";
import { cellAt } from "./spots";

// The borders on a floor, by angle (F-004): circles cut wherever a piece starts on either side.

const N = config.geometry.notchesPerTurn;
const D = config.geometry.roomDepthM;
const fresh = () => createLayout(createHole(10, 3, 3, config.geometry)); // the rock's grid: 9, 9, 18 pieces a ring

describe("the edges of a floor", () => {
  it("cuts each circle wherever a piece starts on either side", () => {
    const l = fresh();
    // All rock: the rock's own grid. Rings 1 and 2 line up (nine each); ring 3 has eighteen.
    expect(circleCuts(l, 1, 1)).toHaveLength(ringSize(l.hole, 1));
    expect(circleCuts(l, 1, 2)).toHaveLength(ringSize(l.hole, 3));
    // A room at any angle cuts the circles on both its sides at its two ends.
    expect(placeRoom(l, "galley", { kind: "ring", floor: 1, ring: 2, start: 200 }).ok).toBe(true);
    const room = l.rooms[0]!.at;
    if (room.kind !== "ring") throw new Error("a ring room");
    for (const circle of [1, 2]) expect(circleCuts(l, 1, circle)).toEqual(expect.arrayContaining([200, 200 + room.span]));
    const cuts = circleCuts(l, 1, 1);
    expect([...cuts].sort((a, b) => a - b)).toEqual(cuts);
  });

  it("every arc piece has one piece inside and one outside", () => {
    const l = fresh();
    placeRoom(l, "galley", { kind: "ring", floor: 1, ring: 2, start: 200 });
    for (let circle = 1; circle < l.hole.ringSlots.length; circle++) {
      for (const e of arcPieces(l, 1, circle, 0, N)) {
        const [a, b] = edgeSides(l, e);
        expect(a!.ring).toBe(circle);
        expect(b!.ring).toBe(circle + 1);
        // The whole of the edge lies along both.
        for (const side of [a!, b!]) expect(side.a0 <= e.from && side.a1 >= e.to).toBe(true);
      }
    }
  });

  it("ids are an edge's own integers, and round-trip", () => {
    const l = fresh();
    for (const e of cellEdges(l, cellAt(2, 2, 5))) expect(edgeById(l.hole, e.id)).toEqual(e);
    expect(edgeById(l.hole, "R1.2.480")).toMatchObject({ kind: "radial", floor: 1, ring: 2, angle: 480, turn: 480 / N });
    expect(edgeById(l.hole, "A2.1.160-320")).toMatchObject({ kind: "arc", floor: 2, circle: 1, from: 160, to: 320 });
    // An arc through the turn: its end is given in the turn, and comes back past it.
    expect(edgeById(l.hole, "A1.1.1400-40")).toMatchObject({ from: 1400, to: 1480 });
    expect(edgeById(l.hole, "A1.0.0-1440")).toMatchObject({ from: 0, to: 1440 });
    for (const bad of ["R1.9.0", "A1.1.0/9", "R1.1.1440", "A1.7.0-40", "nope"]) expect(edgeById(l.hole, bad)).toBeNull();
  });

  it("a cell's edges: two sides, and the arc pieces above and below it", () => {
    const l = fresh();
    const edges = cellEdges(l, cellAt(1, 2, 0));
    expect(edges.filter((e) => e.kind === "radial")).toHaveLength(2);
    const arcs = edges.filter((e) => e.kind === "arc");
    // The pieces cover exactly the cell's span on each circle.
    for (const circle of [1, 2]) {
      const span = arcs.filter((e) => e.kind === "arc" && e.circle === circle).reduce((s, e) => s + (e.kind === "arc" ? e.a1 - e.a0 : 0), 0);
      expect(span).toBeCloseTo(1 / ringSize(l.hole, 2));
    }
  });

  it("ring 1's inner side is a gallery edge, on the shaft wall", () => {
    const l = fresh();
    const arcs = cellEdges(l, cellAt(1, 1, 0)).filter((e) => e.kind === "arc");
    const gallery = arcs.filter(isGalleryEdge);
    expect(gallery).toHaveLength(1);
    expect(edgeSides(l, gallery[0]!)).toMatchObject([null, cellAt(1, 1, 0)]);
    expect(galleryEdges(l, 1)).toHaveLength(ringSize(l.hole, 1));
    expect(edgeById(l.hole, gallery[0]!.id)).toEqual(gallery[0]);
  });

  it("a room's outside edges leave out what's inside it", () => {
    const l = fresh();
    const cells = footprint(l.hole, 1, 1, 0, 320, 2); // two rings deep
    const out = outsideEdges(l, cells).map((e) => e.id);
    expect(out).toEqual(expect.arrayContaining(["R1.1.0", "R1.1.320", "R1.2.0", "R1.2.320"]));
    // Nothing along the circle between its two rings.
    expect(out.some((id) => id.startsWith("A1.1."))).toBe(false);
    // A room that isn't there yet still has its own ends, wherever they fall.
    const odd = outsideEdges(l, footprint(l.hole, 1, 2, 77, 100, 1)).map((e) => e.id);
    expect(odd).toEqual(expect.arrayContaining(["R1.2.77", "R1.2.177", "A1.1.77-160", "A1.1.160-177"]));
  });

  it("neighbours share their border", () => {
    const l = fresh();
    expect(sharedEdges(l, cellAt(1, 1, 0), cellAt(1, 1, 1)).map((e) => e.id)).toEqual(["R1.1.160"]);
    const across = sharedEdges(l, cellAt(1, 1, 0), cellAt(1, 2, 0));
    expect(across.length).toBeGreaterThan(0);
    expect(across.every((e) => e.kind === "arc" && e.circle === 1)).toBe(true);
    // Only where their angles overlap.
    expect(sharedEdges(l, { floor: 1, ring: 1, a0: 0, a1: 100 }, { floor: 1, ring: 2, a0: 60, a1: 300 }).map((e) => e.id)).toEqual(["A1.1.60-100"]);
    expect(sharedEdges(l, cellAt(1, 1, 0), cellAt(1, 2, 3))).toEqual([]);
  });

  it("edges meet at shared vertices", () => {
    const l = fresh();
    const [, top] = edgeVertices(l.hole, edgeById(l.hole, "R1.1.0")!);
    const [bottom] = edgeVertices(l.hole, edgeById(l.hole, "R1.2.0")!);
    expect(top).toBe(bottom); // the spoke at angle 0 continues out through ring 2
    const arc = edgeById(l.hole, "A1.1.0-160")!;
    expect(edgeVertices(l.hole, arc)[0]).toBe(top);
    // An arc ending at the turn meets one starting at 0.
    expect(edgeVertices(l.hole, edgeById(l.hole, "A1.1.1280-1440")!)[1]).toBe(top);
  });

  it("picks the nearest border inside a piece", () => {
    const l = fresh();
    const slot = 1 / ringSize(l.hole, 2);
    expect(nearestEdge(l, 1, 1.5, slot * 0.05, D)!.id).toBe("R1.2.0"); // near the left side
    expect(nearestEdge(l, 1, 1.95, slot * 0.5, D)!).toMatchObject({ kind: "arc", circle: 2 }); // near the outer edge
    expect(nearestEdge(l, 1, 1.05, slot * 0.5, D)!).toMatchObject({ kind: "arc", circle: 1 }); // near the inner edge
    // In ring 1 near the shaft wall, or just over it on the shaft side: the gallery edge.
    expect(nearestEdge(l, 1, 0.02, 0.5 / ringSize(l.hole, 1), D)!).toMatchObject({ kind: "arc", circle: 0 });
    expect(nearestEdge(l, 1, -0.1, 0.5 / ringSize(l.hole, 1), D)!).toMatchObject({ kind: "arc", circle: 0 });
    expect(nearestEdge(l, 1, -1, 0.5 / ringSize(l.hole, 1), D)).toBeNull();
    // A room's own end is a border too, wherever it is.
    placeRoom(l, "galley", { kind: "ring", floor: 1, ring: 2, start: 200 });
    expect(nearestEdge(l, 1, 1.5, 203 / N, D)!.id).toBe("R1.2.200");
  });

  it("measures edges", () => {
    const l = fresh();
    expect(edgeLengthM(l.hole, edgeById(l.hole, "R1.2.480")!, D)).toBe(D);
    const total = arcPieces(l, 1, 1, 0, N).reduce((s, e) => s + edgeLengthM(l.hole, e, D), 0);
    expect(total).toBeCloseTo(2 * Math.PI * (10 + D));
  });

  it("every edge of a floor, once each", () => {
    const l = fresh();
    const ids = floorEdges(l, 1).map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Each piece has a side of its own (rings 4 to 6 are there too, locked).
    const pieces = [1, 2, 3, 4, 5, 6].reduce((n, ring) => n + piecesOn(l, 1, ring).length, 0);
    expect(ids.filter((id) => id.startsWith("R"))).toHaveLength(pieces);
  });
});

describe("corridors keep to whole edge pieces", () => {
  it("a corridor whose border is cut by a new room becomes its parts", () => {
    const l = fresh();
    l.corridors["A1.1.160-320"] = "rock";
    l.version++;
    // A room on ring 2 ending partway along it.
    expect(placeRoom(l, "galley", { kind: "ring", floor: 1, ring: 2, start: 108, span: 92, depth: 1 }).ok).toBe(true);
    expect(Object.keys(l.corridors).sort()).toEqual(["A1.1.160-200", "A1.1.200-320"]);
    expect(l.corridorSplits).toEqual({ "A1.1.160-320": ["A1.1.160-200", "A1.1.200-320"] });
    // Every stored corridor is one of the floor's edges as they stand.
    const edges = new Set(floorEdges(l, 1).map((e) => e.id));
    for (const id of Object.keys(l.corridors)) expect(edges.has(id)).toBe(true);
  });

  it("a radial corridor at any angle cuts the circles it meets", () => {
    const l = fresh();
    l.corridors["R1.2.100"] = "rock";
    l.corridors["A1.1.0-160"] = "rock";
    l.version++;
    expect(circleCuts(l, 1, 1)).toContain(100);
    expect(circleCuts(l, 1, 2)).toContain(100);
    expect(Object.keys(l.corridors).sort()).toEqual(["A1.1.0-100", "A1.1.100-160", "R1.2.100"]);
  });
});
