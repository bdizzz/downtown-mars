import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { ringRadii, slotNotch, slotsToAngles, spanArea, spanForArea } from "../src/sim/geometry";
import { deserialize, serialize } from "../src/sim/save";
import { createWorld } from "../src/sim/world";
import { floorEdges } from "../src/sim/edges";
import { isOpen, piecesOn } from "../src/sim/space";
import { targetArea } from "../src/sim/placement";

// F-004 (PLAN-M17): angles in whole notches; rooms and old saves by angle.

const geo = config.geometry;
const N = geo.notchesPerTurn;

describe("notches and spans", () => {
  it("rings' radii and the area of a span", () => {
    expect(ringRadii(10, 1, geo)).toEqual([10, 20]);
    expect(ringRadii(10, 3, geo)).toEqual([30, 40]);
    // A whole ring 1 is π (20² − 10²) m²; ring 1–2 deep, π (30² − 10²).
    expect(spanArea(10, 1, 1, N, geo)).toBeCloseTo(Math.PI * 300);
    expect(spanArea(10, 1, 2, N, geo)).toBeCloseTo(Math.PI * 800);
  });

  it("an S room's 100 m² in notches on each ring, as in PLAN-M17", () => {
    expect([1, 2, 3, 4, 5, 6].map((ring) => spanForArea(10, ring, 1, 100, geo))).toEqual([153, 92, 65, 51, 42, 35]);
  });

  it("slot boundaries of 9, 16, 18 and 36 slots fall on whole notches", () => {
    for (const n of [9, 16, 18, 36]) for (let s = 0; s <= n; s++) expect(Number.isInteger((s * N) / n)).toBe(true);
    // 22-slot rings round, the same way on both sides of a boundary, so neighbours still meet.
    const a = slotsToAngles(3, 1, 22, N);
    const b = slotsToAngles(4, 1, 22, N);
    expect(a.start + a.span).toBe(b.start);
    expect(slotNotch(22, 22, N)).toBe(N);
  });

  it("an angle range wraps past a turn", () => {
    expect(slotsToAngles(8, 2, 9, N)).toEqual({ start: 1280, span: 320 });
    expect(slotsToAngles(-1, 1, 9, N)).toEqual({ start: 1280, span: 160 });
  });

  it("a new game's rooms go by angle, at their target areas", () => {
    const hole = createWorld(config).holes[0]!;
    for (const room of hole.layout.rooms) {
      if (room.at.kind !== "ring") continue;
      const { start, span, depth, ring } = room.at;
      expect(room.cells).toEqual([{ floor: 1, ring, a0: start, a1: start + span }]);
      expect(depth).toBe(1);
      const area = spanArea(10, ring, depth, span, geo);
      expect(Math.abs(area - targetArea(room.type)) / targetArea(room.type)).toBeLessThan(0.02);
    }
  });

  it("a save kept by slot (v24 and older) is turned to angles: nothing moves", () => {
    const file = JSON.parse(serialize(createWorld(config)));
    file.version = 24;
    const hole = file.state.holes[0];
    const layout = hole.layout;
    const blank = { surfaceCells: [], connected: true, planned: false, priority: "normal" };
    // As it was kept: rooms on slots, a grid of who holds each, what's dug per slot, and edges by slot index and fraction.
    layout.rooms = [
      ...layout.rooms.filter((r: { at: { kind: string } }) => r.at.kind === "surface"),
      { ...blank, id: 50, type: "galley", at: { kind: "ring", floor: 1, ring: 1, slot: 2, w: 1, d: 1 }, cells: [{ floor: 1, ring: 1, slot: 2 }], windows: ["A1.0.2/9"] },
      // A 2×2 farm across rings 2 and 3 (9 slots inside, 18 outside), wrapping past slot 0.
      {
        ...blank,
        id: 51,
        type: "farm",
        at: { kind: "ring", floor: 1, ring: 2, slot: 8, w: 2, d: 2 },
        cells: [8, 0].map((slot) => ({ floor: 1, ring: 2, slot })).concat([16, 17, 0, 1].map((slot) => ({ floor: 1, ring: 3, slot }))),
      },
      { ...blank, id: 52, type: "empty_room_l", at: { kind: "ring", floor: 1, ring: 3, slot: 8, w: 4, d: 1 }, cells: [8, 9, 10, 11].map((slot) => ({ floor: 1, ring: 3, slot })), building: true },
    ];
    layout.nextRoomId = 53;
    const slots = layout.hole.ringSlots as number[];
    layout.grid = [0, 1].map(() => slots.map((n) => new Array(n).fill(0)));
    layout.open = [0, 1].map((f) => slots.map((n, r) => new Array(n).fill(f === 0 && r === 0 ? 1 : 0)));
    for (const room of layout.rooms) {
      for (const c of room.cells) {
        layout.grid[c.floor - 1][c.ring - 1][c.slot] = room.id;
        if (!room.building) layout.open[c.floor - 1][c.ring - 1][c.slot] = 1;
      }
    }
    layout.corridors = { "A1.0.2/9": "gallery", "A1.0.3/9": "gallery", "R1.2.8": "rock", "R1.1.8": "rock", "A1.2.1/18": "brick" };
    layout.corridorsBuilding = { "A1.2.1/18": 7 };
    layout.bulkheads = { "R1.2.8": true };
    delete layout.corridorLinked;
    hole.construction = { nextJobId: 8, queue: [{ id: 7, kind: "corridors", edges: ["A1.2.1/18"], work: 4, done: 0 }] };

    const loaded = deserialize(JSON.stringify(file));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const l = loaded.world.holes[0]!.layout;
    const room = (id: number) => l.rooms.find((r) => r.id === id)!;
    expect((l as unknown as { grid?: unknown }).grid).toBeUndefined();
    // Each keeps its exact angles, and so its old area (a ring-1 slot is 105 m², not 100).
    expect(room(50).at).toEqual({ kind: "ring", floor: 1, ring: 1, depth: 1, start: 320, span: 160 });
    expect(room(50).cells).toEqual([{ floor: 1, ring: 1, a0: 320, a1: 480 }]);
    expect(room(51).at).toEqual({ kind: "ring", floor: 1, ring: 2, depth: 2, start: 1280, span: 320 });
    expect(room(51).cells).toEqual([
      { floor: 1, ring: 2, a0: 1280, a1: 1600 },
      { floor: 1, ring: 3, a0: 1280, a1: 1600 },
    ]);
    // The three empty rooms are one now.
    expect(room(52).type).toBe("empty_room_s");
    // What's dug, as merged ranges: all of ring 1, and the farm's wedge through the turn.
    expect(l.open![0]![0]).toEqual([[0, 1440]]);
    expect(l.open![0]![1]).toEqual([
      [0, 160],
      [1280, 1440],
    ]);
    expect(isOpen(l, room(51).cells[1]!)).toBe(true);
    expect(isOpen(l, room(52).cells[0]!)).toBe(false);
    // Edges by their own notches: corridors, the bulkhead, windows, and the job waiting on one.
    expect(Object.keys(l.corridors).sort()).toEqual(["A1.0.320-480", "A1.0.480-640", "A1.2.80-160", "R1.1.1280", "R1.2.1280"]);
    expect(l.corridors["A1.2.80-160"]).toBe("brick");
    expect(l.corridorsBuilding).toEqual({ "A1.2.80-160": 7 });
    expect(l.bulkheads).toEqual({ "R1.2.1280": true });
    expect(room(50).windows).toEqual(["A1.0.320-480"]);
    expect(loaded.world.holes[0]!.construction.queue[0]!.edges).toEqual(["A1.2.80-160"]);
    // Every stored corridor is an edge of the floor as it stands, and the pieces are the old slots.
    const edges = new Set(floorEdges(l, 1).map((e) => e.id));
    for (const id of Object.keys(l.corridors)) expect(edges.has(id), id).toBe(true);
    expect(piecesOn(l, 1, 1).map((p) => p.a1 - p.a0)).toEqual(new Array(9).fill(160));
    // And it saves and loads again as it is.
    const again = deserialize(serialize(loaded.world));
    expect(again.ok && again.world.holes[0]!.layout.rooms.map((r) => r.at)).toEqual(l.rooms.map((r) => r.at));
  });
});
