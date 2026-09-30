import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { createHole } from "../src/sim/geometry";
import { createLayout, placeRoom } from "../src/sim/placement";
import { furnish, templateFor, varied } from "../src/view/furnish";
import { itemsFor } from "../src/view/furniture";

function rooms(type: string, n: number, w = 1) {
  const layout = createLayout(createHole(10, 3, 3, config.geometry));
  const out = [];
  for (let i = 0; i < n; i++) {
    const r = placeRoom(layout, type, { kind: "ring", floor: 1, ring: 2, slot: i * (w + 1), w, d: 1 });
    if (!r.ok) throw new Error(r.reason);
    out.push(layout.rooms.find((x) => x.id === r.id)!);
  }
  return { layout, out };
}
const signature = (fitted: { item: string; wall: string }[]) => fitted.map((f) => `${f.item}@${f.wall}`).join(",");

describe("room variety", () => {
  it("gives rooms of one kind different layouts, the same room always the same one", () => {
    const { layout, out } = rooms("studio", 6);
    const sigs = new Set(out.map((r) => signature(varied(templateFor("studio", 1, 1)!, r))));
    expect(sigs.size).toBeGreaterThan(1);
    expect(signature(furnish(layout, out[0]!))).toBe(signature(furnish(layout, out[0]!)));
  });

  it("only ever swaps in what that kind of room may have", () => {
    const { out } = rooms("bunk_dorm", 3, 2);
    for (const r of out) for (const p of varied(templateFor("bunk_dorm", 2, 1)!, r)) expect(itemsFor("bunk_dorm")).toContain(p.item);
  });

  it("leaves stairs exactly as they are", () => {
    const { out } = rooms("stairwell", 3);
    for (const r of out) {
      const t = templateFor("stairwell", 1, 1)!;
      expect(varied(t, r)).toBe(t);
    }
  });
});
