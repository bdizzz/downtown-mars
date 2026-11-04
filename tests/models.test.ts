import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { furnitureMeshes } from "../src/render3d/furniture3d";
import { furniture, itemDef } from "../src/view/furniture";
import { MODEL_LIMITS, modelFor, modelIds, setModelsEnabled } from "../src/view/models";

// Furniture models made in Blender (#357): data/models.json, from models/*.glb by scripts/models.mjs.

const triangles = (g: THREE.Object3D) => {
  let n = 0;
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) n += o.geometry.getAttribute("position").count / 3;
  });
  return n;
};

describe("furniture models", () => {
  it("each is an item in the catalogue, near and far within the limits, in its colours", () => {
    expect(modelIds().length).toBeGreaterThan(0);
    for (const id of modelIds()) {
      expect(furniture.items[id], id).toBeDefined();
      const model = modelFor(id)!;
      for (const lod of ["near", "far"] as const) {
        const slots = model[lod];
        expect(slots.length, `${id} ${lod}`).toBeGreaterThan(0);
        const tris = slots.reduce((n, s) => n + s.i.length / 3, 0);
        expect(tris, `${id} ${lod} triangles`).toBeLessThanOrEqual(MODEL_LIMITS.triangles[lod]);
        for (const s of slots) {
          expect(s.c === "accent" || s.c in furniture.colors, `${id} ${lod} colour ${s.c}`).toBe(true);
          const verts = s.v.length / 3;
          expect(s.n.length, `${id} normals`).toBe(s.v.length);
          if (s.shade) expect(s.shade.length, `${id} shade`).toBe(verts);
          expect(s.i.every((k) => k >= 0 && k < verts), `${id} indices`).toBe(true);
        }
      }
    }
  });

  it("draws in place of the item's parts, near and far, and fits its footprint", () => {
    for (const id of modelIds()) {
      const model = modelFor(id)!;
      for (const detail of ["near", "far"] as const) {
        const g = furnitureMeshes([{ item: id, x: 0, y: 0, z: 0, turn: 0 }], "#6f93bd", undefined, detail);
        expect(triangles(g), `${id} ${detail}`).toBe(model[detail].reduce((n, s) => n + s.i.length / 3, 0));
        const b = new THREE.Box3().setFromObject(g);
        const [w, d, h] = itemDef(id).size;
        expect(b.max.x - b.min.x, `${id} width`).toBeLessThanOrEqual(w + 0.01);
        expect(b.max.z - b.min.z, `${id} depth`).toBeLessThanOrEqual(d + 0.01);
        expect(b.max.y, `${id} height`).toBeLessThanOrEqual(h + 0.01);
        expect(b.min.y, `${id} on the floor`).toBeGreaterThan(-0.01);
      }
    }
  });

  it("can be switched off for the code-built parts", () => {
    const id = modelIds()[0]!;
    setModelsEnabled(false);
    try {
      const parts = itemDef(id).parts;
      const g = furnitureMeshes([{ item: id, x: 0, y: 0, z: 0, turn: 0 }], "#6f93bd");
      expect(modelFor(id)).toBeUndefined();
      expect(triangles(g)).toBeGreaterThan(0);
      expect(parts.length).toBeGreaterThan(0);
    } finally {
      setModelsEnabled(true);
    }
  });
});
