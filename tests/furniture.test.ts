import { describe, expect, it } from "vitest";
import { furniture, isFurnished, isItem, itemsFor, partBounds } from "../src/view/furniture";
import { isRoomType, roomDefs } from "../src/sim/rooms";

describe("the furniture catalogue", () => {
  it("lists items for every furnished room type, and only real rooms and items", () => {
    for (const def of roomDefs) {
      if (isFurnished(def.id)) expect(itemsFor(def.id).length, def.id).toBeGreaterThan(0);
    }
    for (const [room, ids] of Object.entries(furniture.rooms)) {
      expect(isRoomType(room), room).toBe(true);
      expect(isFurnished(room), room).toBe(true);
      for (const id of ids) expect(isItem(id), `${room}: ${id}`).toBe(true);
    }
  });

  it("every item's parts fit inside its footprint, and stand on the floor", () => {
    const e = 1e-6;
    for (const [id, item] of Object.entries(furniture.items)) {
      const [w, d, h] = item.size;
      for (const part of item.parts) {
        const [hx, hy, hz] = partBounds(part);
        const [x, y, z] = part.p;
        expect(Math.abs(x) + hx, `${id} x`).toBeLessThanOrEqual(w / 2 + e);
        expect(Math.abs(z) + hz, `${id} z`).toBeLessThanOrEqual(d / 2 + e);
        expect(y - hy, `${id} floor`).toBeGreaterThanOrEqual(-0.02);
        expect(y + hy, `${id} height`).toBeLessThanOrEqual(h + e);
      }
    }
  });

  it("uses only colours it defines (or the room's accent)", () => {
    for (const [id, item] of Object.entries(furniture.items)) {
      for (const part of item.parts) expect(part.c === "accent" || part.c in furniture.colors, `${id}: ${part.c}`).toBe(true);
    }
  });

  it("keeps everything under the floor above (4 m)", () => {
    for (const [id, item] of Object.entries(furniture.items)) expect(item.size[2], id).toBeLessThanOrEqual(4);
  });
});
