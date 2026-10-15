import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { applyCommand } from "../src/sim/commands";
import { finishAll } from "../src/sim/construction";
import { liningOf } from "../src/sim/materials";
import type { Location } from "../src/sim/placement";
import { createInitialState, type SimState } from "../src/sim/state";
import { withConstructionTime } from "./worlds";
import { palette, place } from "../src/bridge/build";
import { floorSpan, polar, ringRadii, slotAngles } from "../src/render3d/cylinder";

// Building straight in a lining (T-038): the room's cost plus the lining's
// from bare rock, as a refit would charge, but no refit work: just the room's
// own build time, and it comes out lined.

const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });

function hole(): SimState {
  const s = createInitialState(config);
  s.drill.active = false;
  Object.assign(s.resources, { rock: 2000, metal: 2000, brick: 2000, glass: 100, machinery: 500, electronics: 500, water: 2000, rations: 2000 });
  return s;
}
const room = (s: SimState, id: number) => s.layout.rooms.find((r) => r.id === id)!;
/** The world point in the middle of a slot, as the viewer would send it. */
function ringCentre(s: SimState, floor: number, r: number, slot: number): [number, number, number] {
  const [a0, a1] = slotAngles(slot, s.layout.hole.ringSlots[r - 1]!);
  const [inner, outer] = ringRadii(s.layout.hole, r);
  const [y0, y1] = floorSpan(floor);
  return polar((inner + outer) / 2, (a0 + a1) / 2, (y0 + y1) / 2);
}
const job = (s: SimState, id: number) => s.construction?.queue.find((j) => j.roomId === id);

describe("building in a lining", () => {
  withConstructionTime();

  it("costs the room plus the lining from bare rock, takes only the room's build time, and comes out lined", () => {
    const plain = hole();
    const a = applyCommand(plain, { type: "build", room: "bunk_dorm", at: ring(1, 1, 3, 2) });
    const s = hole();
    const brick = s.resources.brick!;
    // An M dorm is 2 cells: patterned brick is brick 8 + 4 a cell.
    const b = applyCommand(s, { type: "build", room: "bunk_dorm", at: ring(1, 1, 3, 2), material: "brick", finish: "fine" });
    expect(a.ok && b.ok).toBe(true);
    expect(plain.resources.brick! - s.resources.brick!).toBe(24);
    expect(s.resources.brick).toBeLessThan(brick);
    // The same job as the bare-rock dorm's: no refit work on top, and no refit queued.
    expect(job(s, (b as { roomId: number }).roomId)!.work).toBe(job(plain, (a as { roomId: number }).roomId)!.work);
    expect(s.construction!.queue.filter((j) => j.kind === "upgrade")).toHaveLength(0);
    finishAll(s, config);
    expect(liningOf(room(s, (b as { roomId: number }).roomId)).name).toBe("Patterned brick");
  });

  it("bare rock, or rooms that can't be lined, cost the same as ever", () => {
    const same = (type: string, at: Location, material: string) => {
      const lined = hole();
      const plain = hole();
      expect(applyCommand(lined, { type: "build", room: type, at, material })).toMatchObject({ ok: true });
      expect(applyCommand(plain, { type: "build", room: type, at }).ok).toBe(true);
      expect(lined.resources).toEqual(plain.resources);
      expect(lined.layout.rooms.at(-1)!.material).toBeUndefined();
    };
    same("bunk_dorm", ring(1, 1, 3, 2), "rock");
    // Empty rooms (like stairs) can't be lined: the picker can stay on metal while placing them.
    same("empty_room_s", ring(1, 2, 3), "metal");
  });

  it("refuses what it can't afford, naming the lining's shortfall", () => {
    const s = hole();
    s.resources.metal = 10;
    const r = applyCommand(s, { type: "build", room: "bunk_dorm", at: ring(1, 1, 3, 2), material: "metal" });
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.reason).toMatch(/more metal/);
    expect(applyCommand(s, { type: "build", room: "bunk_dorm", at: ring(1, 1, 3, 2), material: "gold" })).toMatchObject({ ok: false });
  });

  it("the Godot bridge offers the linings and builds in the one in hand", () => {
    const s = hole();
    const p = palette(s);
    expect(p.linings[0]).toMatchObject({ id: "rock", name: "Bare rock" });
    expect(p.linings.find((l) => l.id === "brick")?.cost).toBe("Brick 8 a cell");
    expect(p.rooms.find((r) => r.id === "bunk_dorm")?.lineable).toBe(true);
    expect(p.rooms.find((r) => r.id === "stairwell")?.lineable).toBe(false);
    // Pointing at ring 1, floor 1: the command carries the lining.
    const at = ringCentre(s, 1, 1, 3);
    const placed = place(s, { room: "bunk_dorm", shape: [2, 1], lining: "brick_fine" }, at, false);
    expect(placed.command).toMatchObject({ type: "build", room: "bunk_dorm", material: "brick", finish: "fine" });
    expect(place(s, { room: "bunk_dorm", shape: [2, 1], lining: "rock" }, at, false).command).not.toHaveProperty("material");
  });

  it("undo and cancelling give the lining back too", () => {
    const s = hole();
    const brick = s.resources.brick!;
    const r = applyCommand(s, { type: "build", room: "bunk_dorm", at: ring(1, 1, 3, 2), material: "brick" });
    expect(r.ok).toBe(true);
    const id = (r as { roomId: number }).roomId;
    expect(applyCommand(s, { type: "cancelJob", jobId: job(s, id)!.id }).ok).toBe(true);
    expect(s.resources.brick).toBe(brick);
    const again = applyCommand(s, { type: "build", room: "bunk_dorm", at: ring(1, 1, 3, 2), material: "brick" });
    expect(applyCommand(s, { type: "undoBuild", roomId: (again as { roomId: number }).roomId }).ok).toBe(true);
    expect(s.resources.brick).toBe(brick);
  });
});
