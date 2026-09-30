import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { applyCommand } from "../src/sim/commands";
import { createInitialState } from "../src/sim/state";
import { roomLabel, roomName, roomRef } from "../src/sim/roomName";
import { plainText } from "../src/ui/RoomName";

function hole() {
  const s = createInitialState(config);
  Object.assign(s.resources, { rock: 500, metal: 500, brick: 200, machinery: 50, electronics: 50 });
  return s;
}

describe("room names", () => {
  it("can be renamed, trimmed and capped; an empty name goes back to the usual one", () => {
    const s = hole();
    const r = applyCommand(s, { type: "build", room: "bunk_dorm", at: { kind: "ring", floor: 1, ring: 1, slot: 3, w: 2, d: 1 } });
    const room = s.layout.rooms.find((x) => x.id === (r.ok ? r.roomId : -1))!;
    expect(roomName(room)).toBe("Bunk dorm");
    expect(roomLabel(room)).toBe("Dorm");
    const v = s.layout.version;
    applyCommand(s, { type: "renameRoom", roomId: room.id, name: "  Pillow   fort " });
    expect(roomName(room)).toBe("Pillow fort");
    expect(roomLabel(room)).toBe("Pillow fort");
    expect(s.layout.version).toBeGreaterThan(v);
    applyCommand(s, { type: "renameRoom", roomId: room.id, name: "x".repeat(80) });
    expect(roomName(room).length).toBe(32);
    applyCommand(s, { type: "renameRoom", roomId: room.id, name: "" });
    expect(room.name).toBeUndefined();
    expect(roomName(room)).toBe("Bunk dorm");
  });

  it("names a farm for its crop, and follows the crop when it changes, unless the player named it", () => {
    const s = hole();
    const r = applyCommand(s, { type: "build", room: "farm", at: { kind: "ring", floor: 1, ring: 1, slot: 3, w: 4, d: 1 } });
    const farm = s.layout.rooms.find((x) => x.id === (r.ok ? r.roomId : -1))!;
    expect(roomName(farm)).toBe("Potato farm");
    applyCommand(s, { type: "setCrop", roomId: farm.id, crop: "soybeans" });
    expect(roomName(farm)).toBe("Soybean farm");
    applyCommand(s, { type: "renameRoom", roomId: farm.id, name: "Bean Town" });
    applyCommand(s, { type: "setCrop", roomId: farm.id, crop: "wheat" });
    expect(roomName(farm)).toBe("Bean Town");
  });

  it("puts rooms in messages as tokens, readable as plain text too", () => {
    const s = hole();
    const r = applyCommand(s, { type: "build", room: "galley", at: { kind: "ring", floor: 1, ring: 1, slot: 3, w: 1, d: 1 } });
    const galley = s.layout.rooms.find((x) => x.id === (r.ok ? r.roomId : -1))!;
    expect(plainText(`${roomRef(galley)} built.`)).toBe("Galley (floor 1) built.");
  });
});

describe("ordinals", () => {
  it("read right", async () => {
    const { ordinal } = await import("../src/ui/Inspector");
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "101st"]);
  });
});
