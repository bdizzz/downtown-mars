import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { createHole, surfaceRingAt, surfaceRingRadiusM } from "../src/sim/geometry";
import { checkPlacement, createLayout, demolishRoom, placeRoom } from "../src/sim/placement";
import { pickAt } from "../src/render3d/cylinder";
import { pick, SURFACE_H, surfaceRingBase } from "../src/render2d/layout";
import { deserialize, serialize } from "../src/sim/save";
import { createWorld } from "../src/sim/world";

// T-108 (#233): the surface is three rings of building spots round the rim, sized like underground rings.
const layout = () => createLayout(createHole(10, 3, 3, config.geometry));

describe("surface rings", () => {
  it("opens three rings, each with more spots the further out it is", () => {
    const l = layout();
    expect(l.surface.map((r) => r.length)).toEqual([12, 21, 30]);
  });

  it("builds on every ring, each ring's spots its own", () => {
    const l = layout();
    const a = placeRoom(l, "solar_array", { kind: "surface", slot: 0 });
    const b = placeRoom(l, "solar_array", { kind: "surface", ring: 2, slot: 0 });
    const c = placeRoom(l, "solar_array", { kind: "surface", ring: 3, slot: 29 });
    expect([a.ok, b.ok, c.ok]).toEqual([true, true, true]);
    expect(l.surface[1]![0]).toBe(b.id);
    expect(l.surface[2]![29]).toBe(c.id);
    expect(checkPlacement(l, "solar_array", { kind: "surface", ring: 2, slot: 0 })).toMatchObject({ ok: false, surfaceRing: 2 });
    expect(checkPlacement(l, "solar_array", { kind: "surface", ring: 4, slot: 0 }).ok).toBe(false);
    expect(demolishRoom(l, b.id!).ok).toBe(true);
    expect(l.surface[1]![0]).toBe(0);
    expect(l.surface[0]![0]).toBe(a.id);
  });

  it("picks the ring by distance from the shaft, in 3D and 2D", () => {
    const hole = createHole(10, 3, 3, config.geometry);
    for (const ring of [1, 2, 3]) {
      const r = surfaceRingRadiusM(10, ring, config.geometry);
      expect(surfaceRingAt(10, r, config.geometry)).toBe(ring);
      expect(pickAt(hole, r, 0.5, 0)).toMatchObject({ kind: "surface", ring });
      expect(pick(hole, 0, surfaceRingBase(ring) - 5)).toMatchObject({ kind: "surface", ring });
    }
    // Out past the last ring, still the last ring; right by the rim, the first.
    expect(surfaceRingAt(10, 500, config.geometry)).toBe(3);
    expect(pick(hole, 0, SURFACE_H - 2)).toMatchObject({ kind: "surface", ring: 1 });
  });

  it("loads an older save with its surface rooms on ring 1", () => {
    const world = createWorld(config);
    const hole = world.holes[0]!;
    const before = hole.layout.rooms.filter((r) => r.at.kind === "surface").map((r) => r.id);
    expect(before.length).toBeGreaterThan(0);
    const file = JSON.parse(serialize(world));
    // As a v23 save had it: one flat ring.
    file.version = 23;
    for (const h of file.state.holes) h.layout.surface = h.layout.surface[0];
    const loaded = deserialize(JSON.stringify(file));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const l = loaded.world.holes[0]!.layout;
    expect(l.surface.map((r) => r.length)).toEqual([12, 21, 30]);
    for (const id of before) expect(l.surface[0]).toContain(id);
    expect(l.surface[1]!.every((id) => id === 0)).toBe(true);
  });
});
