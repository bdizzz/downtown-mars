import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { furnitureMeshes, itemMesh } from "../src/render3d/furniture3d";
import { furniture, itemDef, partColor } from "../src/view/furniture";

const bounds = (g: THREE.Object3D) => new THREE.Box3().setFromObject(g);

describe("furniture meshes", () => {
  it("every item builds, one mesh per colour, and fills its footprint", () => {
    for (const id of Object.keys(furniture.items)) {
      const def = itemDef(id);
      const group = itemMesh(id, "#6f93bd");
      const colours = new Set(def.parts.map((p) => `${partColor(p, "#6f93bd")}:${!!p.glow}`));
      expect(group.children.length, id).toBe(colours.size);
      const b = bounds(group);
      const [w, d, h] = def.size;
      // Within its footprint (a hair for curved shapes' facets), and on the floor.
      expect(b.max.x - b.min.x, `${id} width`).toBeLessThanOrEqual(w + 0.01);
      expect(b.max.z - b.min.z, `${id} depth`).toBeLessThanOrEqual(d + 0.01);
      expect(b.max.y, `${id} height`).toBeLessThanOrEqual(h + 0.01);
      expect(b.min.y, `${id} floor`).toBeGreaterThanOrEqual(-0.03);
    }
  });

  it("places and turns items: a quarter turn swaps width and depth", () => {
    const def = itemDef("bunk_bed");
    const g = furnitureMeshes([{ item: "bunk_bed", x: 5, y: -4, z: 2, turn: Math.PI / 2 }], "#6f93bd");
    const b = bounds(g);
    // Its depth now runs along x, its width along z (within the footprint, which is rounded up).
    expect(b.max.x - b.min.x).toBeLessThanOrEqual(def.size[1] + 0.01);
    expect(b.max.x - b.min.x).toBeGreaterThan(def.size[1] - 0.1);
    expect(b.max.z - b.min.z).toBeLessThanOrEqual(def.size[0] + 0.01);
    expect(b.max.z - b.min.z).toBeGreaterThan(def.size[0] - 0.1);
    expect((b.max.x + b.min.x) / 2).toBeCloseTo(5, 1);
    expect(b.min.y).toBeCloseTo(-4, 1);
  });

  it("merges a whole room's items into a few meshes", () => {
    const placed = Array.from({ length: 8 }, (_, i) => ({ item: "bunk_bed", x: i * 2.2, y: 0, z: 0, turn: 0 }));
    expect(furnitureMeshes(placed, "#6f93bd").children.length).toBe(itemMesh("bunk_bed", "#6f93bd").children.length);
  });
});
