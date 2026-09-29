import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { furnitureMeshes, itemMesh, showDetail } from "../src/render3d/furniture3d";
import { furniture, itemDef, partColor } from "../src/view/furniture";

const bounds = (g: THREE.Object3D) => new THREE.Box3().setFromObject(g);

describe("furniture meshes", () => {
  it("every item builds, one mesh per kind of part (plain, glowing, growing, water), and fills its footprint", () => {
    const PLANTS = new Set(["plant", "leaf", "potato", "soy", "stalk", "wheat", "barley", "algae", "flower"]);
    for (const id of Object.keys(furniture.items)) {
      const def = itemDef(id);
      const group = itemMesh(id, "#6f93bd");
      const kinds = new Set(def.parts.map((p) => (p.glow ? "glow" : PLANTS.has(p.c) ? "plant" : p.c === "water" ? "water" : "plain")));
      expect(group.children.length, id).toBe(kinds.size);
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

  it("colours each part through its vertices, glowing ones included", () => {
    const def = itemDef("wall_lamp");
    const g = itemMesh("wall_lamp", "#6f93bd");
    const colours = (glow: boolean) => {
      const mesh = g.children.find((o) => (((o as THREE.Mesh).material as THREE.MeshStandardMaterial).emissive.getHex() !== 0) === glow) as THREE.Mesh;
      const c = mesh.geometry.getAttribute("color");
      const out = new Set<string>();
      for (let i = 0; i < c.count; i++) out.add(new THREE.Color(c.getX(i), c.getY(i), c.getZ(i)).getHexString());
      return out;
    };
    const want = (glow: boolean) => new Set(def.parts.filter((p) => !!p.glow === glow).map((p) => new THREE.Color(partColor(p, "#6f93bd")).getHexString()));
    expect(colours(false)).toEqual(want(false));
    expect(colours(true)).toEqual(want(true));
  });

  it("has a coarser far copy, made when first shown, with small parts left out", () => {
    const placed = Array.from({ length: 6 }, (_, i) => ({ item: "office_chair", x: i, y: 0, z: 0, turn: 0 }));
    const g = furnitureMeshes(placed, "#6f93bd");
    const tris = (d: string) => g.children.filter((o) => o.userData.detail === d && o.visible).reduce((n, o) => n + (o as THREE.Mesh).geometry.getAttribute("position").count / 3, 0);
    const near = tris("near");
    expect(tris("far")).toBe(0);
    expect(showDetail(g, "far")).toBe(true);
    expect(showDetail(g, "far")).toBe(false);
    expect(tris("near")).toBe(0);
    expect(tris("far")).toBeGreaterThan(0);
    expect(tris("far")).toBeLessThan(near / 2);
    showDetail(g, "near");
    expect(tris("near")).toBe(near);
    expect(g.userData.centre.x).toBeCloseTo(2.5);
  });

  it("merges a whole room's items into a few meshes", () => {
    const placed = Array.from({ length: 8 }, (_, i) => ({ item: "bunk_bed", x: i * 2.2, y: 0, z: 0, turn: 0 }));
    expect(furnitureMeshes(placed, "#6f93bd").children.length).toBe(itemMesh("bunk_bed", "#6f93bd").children.length);
  });

  it("marks how glowing parts behave: fires dance, lamps hold steady, small lights blink, screens flicker", () => {
    const modes = (id: string) => {
      const mesh = itemMesh(id, "#6f93bd").children.find((o) => (o as THREE.Mesh).geometry.getAttribute("aGlow")) as THREE.Mesh | undefined;
      const a = mesh?.geometry.getAttribute("aGlow");
      return new Set(a ? Array.from({ length: a.count }, (_, i) => a.getX(i)) : []);
    };
    expect(modes("fireplace")).toEqual(new Set([3]));
    expect(modes("floor_lamp")).toEqual(new Set([0]));
    expect(modes("wall_screen")).toContain(1);
    expect(modes("intercom")).toContain(2);
  });
});
