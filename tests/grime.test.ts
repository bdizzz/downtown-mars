import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { createHole } from "../src/sim/geometry";
import { createLayout, placeRoom } from "../src/sim/placement";
import { GRIME, grimeLevel } from "../src/view/grime";

const tpd = config.ticksPerDay;
function room(type: string) {
  const l = createLayout(createHole(10, 3, 3, config.geometry));
  const r = placeRoom(l, type, { kind: "ring", floor: 1, ring: 1, slot: 2, w: type === "smelter" ? 2 : 1, d: type === "smelter" ? 2 : 1 });
  if (!r.ok) throw new Error(r.reason);
  const rm = l.rooms.find((x) => x.id === r.id)!;
  rm.builtTick = 0;
  return rm;
}

describe("wear and grime", () => {
  it("builds up with age, in whole levels, up to the most", () => {
    const r = room("clinic");
    expect(grimeLevel(r, 0, tpd, undefined)).toBe(0);
    const later = grimeLevel(r, 200 * tpd, tpd, undefined);
    expect(later).toBeGreaterThan(0);
    expect(later).toBeLessThanOrEqual(GRIME.levels - 1);
    expect(Number.isInteger(later)).toBe(true);
  });

  it("comes sooner to noisy, smelly and heavy rooms", () => {
    const quiet = room("clinic");
    const heavy = room("smelter");
    const day = 30 * tpd;
    expect(grimeLevel(heavy, day, tpd, undefined)).toBeGreaterThan(grimeLevel(quiet, day, tpd, undefined));
    const smelly = { smell: [[[-3, -3, -3, -3, -3, -3, -3, -3, -3]]] };
    expect(grimeLevel(quiet, day, tpd, smelly)).toBeGreaterThan(grimeLevel(quiet, day, tpd, undefined));
  });

  it("leaves blueprints and rooms still being built spotless", () => {
    const r = room("clinic");
    r.building = true;
    expect(grimeLevel(r, 500 * tpd, tpd, undefined)).toBe(0);
  });
});
