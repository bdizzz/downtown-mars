import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { createHole } from "../src/sim/geometry";
import { createLayout, placeRoom, type Layout } from "../src/sim/placement";
import type { RoomStatus } from "../src/sim/economy";
import { RoomEffects } from "../src/render3d/effects3d";

/** A running smelter (sparks) in ring 1, and running life support (steam) in ring 2 on floor 2. */
function hole(): { layout: Layout; status: Record<number, RoomStatus> } {
  const layout = createLayout(createHole(10, 4, 3, config.geometry));
  const status: Record<number, RoomStatus> = {};
  for (const [type, floor, ring] of [["smelter", 1, 1], ["life_support", 2, 2]] as const) {
    const r = placeRoom(layout, type, { kind: "ring", floor, ring, slot: 2, w: 4, d: 1 });
    if (!r.ok) throw new Error(r.reason);
    status[r.id!] = { rate: 1 } as RoomStatus;
  }
  return { layout, status };
}

function running() {
  const { layout, status } = hole();
  const fx = new RoomEffects();
  fx.sync(layout, status);
  for (let i = 0; i < 20; i++) fx.step(0.1);
  return { fx, layout, status };
}

describe("sparks and steam", () => {
  it("come from working furniture", () => {
    const { fx } = running();
    expect(fx.live.sparks).toBeGreaterThan(0);
    expect(fx.live.steam).toBeGreaterThan(0);
  });

  it("vanish at once with furniture above the chosen floor, and don't come back while it's hidden", () => {
    const { fx } = running();
    fx.setView({ topFloor: 2, xray: false });
    expect(fx.live.sparks).toBe(0);
    expect(fx.live.steam).toBeGreaterThan(0);
    for (let i = 0; i < 20; i++) fx.step(0.1);
    expect(fx.live.sparks).toBe(0);
    // Back to every floor: they start again.
    fx.setView({ topFloor: null, xray: false });
    fx.step(0.2);
    expect(fx.live.sparks).toBeGreaterThan(0);
  });

  it("vanish with ring 1's furniture in x-ray", () => {
    const { fx } = running();
    fx.setView({ topFloor: null, xray: true });
    expect(fx.live.sparks).toBe(0);
    expect(fx.live.steam).toBeGreaterThan(0);
  });

  it("fade out when the room stops, and go at once when it's demolished", () => {
    const { fx, layout, status } = running();
    const smelter = layout.rooms.find((r) => r.type === "smelter")!;
    fx.sync(layout, { ...status, [smelter.id]: { rate: 0 } as RoomStatus });
    expect(fx.live.sparks).toBeGreaterThan(0);
    for (let i = 0; i < 20; i++) fx.step(0.1);
    expect(fx.live.sparks).toBe(0);
    // Running again, then gone.
    fx.sync(layout, status);
    fx.step(0.2);
    expect(fx.live.sparks).toBeGreaterThan(0);
    layout.rooms = layout.rooms.filter((r) => r !== smelter);
    layout.version++;
    fx.sync(layout, status);
    expect(fx.live.sparks).toBe(0);
    expect(fx.live.steam).toBeGreaterThan(0);
  });
});
