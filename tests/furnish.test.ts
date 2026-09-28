import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { createHole } from "../src/sim/geometry";
import { createLayout, placeRoom, type Layout, type Location } from "../src/sim/placement";
import { FIT, fit, frameOf, furnish, inside, tooClose, type Template } from "../src/view/furnish";
import { itemDef } from "../src/view/furniture";

const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });

function room(layout: Layout, type: string, at: Location) {
  const r = placeRoom(layout, type, at);
  if (!r.ok) throw new Error(r.reason);
  return layout.rooms.find((x) => x.id === r.id)!;
}

const DORM: Template = [
  { item: "bunk_bed", wall: "back", y: 0.1, repeat: { every: 2.6 } },
  { item: "locker", wall: "left", y: 0.1 },
  { item: "table", wall: "center" },
  { item: "stool", wall: "center", x: 1.1 },
];

describe("fitting furniture into a room", () => {
  const layout = createLayout(createHole(10, 3, 3, config.geometry));
  const near = room(layout, "bunk_dorm", ring(1, 1, 0, 2)); // ring 1: narrow, with a door on the shaft
  const far = room(layout, "bunk_dorm", ring(1, 2, 3, 2)); // ring 2: the same slots as ring 1, further out, so wider

  it("keeps every item inside the walls and a walking aisle apart", () => {
    for (const r of [near, far]) {
      const frame = frameOf(layout, r)!;
      const items = fit(frame, DORM);
      expect(items.length).toBeGreaterThan(2);
      for (const it of items) for (const c of it.corners) expect(inside(frame, c)).toBe(true);
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) expect(tooClose(items[i]!.corners, items[j]!.corners, FIT.aisle - 1e-6)).toBe(false);
      }
    }
  });

  it("fills a wider room with more of a repeated item", () => {
    const count = (r: typeof near) => fit(frameOf(layout, r)!, DORM).filter((i) => i.item === "bunk_bed").length;
    expect(count(far)).toBeGreaterThan(count(near));
  });

  it("faces items away from their wall", () => {
    const bunk = fit(frameOf(layout, near)!, DORM).find((i) => i.item === "bunk_bed")!;
    // Its front (+z turned) points in, toward the shaft.
    const front = [Math.sin(bunk.turn), Math.cos(bunk.turn)];
    const out = [bunk.x / Math.hypot(bunk.x, bunk.z), bunk.z / Math.hypot(bunk.x, bunk.z)];
    expect(front[0]! * out[0]! + front[1]! * out[1]!).toBeLessThan(-0.99);
  });

  it("keeps a ring-1 room's doorway clear", () => {
    const frame = frameOf(layout, near)!;
    expect(frame.door).not.toBeNull();
    // A table dropped right in the doorway is left out.
    const inDoor: Template = [{ item: "table", wall: "front", x: 0, y: 0.1 }];
    const doorX = (frame.door! - (frame.left(frame.rIn + 1) + frame.right(frame.rIn + 1)) / 2) * (frame.rIn + 1);
    expect(fit(frame, [{ ...inDoor[0]!, x: doorX }])).toHaveLength(0);
    // Off to one side (toward the room's middle: the door is in its second cell), it goes in.
    expect(fit(frame, [{ ...inDoor[0]!, x: doorX - 3 }])).toHaveLength(1);
    // A ring-2 room has no shaft face, so no doorway there.
    expect(frameOf(layout, far)!.door).toBeNull();
  });

  it("skips what doesn't fit and carries on, and stops at the crowding cap", () => {
    const frame = frameOf(layout, near)!;
    const items = fit(frame, [{ item: "kit_container", wall: "center", x: 60 }, { item: "locker", wall: "left", y: 0.1 }]);
    expect(items.map((i) => i.item)).toEqual(["locker"]);
    const crowded = fit(frame, [{ item: "cargo_crate", wall: "back", repeat: { every: 1.8, max: 99 } }, { item: "cargo_crate", wall: "center", repeat: { every: 1.8, max: 99 } }, { item: "cargo_crate", wall: "front", y: 2, repeat: { every: 1.8, max: 99 } }]);
    const [w, d] = itemDef("cargo_crate").size;
    expect(crowded.length * w * d).toBeLessThanOrEqual(frame.area * FIT.crowding + 1e-9);
  });

  it("gives up space to a corridor along a side", () => {
    const l = createLayout(createHole(10, 3, 3, config.geometry));
    const r = room(l, "bunk_dorm", ring(1, 2, 3, 2));
    const before = frameOf(l, r)!.left(17);
    l.corridors["R1.2.3"] = "rock";
    expect(frameOf(l, r)!.left(17)).toBeGreaterThan(before);
  });

  it("furnishes only built rooms that have a template", () => {
    const l = createLayout(createHole(10, 3, 3, config.geometry));
    const r = room(l, "bunk_dorm", ring(1, 1, 0, 2));
    expect(furnish(l, r, { "bunk_dorm:2x1": DORM }).length).toBeGreaterThan(0);
    expect(furnish(l, r, {})).toEqual([]);
    r.building = true;
    expect(furnish(l, r, { "bunk_dorm:2x1": DORM })).toEqual([]);
  });
});

describe("rugs", () => {
  it("lie under what stands on them, and don't crowd the room", () => {
    const layout = createLayout(createHole(10, 3, 3, config.geometry));
    const r = room(layout, "bunk_dorm", ring(1, 2, 0, 2));
    const items = fit(frameOf(layout, r)!, [{ item: "rug", wall: "center" }, { item: "table", wall: "center" }]);
    expect(items.map((i) => i.item)).toEqual(["rug", "table"]);
  });
});
