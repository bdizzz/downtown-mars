import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { computeEffects, effectAt, effectOnRoom, falloff, previewEffects } from "../src/sim/effects";
import { createHole } from "../src/sim/geometry";
import { createLayout, placeRoom, type Layout, type Location } from "../src/sim/placement";

const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });
const cell = (floor: number, r: number, slot: number) => ({ floor, ring: r, slot });

function layout(floors = 3): Layout {
  return createLayout(createHole(10, floors, 3, config.geometry));
}

describe("falloff", () => {
  it("is full at the source and fades past the radius", () => {
    [-2, -4 / 3, -2 / 3, 0].forEach((v, d) => expect(falloff(-2, 2, d)).toBeCloseTo(v));
    expect(falloff(-1, 0, 0)).toBe(-1);
    expect(falloff(-1, 0, 1)).toBe(0);
  });
});

describe("effect field", () => {
  it("life support's noise (−2, r2) spreads along the ring", () => {
    const l = layout();
    placeRoom(l, "life_support", ring(1, 1, 0, 4)); // slots 0–3
    const f = computeEffects(l);
    expect(effectAt(f, "noise", cell(1, 1, 2))).toBeCloseTo(-2);
    expect(effectAt(f, "noise", cell(1, 1, 4))).toBeCloseTo(-4 / 3);
    expect(effectAt(f, "noise", cell(1, 1, 5))).toBeCloseTo(-2 / 3);
    expect(effectAt(f, "noise", cell(1, 1, 6))).toBe(0);
  });

  it("travels between floors: directly above is one step", () => {
    const l = layout();
    placeRoom(l, "life_support", ring(2, 1, 0, 4));
    const f = computeEffects(l);
    expect(effectAt(f, "noise", cell(1, 1, 0))).toBeCloseTo(-4 / 3);
    expect(effectAt(f, "noise", cell(3, 1, 0))).toBeCloseTo(-4 / 3);
  });

  it("travels across rings by angle", () => {
    const l = layout();
    placeRoom(l, "clinic", ring(1, 1, 0)); // health +2 r2
    const f = computeEffects(l);
    // Ring 1 slot 0 (0°–40°) overlaps ring 2 slots 0 and 1.
    expect(effectAt(f, "health", cell(1, 2, 0))).toBeCloseTo(4 / 3);
    expect(effectAt(f, "health", cell(1, 2, 1))).toBeCloseTo(4 / 3);
  });

  it("a corridor soaks up noise instead of passing it on", () => {
    const open = layout();
    placeRoom(open, "life_support", ring(1, 1, 0, 4));
    const walled = layout();
    placeRoom(walled, "life_support", ring(1, 1, 0, 4));
    placeRoom(walled, "corridor", ring(1, 1, 4));
    const a = computeEffects(open);
    const b = computeEffects(walled);
    expect(effectAt(b, "noise", cell(1, 1, 4))).toBeCloseTo(-4 / 3); // the corridor itself hears it
    expect(effectAt(a, "noise", cell(1, 1, 5))).toBeCloseTo(-2 / 3);
    // Beyond the corridor, only the long way round (via ring 2) still reaches.
    expect(effectAt(b, "noise", cell(1, 1, 5))).toBeGreaterThan(effectAt(a, "noise", cell(1, 1, 5)));
  });

  it("corridors don't block health", () => {
    const l = layout();
    placeRoom(l, "clinic", ring(1, 1, 0));
    placeRoom(l, "corridor", ring(1, 1, 1));
    const f = computeEffects(l);
    expect(effectAt(f, "health", cell(1, 1, 2))).toBeCloseTo(2 / 3);
  });

  it("effects from several rooms add up", () => {
    const l = layout();
    placeRoom(l, "galley", ring(1, 1, 0)); // smell −1 r1
    placeRoom(l, "restroom", ring(1, 1, 2)); // smell −1 r1
    const f = computeEffects(l);
    expect(effectAt(f, "smell", cell(1, 1, 1))).toBeCloseTo(-1);
  });

  it("blueprints and residents-only effects don't radiate", () => {
    const l = layout(1);
    placeRoom(l, "life_support", ring(2, 1, 0, 4)); // floor 2 is being dug: a blueprint
    placeRoom(l, "bunk_dorm", ring(1, 1, 5, 2)); // comfort −1 for its own residents only
    const f = computeEffects(l);
    expect(effectAt(f, "noise", cell(1, 1, 0))).toBe(0);
    expect(effectAt(f, "comfort", cell(1, 1, 5))).toBe(0);
  });

  it("averages over a room's cells", () => {
    const l = layout();
    placeRoom(l, "life_support", ring(1, 1, 0, 4));
    const dorm = placeRoom(l, "bunk_dorm", ring(1, 1, 4, 2));
    const room = l.rooms.find((r) => r.id === dorm.id)!;
    expect(effectOnRoom(computeEffects(l), "noise", room)).toBeCloseTo(-1);
  });
});

describe("placement preview", () => {
  it("shows only the new room's halo", () => {
    const l = layout();
    placeRoom(l, "clinic", ring(1, 1, 5)); // an unrelated source, not in the preview
    const f = previewEffects(l, "life_support", [cell(1, 1, 0), cell(1, 1, 1), cell(1, 1, 2), cell(1, 1, 3)]);
    expect(effectAt(f, "noise", cell(1, 1, 4))).toBeCloseTo(-4 / 3);
    expect(effectAt(f, "health", cell(1, 1, 5))).toBe(0);
  });
});
