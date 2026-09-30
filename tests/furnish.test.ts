import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { createHole } from "../src/sim/geometry";
import { createLayout, placeRoom, type Layout, type Location } from "../src/sim/placement";
import { FIT, fit, frameOf, furnish, furnishedFloors, inside, layouts, place, templateFor, tooClose, unplace, type Template } from "../src/view/furnish";
import { isFurnished, itemDef, itemsFor } from "../src/view/furniture";
import { roomDef, roomDefs } from "../src/sim/rooms";
import { galleryEdges } from "../src/sim/edges";

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
  // Floor 1's gallery tube, so ring-1 rooms have a door onto it.
  for (const e of galleryEdges(layout.hole, 1)) layout.corridors[e.id] = "gallery";
  const near = room(layout, "bunk_dorm", ring(1, 1, 0, 2)); // ring 1: narrow, with a door on the shaft
  const far = room(layout, "bunk_dorm", ring(1, 2, 3, 2)); // ring 2: the same slots as ring 1, further out, so wider

  it("keeps every item inside the walls and a walking aisle apart", () => {
    for (const r of [near, far]) {
      const frame = frameOf(layout, r)!;
      const items = fit(frame, DORM);
      expect(items.length).toBeGreaterThan(2);
      for (const it of items) for (const c of it.corners) expect(inside(frame, c)).toBe(true);
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          // Copies in one repeated row keep the row's gap; anything else keeps the aisle.
          const gap = items[i]!.placement === items[j]!.placement ? FIT.row : FIT.aisle;
          expect(tooClose(items[i]!.corners, items[j]!.corners, gap - 1e-6)).toBe(false);
        }
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

describe("dragging in the editor", () => {
  it("unplace undoes place, for every wall", () => {
    const layout = createLayout(createHole(10, 3, 3, config.geometry));
    const r = room(layout, "bunk_dorm", ring(1, 2, 0, 2));
    const frame = frameOf(layout, r)!;
    for (const wall of ["back", "front", "left", "right", "center"] as const) {
      const p = { item: "table", wall, x: 0.7, y: 0.4 };
      const at = place(frame, p);
      const back = unplace(frame, p, [at.x, at.z]);
      expect(back.x, wall).toBeCloseTo(0.7, 6);
      expect(back.y, wall).toBeCloseTo(0.4, 6);
    }
  });
});

describe("turned items", () => {
  it("stand out from their wall by what they reach once turned: a bed turned head-to-wall", () => {
    const layout = createLayout(createHole(10, 3, 3, config.geometry));
    const r = room(layout, "clinic", ring(1, 2, 0));
    const frame = frameOf(layout, r)!;
    const [w] = itemDef("medical_bed").size;
    const bed = place(frame, { item: "medical_bed", wall: "back", y: 0.1, turn: 90 });
    // Its far corners reach the wall's gap, no further; its length runs out into the room.
    const radii = bed.corners.map(([x, z]) => Math.hypot(x, z));
    expect(Math.max(...radii)).toBeCloseTo(frame.rOut - 0.1, 1);
    expect(Math.max(...radii) - Math.min(...radii)).toBeCloseTo(w, 1);
  });
});

describe("the templates", () => {
  const shapes = config.shapes as Record<string, [number, number][]>;

  it("cover every furnished room type in every shape, with that room's own items", () => {
    for (const def of roomDefs) {
      if (!isFurnished(def.id)) continue;
      for (const [w, d] of shapes[def.size] ?? []) {
        const t = templateFor(def.id, w, d);
        expect(t, `${def.id}:${w}x${d}`).not.toBeNull();
        for (const p of t!) expect(itemsFor(def.id), `${def.id}: ${p.item}`).toContain(p.item);
      }
    }
    // Floor-role templates too.
    for (const [key, t] of Object.entries(layouts.templates)) {
      for (const p of t) expect(itemsFor(key.split(":")[0]!), `${key}: ${p.item}`).toContain(p.item);
    }
  });

  it("furnish a room in every ring it can go in, and every placement fits somewhere", () => {
    for (const [key, t] of Object.entries(layouts.templates)) {
      const [type, shape] = key.split(":") as [string, string];
      const [w, d] = shape.split("x").map(Number) as [number, number];
      const used = new Set<number>();
      for (let r = 1; r + d - 1 <= 6; r++) {
        // Four floors dug: a stairwell or elevator on floor 2 reaches floor 3, and a second
        // piece on floor 3 extends it to floor 4, so it has a top, a middle and a bottom.
        const layout = createLayout(createHole(10, 4, 6, config.geometry));
        const placed = placeRoom(layout, type, { kind: "ring", floor: 2, ring: r, slot: 0, w, d });
        expect(placed.ok, `${key} in ring ${r}`).toBe(true);
        if (roomDef(type).stacks) placeRoom(layout, type, { kind: "ring", floor: 3, ring: r, slot: 0, w, d });
        const room = layout.rooms.find((x) => x.id === placed.id)!;
        // The floors this template furnishes (a stack's top or bottom floor may have its own).
        const floors = furnishedFloors(room).filter(({ role }) => templateFor(type, w, d, layouts.templates, role) === t);
        expect(floors.length, key).toBeGreaterThan(0);
        for (const { floor } of floors) {
          const items = fit(frameOf(layout, room, floor)!, t);
          expect(items.length, `${key} in ring ${r}`).toBeGreaterThanOrEqual(3);
          items.forEach((i) => used.add(i.placement));
        }
      }
      t.forEach((p, i) => expect(used.has(i), `${key} #${i} ${p.item} never fits`).toBe(true));
    }
  });
});
