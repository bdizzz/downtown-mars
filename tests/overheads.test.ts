import { describe, expect, it } from "vitest";
import { overheadLights } from "../src/view/overheads";
import { floorSpan } from "../src/render3d/cylinder";
import { config } from "../src/sim/config";
import { createInitialState } from "../src/sim/state";
import lighting from "../data/lighting.json";

// The Godot viewer's ceiling lights (#305), placed by the bridge.
describe("ceiling lights", () => {
  const s = createInitialState(config);
  const lights = overheadLights(s.layout);

  it("puts one in each cell of every finished room", () => {
    const cells = s.layout.rooms.filter((r) => !r.planned && !r.building).reduce((n, r) => n + new Set(r.cells.map((c) => `${c.ring}:${c.slot}`)).size, 0);
    expect(cells).toBeGreaterThan(0);
    expect(lights.filter((l) => l.kind === "room")).toHaveLength(cells);
  });

  it("tags each room's lights with its room, so they switch together", () => {
    const ids = new Set(s.layout.rooms.map((r) => r.id));
    for (const l of lights) expect(l.kind === "room" ? ids.has(l.room) : l.room === -1).toBe(true);
  });

  it("lights the built corridors and the floor-1 gallery tube", () => {
    const tube = lights.filter((l) => l.kind === "corridor" && l.floor === 1 && Math.hypot(l.x, l.z) < s.layout.hole.shaftRadiusM);
    expect(tube.length).toBeGreaterThan(0);
  });

  it("hangs them under the ceiling of their floor", () => {
    for (const l of lights) expect(l.y).toBeCloseTo(floorSpan(l.floor)[1] - lighting.overhead.dropM, 2);
  });
});
