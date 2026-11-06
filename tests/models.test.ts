/// <reference types="node" />
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import { furnitureMeshes, showDetail } from "../src/render3d/furniture3d";
import { furniture, itemDef } from "../src/view/furniture";
import { fpModelFor, fpTextures, modelIds, modelLimits, parseFpModels, setFpModels, setModelsEnabled, unpackNormal, type Model } from "../src/view/models";
// @ts-expect-error: a plain .mjs script, untyped
import { TEXTURE_NAMES } from "../scripts/textures.mjs";
// @ts-expect-error: a plain .mjs script, untyped
import { projectFirstFetch } from "../scripts/fpsize.mjs";

// Furniture models made in Blender (#357), drawn only in first person (#360): public/models/fp.bin,
// packed from models/*.glb by scripts/models.mjs, fetched by the game the first time it goes into first person.

const triangles = (objs: THREE.Object3D | THREE.Object3D[]) => {
  let n = 0;
  for (const g of Array.isArray(objs) ? objs : [objs])
    g.traverse((o) => {
      if (o instanceof THREE.Mesh) n += o.geometry.getAttribute("position").count / 3;
    });
  return n;
};
const modelTris = (m: Model) => m.reduce((n, s) => n + s.i.length / 3, 0);
const at = (item: string) => [{ item, x: 0, y: 0, z: 0, turn: 0 }];

function readFp() {
  // A fresh, aligned copy: Node's Buffers can sit at any offset in a shared pool.
  const buf = readFileSync(new URL("../public/models/fp.bin", import.meta.url));
  return parseFpModels(new Uint8Array(buf).slice().buffer);
}

