import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { createHole } from "../src/sim/geometry";
import { GALLERY_H, RING_H, SURFACE_H, TURN_W, bandHeight, pick, ringTop } from "../src/render2d/layout";
import { createLayout } from "../src/sim/placement";

const hole = createHole(10, 3, 3, config.geometry);
const layout = createLayout(hole);

describe("pick", () => {
  it("finds the surface, gallery and rock", () => {
    expect(pick(layout, 0, 10).kind).toBe("surface");
    expect(pick(layout, 0, SURFACE_H + 1)).toMatchObject({ kind: "gallery", floor: 1 });
    // Floors 1–3 are dug and floor 4 is being dug, so rock starts below floor 4.
    expect(pick(layout, 0, SURFACE_H + 3 * bandHeight(6) + GALLERY_H + 1)).toMatchObject({ kind: "slot", floor: 4, digging: true });
    expect(pick(layout, 0, SURFACE_H + 4 * bandHeight(6) + 5).kind).toBe("rock");
  });

  it("finds the slot under a point", () => {
    const y = ringTop(2, 3, 6) + RING_H / 2;
    // All rock: ring 3 is cut on its grid of 18, and the middle of the turn starts the tenth piece.
    expect(pick(layout, TURN_W / 2 + 1, y)).toMatchObject({ kind: "slot", floor: 2, ring: 3, a0: 720, a1: 800, locked: false });
  });

  it("wraps x in both directions", () => {
    const y = SURFACE_H + GALLERY_H + 1;
    expect(pick(layout, -1, y)).toMatchObject({ ring: 1, a0: 1280 });
    expect(pick(layout, TURN_W * 3 + 1, y)).toMatchObject({ ring: 1, a0: 0 });
  });

  it("marks rings beyond the unlocked count as locked", () => {
    expect(pick(layout, 0, ringTop(1, 4, 6) + 1)).toMatchObject({ ring: 4, locked: true });
  });
});
