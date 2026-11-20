import { describe, expect, it } from "vitest";
import { edgeById, outsideEdges } from "../src/sim/edges";
import { roomShapes, standardSlots, type RoomInstance } from "../src/sim/placement";
import { roomDef } from "../src/sim/rooms";
import { deserialize } from "../src/sim/save";

// Old saves on the 9-9-18 grid move onto equal-area rings at 9-18-18 (#548): every room and corridor
// keeps its place and its connections; rooms that came out bigger than their standard footprint shrink in place.

const files = import.meta.glob<string>("./fixtures/save-v22-*.json", { query: "?raw", import: "default", eager: true });
const saves = Object.entries(files).map(([path, json]) => [path.split("/").pop()!, json] as const);

type RawRoom = { id: number; type: string; connected: boolean; at: { kind: string; ring?: number; slot?: number; w?: number } };
type RawHole = { layout: { rooms: RawRoom[]; corridors: Record<string, string>; hole: { ringSlots: number[] } } };

describe("moving old saves onto 9-18-18 rings (#548)", () => {
  it("has old-grid fixtures to test with", () => {
    expect(saves.length).toBeGreaterThanOrEqual(2);
    for (const [, json] of saves) expect((JSON.parse(json) as { state: { holes: RawHole[] } }).state.holes[0]!.layout.hole.ringSlots).toEqual([9, 9, 18, 18, 36, 36]);
  });

  it.each(saves)("%s: every room keeps its place, its connection and a shape it may take", (_name, json) => {
    const before = (JSON.parse(json) as { state: { holes: RawHole[] } }).state.holes;
    const r = deserialize(json);
    expect(r.ok ? "ok" : r.reason).toBe("ok");
    if (!r.ok) return;
    r.world.holes.forEach((hole, i) => {
      const layout = hole.layout;
      expect(layout.hole.ringSlots).toEqual([9, 18, 18, 36, 36, 36]);
      expect(layout.hole.ringRadiiM[3]).toBeCloseTo(40, 9);
      const old = new Map(before[i]!.layout.rooms.map((room) => [room.id, room]));
      for (const room of layout.rooms) {
        const was = old.get(room.id)!;
        expect(room.type).toBe(was.type);
        // Connected rooms stay connected.
        if (was.connected) expect([room.id, room.type, room.connected]).toEqual([room.id, room.type, true]);
        if (room.at.kind !== "ring" || was.at.kind !== "ring") continue;
        // Same place: a room starts where it did, or within what it used to cover (by angle, round the ring).
        const n = layout.hole.ringSlots[room.at.ring - 1]!;
        const oldN = before[i]!.layout.hole.ringSlots[room.at.ring - 1]!;
        const from = (((room.at.slot / n - was.at.slot! / oldN) % 1) + 1) % 1;
        expect(from + room.at.w / n).toBeLessThanOrEqual(was.at.w! / oldN + 1e-9);
        // A shape its kind may take, or smaller than its kind's (#549: a 2-slot park, now 3): left as it was.
        const at = room.at;
        const allowed = roomShapes(roomDef(room.type)).some(([w, d]) => w === at.w && d === at.d);
        expect(allowed || room.cells.length < standardSlots(roomDef(room.type)), `${room.type} ${at.w}x${at.d}`).toBe(true);
      }
      checkGrid(layout.rooms, layout.grid, layout.open ?? []);
      // Every corridor is a real edge on the new grid, and none were lost.
      for (const id of Object.keys(layout.corridors)) expect(edgeById(layout.hole, id), id).not.toBeNull();
      expect(Object.keys(layout.corridors).length).toBeGreaterThanOrEqual(Object.keys(before[i]!.layout.corridors).length);
      // Windows stay on their rooms' own walls.
      for (const room of layout.rooms) {
        if (!room.windows) continue;
        const walls = new Set(outsideEdges(layout.hole, room.cells).map((e) => e.id));
        for (const id of room.windows) expect(walls.has(id), `${room.type} ${id}`).toBe(true);
      }
    });
  });
});

function checkGrid(rooms: RoomInstance[], grid: number[][][], open: number[][][]): void {
  const seen = new Map<string, number>();
  for (const room of rooms) {
    for (const c of room.cells) {
      const k = `${c.floor}:${c.ring}:${c.slot}`;
      expect(seen.has(k), `${room.type} overlaps at ${k}`).toBe(false);
      seen.set(k, room.id);
      expect(grid[c.floor - 1]![c.ring - 1]![c.slot]).toBe(room.id);
      if (!room.planned) expect(open[c.floor - 1]![c.ring - 1]![c.slot]).toBe(1);
    }
  }
  grid.forEach((rings, f) =>
    rings.forEach((row, r) =>
      row.forEach((id, s) => {
        if (id) expect(seen.get(`${f + 1}:${r + 1}:${s}`)).toBe(id);
      }),
    ),
  );
}