describe("first-person furniture models", () => {
  it("draw nothing until they're loaded: every view gets the code-built parts", () => {
    setFpModels(null);
    expect(modelIds()).toEqual([]);
    expect(fpModelFor("bunk_bed")).toBeUndefined();
    const g = furnitureMeshes(at("bunk_bed"), "#6f93bd", undefined, "fp");
    expect(triangles(g)).toBe(triangles(furnitureMeshes(at("bunk_bed"), "#6f93bd")));
  });

  describe("once loaded", () => {
    beforeAll(() => setFpModels(readFp()));
    // An item still drawn from its parts in first person (the catalogue fills up, #359).
    const noModel = () => Object.keys(furniture.items).find((id) => !modelIds().includes(id))!;

    it("each is an item in the catalogue, within the limit, in its colours", () => {
      expect(modelIds()).toContain("bunk_bed");
      const limit = modelLimits()!.triangles.fp;
      expect(limit).toBe(800);
      for (const id of modelIds()) {
        expect(furniture.items[id], id).toBeDefined();
        const model = fpModelFor(id)!;
        expect(model.length, id).toBeGreaterThan(0);
        expect(modelTris(model), `${id} triangles`).toBeLessThanOrEqual(limit);
        for (const s of model) {
          expect(s.c === "accent" || s.c in furniture.colors, `${id} colour ${s.c}`).toBe(true);
          const verts = s.v.length / 3;
          expect(s.n.length, `${id} normals`).toBe(s.v.length);
          if (s.shade) expect(s.shade.length, `${id} shade`).toBe(verts);
          expect(s.i.every((k) => k < verts), `${id} indices`).toBe(true);
          if (s.tex !== undefined) {
            expect(s.tex, `${id} texture`).toBeLessThan(fpTextures()!.names.length);
            expect(s.uv?.length, `${id} uvs`).toBe(verts * 2);
          }
        }
      }
    });

    it("stay small enough to fetch: under 1 MB gzipped even with a model for every item (#371)", () => {
      const buf = new Uint8Array(readFileSync(new URL("../public/models/fp.bin", import.meta.url)));
      const t = fpTextures()!;
      const limit = modelLimits()!.firstFetch;
      expect(limit).toBe(1_000_000);
      const projected = projectFirstFetch(buf, t.pixels.length, modelIds().length, Object.keys(furniture.items).length);
      expect(projected, "fp.bin gzipped, projected to every item").toBeLessThan(limit);
      // Packed tight: about 12 bytes a vertex and 3 a triangle, where floats took about 40 and 6.
      const verts = modelIds().reduce((n, id) => n + fpModelFor(id)!.reduce((m, s) => m + s.v.length / 3, 0), 0);
      expect(buf.length - t.pixels.length).toBeLessThan(verts * 16);
    });

    it("unpack cleanly: unit normals, shades between 0 and 1", () => {
      for (const id of modelIds()) {
        for (const s of fpModelFor(id)!) {
          for (let k = 0; k < s.n.length; k += 3) expect(Math.hypot(s.n[k]!, s.n[k + 1]!, s.n[k + 2]!), `${id} normal`).toBeCloseTo(1, 5);
          expect(s.shade!.every((x) => x >= 0 && x <= 1), `${id} shade`).toBe(true);
        }
      }
      // The octahedral normals: the axes come back exactly, the rest within a degree.
      const out = new Float32Array(3);
      for (const [a, b, want] of [[0, 0, [0, 0, 1]], [127, 0, [1, 0, 0]], [0, -127, [0, -1, 0]], [-127, 0, [-1, 0, 0]]] as const) {
        unpackNormal(a, b, out, 0);
        expect([...out].map((x) => Math.round(x * 1e6) / 1e6 + 0)).toEqual(want);
      }
    });

    it("carry the shared fine textures: small grey tiles that leave the colour be on average", () => {
      const t = fpTextures()!;
      expect(t.names).toEqual(TEXTURE_NAMES);
      const limits = modelLimits()!.textures;
      expect(limits).toEqual({ size: 128, count: 16 });
      expect(t.size).toBeLessThanOrEqual(limits.size);
      expect(t.names.length).toBeLessThanOrEqual(limits.count);
      expect(t.pixels.length).toBe(t.names.length * t.size * t.size);
      t.names.forEach((name, k) => {
        const tile = t.pixels.subarray(k * t.size * t.size, (k + 1) * t.size * t.size);
        const mean = tile.reduce((a, b) => a + b, 0) / tile.length / 255;
        expect(mean, `${name}'s average grey`).toBeGreaterThan(0.4);
        expect(mean, `${name}'s average grey`).toBeLessThan(0.6);
      });
      // The remodelled items use them (#361).
      for (const id of ["bunk_bed", "sofa", "lathe"]) expect(fpModelFor(id)!.some((s) => s.tex !== undefined), id).toBe(true);
    });

    it("textured surfaces carry their texture into the first-person copy, and only there", () => {
      const g = furnitureMeshes([...at("sofa"), { item: noModel(), x: 2, y: 0, z: 0, turn: 0 }], "#6f93bd", undefined, "fp");
      const plain = g.children.find((o) => o instanceof THREE.Mesh && o.geometry.getAttribute("aTex")) as THREE.Mesh;
      expect(plain).toBeDefined();
      const tex = plain.geometry.getAttribute("aTex").array as Float32Array;
      expect(tex.some((x) => x >= 0)).toBe(true); // the sofa's fabric
      expect(tex.some((x) => x < 0)).toBe(true); // the other item's parts
      expect(plain.geometry.getAttribute("aFpUv").count).toBe(plain.geometry.getAttribute("position").count);
      const near = furnitureMeshes(at("sofa"), "#6f93bd");
      near.traverse((o) => {
        if (o instanceof THREE.Mesh) expect(o.geometry.getAttribute("aTex")).toBeUndefined();
      });
    });

    it("draw in first person only, in place of the item's parts, and fit its footprint", () => {
      for (const id of modelIds()) {
        const model = fpModelFor(id)!;
        const g = furnitureMeshes(at(id), "#6f93bd", undefined, "fp");
        expect(triangles(g), `${id} fp`).toBe(modelTris(model));
        const b = new THREE.Box3().setFromObject(g);
        const [w, d, h] = itemDef(id).size;
        expect(b.max.x - b.min.x, `${id} width`).toBeLessThanOrEqual(w + 0.01);
        expect(b.max.z - b.min.z, `${id} depth`).toBeLessThanOrEqual(d + 0.01);
        expect(b.max.y, `${id} height`).toBeLessThanOrEqual(h + 0.01);
        expect(b.min.y, `${id} on the floor`).toBeGreaterThan(-0.01);
        // Every other view: the code-built parts.
        for (const detail of ["near", "far"] as const) {
          const parts = furnitureMeshes(at(id), "#6f93bd", undefined, detail);
          expect(triangles(parts), `${id} ${detail}`).not.toBe(modelTris(model));
        }
      }
    });

    it("a room shows its first-person copy only when it has an item with a model", () => {
      const withModel = furnitureMeshes([...at("bunk_bed"), { item: noModel(), x: 1.5, y: 0, z: 0, turn: 0 }], "#6f93bd");
      expect(showDetail(withModel, "fp")).toBe(true);
      const shown = withModel.children.filter((o) => o.visible && o.userData.detail);
      expect(shown.every((o) => o.userData.detail === "fp")).toBe(true);
      expect(triangles(shown)).toBe(modelTris(fpModelFor("bunk_bed")!) + triangles(furnitureMeshes(at(noModel()), "#6f93bd")));
      expect(showDetail(withModel, "near")).toBe(true);
      expect(withModel.children.filter((o) => o.visible && o.userData.detail).every((o) => o.userData.detail === "near")).toBe(true);

      const without = furnitureMeshes(at(noModel()), "#6f93bd");
      expect(showDetail(without, "fp")).toBe(false); // stays on its near copy, nothing new built
      expect(without.userData.fpBuilt).toBeUndefined();
    });

    it("can be switched off for the code-built parts", () => {
      setModelsEnabled(false);
      try {
        expect(fpModelFor("bunk_bed")).toBeUndefined();
        expect(triangles(furnitureMeshes(at("bunk_bed"), "#6f93bd", undefined, "fp"))).toBe(triangles(furnitureMeshes(at("bunk_bed"), "#6f93bd")));
      } finally {
        setModelsEnabled(true);
      }
    });
  });
});
