import { describe, expect, it } from "vitest";
import { TapToAim, Touches } from "../src/view/touch";
import { config } from "../src/sim/config";
import { createHole } from "../src/sim/geometry";
import { createLayout } from "../src/sim/placement";
import { aimKeyFor, hoverInfoFor } from "../src/view/interaction";
import type { Tool } from "../src/view/types";

const finger = (pointerId: number, clientX: number, clientY: number) => ({ pointerId, clientX, clientY, pointerType: "touch" }) as PointerEvent;

describe("touch gestures", () => {
  it("reads a pinch apart as zooming in, about the point between the fingers", () => {
    const t = new Touches();
    expect(t.down(finger(1, 100, 100))).toBe(false);
    expect(t.down(finger(2, 200, 100))).toBe(true);
    const g = t.move(finger(2, 300, 100))!;
    expect(g.scale).toBeCloseTo(2);
    expect(g.turn).toBeCloseTo(0);
    expect(g.cx).toBe(200);
    expect(g.dx).toBe(50);
  });

  it("reads a twist as a turn, clockwise on screen positive", () => {
    const t = new Touches();
    t.down(finger(1, 0, 0));
    t.down(finger(2, 100, 0));
    const g = t.move(finger(2, 0, 100))!;
    expect(g.turn).toBeCloseTo(Math.PI / 2);
  });

  it("stays a gesture until every finger is up, so the last one doesn't tap", () => {
    const t = new Touches();
    t.down(finger(1, 0, 0));
    t.down(finger(2, 100, 0));
    expect(t.up(finger(2, 100, 0))).toBe(false);
    expect(t.gesturing).toBe(true);
    expect(t.move(finger(1, 10, 0))).toBeNull();
    expect(t.up(finger(1, 10, 0))).toBe(true);
    expect(t.gesturing).toBe(false);
  });

  it("ignores the mouse", () => {
    const t = new Touches();
    expect(t.down({ pointerId: 1, clientX: 0, clientY: 0, pointerType: "mouse" } as PointerEvent)).toBe(false);
    expect(t.count).toBe(0);
  });
});

describe("tap to aim", () => {
  it("selects at once with no tool", () => {
    expect(new TapToAim().tap(null, "a")).toBe(true);
  });

  it("aims on the first tap and acts on a second at the same spot", () => {
    const aim = new TapToAim();
    const tool = { kind: "demolish" } as const;
    expect(aim.tap(tool, "a")).toBe(false);
    expect(aim.tap(tool, "b")).toBe(false);
    expect(aim.tap(tool, "b")).toBe(true);
    // Done: the next tap aims again.
    expect(aim.tap(tool, "b")).toBe(false);
  });
});

describe("tap to aim on the surface", () => {
  it("acts on a second tap in the same surface slot, wherever in it the finger lands", () => {
    const layout = createLayout(createHole(10, 2, 3, config.geometry));
    const tool = { kind: "build", room: "solar_array", shape: [1, 1] } as unknown as Tool;
    const at = (angle: number) => hoverInfoFor(layout, {}, tool, { kind: "surface", angle });
    const width = 360 / layout.surface.length;
    const aim = new TapToAim();
    expect(aim.tap(tool, aimKeyFor(at(width * 5.2), tool, layout))).toBe(false);
    expect(aim.tap(tool, aimKeyFor(at(width * 5.7), tool, layout))).toBe(true);
    // A different slot aims again.
    expect(aim.tap(tool, aimKeyFor(at(width * 5.2), tool, layout))).toBe(false);
    expect(aim.tap(tool, aimKeyFor(at(width * 6.5), tool, layout))).toBe(false);
  });
});
