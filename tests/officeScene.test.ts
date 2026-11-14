import { describe, expect, it } from "vitest";
import { isItem, itemDef } from "../src/view/furniture";
import { builtRoomTypes, keepsakesFor, office, officeBox, officeLook, placeInOffice } from "../src/view/officeScene";
import { roomDefs } from "../src/sim/rooms";
import type { RoomInstance } from "../src/sim/placement";

const room = (type: string, extra: Partial<RoomInstance> = {}): RoomInstance => ({ id: 1, type, planned: false, cells: [], surfaceCells: [], ...extra }) as unknown as RoomInstance;
const everyRoom = new Set(office.keepsakes.flatMap((k) => k.rooms));

describe("the office scene", () => {
  it("always has a desk, a couch, a few chairs and bookcases", () => {
    const items = officeLook({ rooms: [] }).items.map((p) => p.item);
    expect(items).toContain("desk");
    expect(items).toContain("sofa");
    expect(items.filter((i) => i === "chair" || i === "armchair" || i === "office_chair").length).toBeGreaterThanOrEqual(3);
    expect(items.filter((i) => i === "bookshelf").length).toBeGreaterThanOrEqual(2);
  });

  it("uses only furniture and room types that exist", () => {
    const types = new Set(roomDefs.map((d) => d.id));
    for (const p of [...office.base, ...office.keepsakes.flatMap((k) => k.items)]) expect(isItem(p.item), p.item).toBe(true);
    for (const t of everyRoom) expect(types.has(t), t).toBe(true);
  });

  it("gains a keepsake when the hole finishes a room of its kind, and not before", () => {
    const bare = officeLook({ rooms: [] });
    expect(bare.keepsakes).toEqual([]);
    expect(officeLook({ rooms: [room("farm", { planned: true })] }).key).toBe(bare.key);
    expect(officeLook({ rooms: [room("farm", { building: true })] }).key).toBe(bare.key);
    const farmed = officeLook({ rooms: [room("farm")] });
    expect(farmed.keepsakes).toEqual(["A rack of seedlings"]);
    expect(farmed.items.length).toBe(bare.items.length + 1);
    expect(farmed.key).not.toBe(bare.key);
    expect(builtRoomTypes({ rooms: [room("farm"), room("gym", { planned: true })] })).toEqual(new Set(["farm"]));
  });

  it("is carved from rock until there's an admin office, then takes its lining", () => {
    expect(officeLook({ rooms: [] }).finish).toBe("rock");
    expect(officeLook({ rooms: [room("admin_office", { at: { kind: "ring", floor: 1, ring: 1, slot: 0 }, material: "brick" } as Partial<RoomInstance>)] }).finish).toBe("brick");
  });

  it("keeps every piece inside the room and clear of the others, with every keepsake out", () => {
    const { width, depth, height } = office.room;
    const placed = [...office.base, ...keepsakesFor(everyRoom).flatMap((k) => k.items)].map(placeInOffice);
    expect(keepsakesFor(everyRoom).length).toBe(office.keepsakes.length);
    const boxes = placed.map((p) => ({ p, box: officeBox(p) }));
    for (const { p, box } of boxes) {
      expect(box[0][0], p.item).toBeGreaterThanOrEqual(-width / 2);
      expect(box[0][1], p.item).toBeLessThanOrEqual(width / 2);
      expect(box[2][0], p.item).toBeGreaterThanOrEqual(-depth / 2);
      expect(box[2][1], p.item).toBeLessThanOrEqual(depth / 2);
      expect(box[1][1], p.item).toBeLessThanOrEqual(height);
    }
    // Rugs lie under things; everything else keeps to its own space.
    const solid = boxes.filter(({ p }) => itemDef(p.item).size[2] > 0.1);
    for (let i = 0; i < solid.length; i++)
      for (let j = i + 1; j < solid.length; j++) {
        const [a, b] = [solid[i]!, solid[j]!];
        const apart = a.box.some(([lo, hi], k) => hi <= b.box[k]![0] || b.box[k]![1] <= lo);
        expect(apart, `${a.p.item} and ${b.p.item}`).toBe(true);
      }
  });
});
