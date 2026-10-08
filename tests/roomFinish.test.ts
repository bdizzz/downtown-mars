import { describe, expect, it } from "vitest";
import type { RoomInstance } from "../src/sim/placement";
import { roomFinish, roomLook } from "../src/view/roomFinish";

const room = (type: string, lining: Partial<RoomInstance> = {}): RoomInstance =>
  ({ id: 1, type, at: { kind: "ring", floor: 1, ring: 1, slot: 0, w: 1, d: 1 }, cells: [], ...lining }) as RoomInstance;

describe("what a room is built from", () => {
  it("is the building material its cost uses most, or rock", () => {
    expect(roomFinish("bunk_dorm")).toBe("rock"); // rock 20
    expect(roomFinish("galley")).toBe("rock"); // rock 10, metal 5
    expect(roomFinish("clinic")).toBe("brick"); // brick 10, metal 5
    expect(roomFinish("life_support")).toBe("metal");
    expect(roomFinish("entrance")).toBe("rock"); // costs nothing: carved
  });

  it("looks like its lining: bare rock until refitted, then the material and finish", () => {
    expect(roomLook(room("clinic"))).toBe("rock");
    expect(roomLook(room("clinic", { material: "brick" }))).toBe("brick");
    expect(roomLook(room("bunk_dorm", { material: "brick", finish: "fine" }))).toBe("brick_fine");
    expect(roomLook(room("bunk_dorm", { material: "rock", finish: "fine" }))).toBe("rock_fine");
    expect(roomLook(room("life_support", { material: "metal", finish: "fine" }))).toBe("metal_fine");
  });

  it("keeps its type's material when it can't have a lining", () => {
    expect(roomLook(room("stairwell"))).toBe(roomFinish("stairwell"));
    expect(roomLook(room("entrance", { material: "metal" }))).toBe("rock");
  });
});
