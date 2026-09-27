import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { cellEdges, circleCuts, edgeById, edgeLengthM, edgeSides, edgeVertices, nearestEdge, outsideEdges, sharedEdges } from "../src/sim/edges";
import { createHole, ringSize } from "../src/sim/geometry";
import { footprint } from "../src/sim/placement";

const hole = createHole(10, 3, 3, config.geometry); // ring slots 9, 16, 22, ...
const D = config.geometry.roomDepthM;

describe("the edge grid", () => {
  it("cuts each circle at the slot boundaries of the rings on both sides", () => {
    // Between the rings of a pair (1 and 2) the slots line up: one cut per slot.
    expect(circleCuts(hole, 1)).toHaveLength(ringSize(hole, 1));
    // Between pairs (ring 2, 9 slots, and ring 3, 22), 0 is shared and everything else is distinct.
    const cuts = circleCuts(hole, 2);
    expect(cuts.length).toBe(ringSize(hole, 2) + ringSize(hole, 3) - 1);
    const turns = cuts.map(([p, q]) => p / q);
    expect([...turns].sort((a, b) => a - b)).toEqual(turns);
  });

  it("every arc piece has one cell inside and one outside", () => {
    for (let circle = 1; circle < hole.ringSlots.length; circle++) {
      circleCuts(hole, circle).forEach((_, i) => {
        const e = edgeById(hole, `A1.${circle}.${circleCuts(hole, circle)[i]!.join("/")}`)!;
        const [a, b] = edgeSides(hole, e);
        expect(a!.ring).toBe(circle);
        expect(b!.ring).toBe(circle + 1);
      });
    }
  });

  it("ids round-trip", () => {
    for (const e of cellEdges(hole, { floor: 2, ring: 2, slot: 5 })) expect(edgeById(hole, e.id)).toEqual(e);
  });

  it("a cell's edges: two sides, and the arc pieces above and below it", () => {
    const edges = cellEdges(hole, { floor: 1, ring: 2, slot: 0 });
    expect(edges.filter((e) => e.kind === "radial")).toHaveLength(2);
    const arcs = edges.filter((e) => e.kind === "arc");
    // The pieces cover exactly the cell's span on each circle.
    for (const circle of [1, 2]) {
      const span = arcs.filter((e) => e.kind === "arc" && e.circle === circle).reduce((s, e) => s + (e.kind === "arc" ? e.a1 - e.a0 : 0), 0);
      expect(span).toBeCloseTo(1 / ringSize(hole, 2));
    }
  });

  it("ring 1's inner side is the gallery, not an edge", () => {
    const arcs = cellEdges(hole, { floor: 1, ring: 1, slot: 0 }).filter((e) => e.kind === "arc");
    expect(arcs.every((e) => e.kind === "arc" && e.circle === 1)).toBe(true);
  });

  it("a room's outside edges leave out its middle", () => {
    const cells = footprint(hole, 1, 1, 0, 2, 1); // two slots side by side
    const out = outsideEdges(hole, cells);
    expect(out.map((e) => e.id)).not.toContain("R1.1.1"); // the border between its two cells
    expect(out.map((e) => e.id)).toEqual(expect.arrayContaining(["R1.1.0", "R1.1.2"]));
  });

  it("neighbours share their border", () => {
    expect(sharedEdges(hole, { floor: 1, ring: 1, slot: 0 }, { floor: 1, ring: 1, slot: 1 }).map((e) => e.id)).toEqual(["R1.1.1"]);
    const across = sharedEdges(hole, { floor: 1, ring: 1, slot: 0 }, { floor: 1, ring: 2, slot: 0 });
    expect(across.length).toBeGreaterThan(0);
    expect(across.every((e) => e.kind === "arc" && e.circle === 1)).toBe(true);
  });

  it("edges meet at shared vertices", () => {
    const [, top] = edgeVertices(hole, edgeById(hole, "R1.1.0")!);
    const [bottom] = edgeVertices(hole, edgeById(hole, "R1.2.0")!);
    expect(top).toBe(bottom); // the spoke at angle 0 continues out through ring 2
    const arc = edgeById(hole, "A1.1.0/1")!;
    expect(edgeVertices(hole, arc)[0]).toBe(top);
  });

  it("picks the nearest border inside a cell", () => {
    const slot = 1 / ringSize(hole, 2);
    expect(nearestEdge(hole, 1, 1.5, slot * 0.05, D)!.id).toBe("R1.2.0"); // near the left side
    expect(nearestEdge(hole, 1, 1.95, slot * 0.5, D)!).toMatchObject({ kind: "arc", circle: 2 }); // near the outer edge
    expect(nearestEdge(hole, 1, 1.05, slot * 0.5, D)!).toMatchObject({ kind: "arc", circle: 1 }); // near the inner edge
    // In ring 1, the inner side is the gallery: never picked.
    expect(nearestEdge(hole, 1, 0.02, 0.5 / ringSize(hole, 1), D)!.kind).not.toBe("arc");
  });

  it("measures edges", () => {
    expect(edgeLengthM(hole, edgeById(hole, "R1.2.3")!, D)).toBe(D);
    const total = circleCuts(hole, 1).reduce((s, f) => s + edgeLengthM(hole, edgeById(hole, `A1.1.${f.join("/")}`)!, D), 0);
    expect(total).toBeCloseTo(2 * Math.PI * (10 + D));
  });
});
