import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { createHole } from "../src/sim/geometry";
import { createLayout, placeRoom } from "../src/sim/placement";
import { GRIME, grimeLevel } from "../src/view/grime";

function room(type: string) {
  const l = createLayout(createHole(10, 3, 3, config.geometry));
  const r = placeRoom(l, type, { kind: "ring", floor: 1, ring: 1, slot: 2, w: 1, d: 1 });
  if (!r.ok) throw new Error(r.reason);
  return l.rooms.find((x) => x.id === r.id)!;
}

describe("grime", () => {
  it("follows a room's condition: none at 100%, more as it wears, in whole levels", () => {
    const r = room("clinic");
    expect(grimeLevel(r)).toBe(0);
    r.condition = 0.6;
    const some = grimeLevel(r);
    expect(some).toBeGreaterThan(0);
    r.condition = 0.05;
    expect(grimeLevel(r)).toBe(GRIME.levels - 1);
    expect(grimeLevel(r)).toBeGreaterThan(some);
    // Repaired: spotless again.
    r.condition = 1;
    expect(grimeLevel(r)).toBe(0);
  });

  it("never touches rooms without a condition, or ones still being built", () => {
    const e = room("stairwell");
    e.condition = 0.1;
    expect(grimeLevel(e)).toBe(0);
    const c = room("clinic");
    c.condition = 0.1;
    c.building = true;
    expect(grimeLevel(c)).toBe(0);
  });
});
