import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { ringRadii, ringSize, slotNotch, slotsToAngles, spanArea, spanForArea, wrapNotch } from "../src/sim/geometry";
import type { Cell, Layout, RoomInstance } from "../src/sim/placement";
import { deserialize, serialize } from "../src/sim/save";
import { createWorld } from "../src/sim/world";
import { run } from "./bot";

// F-004 step 1 (T-039): every ring room has an angle range in notches alongside its slots.

const geo = config.geometry;
const N = geo.notchesPerTurn;

/** The cells a room's angles cover: on each ring it spans, the slots whose centre falls in its range. */
function cellsFromAngles(layout: Layout, room: RoomInstance, floor: number): string[] {
  const at = room.at;
  if (at.kind !== "ring") return [];
  const out: string[] = [];
  for (let ring = at.ring; ring < at.ring + at.depth!; ring++) {
    const m = ringSize(layout.hole, ring);
    for (let k = 0; k < m; k++) {
      const centre = ((k + 0.5) * N) / m;
      if (wrapNotch(centre - at.start!, N) < at.span!) out.push(`${floor}:${ring}:${k}`);
    }
  }
  return out;
}

function expectAnglesMatchSlots(layout: Layout): number {
  let n = 0;
  for (const room of layout.rooms) {
    if (room.at.kind !== "ring") continue;
    expect(room.at.start, `${room.type} #${room.id}`).toBeTypeOf("number");
    expect(room.at.depth).toBe(room.at.d);
    const floors = [...new Set(room.cells.map((c) => c.floor))];
    for (const f of floors) {
      const own = room.cells.filter((c: Cell) => c.floor === f).map((c) => `${c.floor}:${c.ring}:${c.slot}`);
      expect(cellsFromAngles(layout, room, f).sort(), `${room.type} #${room.id} on floor ${f}`).toEqual(own.sort());
    }
    n++;
  }
  return n;
}

/** A save as v22 wrote it: no angles on any room. */
function asV22(json: string): string {
  const file = JSON.parse(json);
  file.version = 22;
  for (const h of file.state.holes) for (const r of h.layout.rooms) {
    delete r.at.start;
    delete r.at.span;
    delete r.at.depth;
  }
  return JSON.stringify(file);
}

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

  it("every room of the starter hole and a deep one has angles matching its slots", () => {
    const w = createWorld(config);
    const hole = w.holes[0]!;
    applyCommand(hole, { type: "consoleFinish" });
    applyCommand(hole, { type: "consoleResources", atLeast: { rock: 500, metal: 200, machinery: 50, brick: 200, marscrete: 200 } });
    // A 2×2 farm across rings 2 and 3 (9 slots inside, 18 outside), wrapping past slot 0.
    const r = applyCommand(hole, { type: "build", room: "farm", at: { kind: "ring", floor: 1, ring: 2, slot: 8, w: 2, d: 2 } });
    expect(r.ok).toBe(true);
    const farm = hole.layout.rooms.at(-1)!;
    expect(farm.at).toMatchObject({ start: 1280, span: 320, depth: 2 });
    expect(expectAnglesMatchSlots(hole.layout)).toBeGreaterThan(1);
  });

  it("a played save from v22 gets angles matching its slots, the same as a new game sets", () => {
    const { state } = run(40);
    const w = createWorld(config);
    w.holes[0] = state;
    const json = serialize(w);
    const loaded = deserialize(asV22(json));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const layout = loaded.world.holes[0]!.layout;
    expect(layout.rooms.length).toBeGreaterThan(10);
    expect(expectAnglesMatchSlots(layout)).toBeGreaterThan(10);
    // No behaviour change: the migrated world is the one that was saved.
    expect(serialize(loaded.world)).toEqual(json);
  }, 30_000);
});
