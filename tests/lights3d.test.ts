import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { config } from "../src/sim/config";
import { createHole } from "../src/sim/geometry";
import { createLayout, placeRoom } from "../src/sim/placement";
import { furnish } from "../src/view/furnish";
import { itemDef } from "../src/view/furniture";
import { furnitureGroup } from "../src/render3d/rooms3d";
import { floorSpan } from "../src/render3d/cylinder";
import { FIXTURE_LAYER, LampLights, lampsOf, lightPools } from "../src/render3d/lights3d";

function flat() {
  const layout = createLayout(createHole(10, 3, 3, config.geometry));
  const r = placeRoom(layout, "flat", { kind: "ring", floor: 1, ring: 2, slot: 3, w: 1, d: 1 });
  if (!r.ok) throw new Error(r.reason);
  const room = layout.rooms.find((x) => x.id === r.id)!;
  return { layout, room, fitted: furnish(layout, room) };
}

describe("lamp light", () => {
  it("comes from the furniture that gives light, where its lamp is", () => {
    const { fitted } = flat();
    const lamps = lampsOf(fitted);
    const lit = fitted.filter((f) => itemDef(f.item).light);
    expect(lamps.length).toBe(lit.length);
    expect(lamps.length).toBeGreaterThan(0);
    for (const [i, l] of lamps.entries()) {
      // Near its item, above its floor.
      expect(Math.hypot(l.x - lit[i]!.x, l.z - lit[i]!.z)).toBeLessThan(1.5);
      expect(l.y).toBeGreaterThan(floorSpan(1)[0]);
    }
    // A wall lamp's pool lies out from its wall, into the room.
    const wall = lamps.find((_, i) => itemDef(lit[i]!.item).mount !== undefined)!;
    expect(Math.hypot(wall.px, wall.pz)).not.toBeCloseTo(Math.hypot(wall.x, wall.z), 1);
  });

  it("pools on the floor, carried with the room's furniture", () => {
    const { layout, room, fitted } = flat();
    const pools = lightPools(lampsOf(fitted))!;
    expect(pools.geometry.getAttribute("position").count).toBe(6 * lampsOf(fitted).length);
    const y = pools.geometry.getAttribute("position").getY(0);
    expect(y).toBeGreaterThan(floorSpan(1)[0]);
    expect(y).toBeLessThan(floorSpan(1)[0] + 0.1);
    const g = furnitureGroup(layout, room, fitted, "#888888");
    expect(g.children.some((o) => o.userData.pool)).toBe(true);
    // Its furniture's lamps, and a ceiling light over each of its slots, whose fitting shows only walking.
    expect(g.userData.lamps).toHaveLength(lampsOf(fitted).length + room.cells.length);
    const fittings: THREE.Object3D[] = [];
    g.traverse((o) => {
      if (o.layers.isEnabled(FIXTURE_LAYER) && !o.layers.isEnabled(0)) fittings.push(o);
    });
    expect(fittings).toHaveLength(room.cells.length);
  });

  it("lights the nearest lamps on the floor asked for, and no more than it has", () => {
    const { fitted } = flat();
    const lamps = lampsOf(fitted);
    const lights = new LampLights();
    lights.setCount(2);
    const first = lamps[0]!;
    const lit = lights.place(lamps, new THREE.Vector3(first.x, first.y, first.z), 1);
    expect(lit).toHaveLength(Math.min(2, lamps.length));
    expect(lit[0]).toBe(first);
    // Another floor: none.
    expect(lights.place(lamps, new THREE.Vector3(first.x, first.y, first.z), 2)).toHaveLength(0);
    lights.setCount(0);
    expect(lights.place(lamps, new THREE.Vector3(), null)).toHaveLength(0);
  });
});
