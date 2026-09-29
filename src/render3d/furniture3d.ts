import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { itemDef, partColor, type Part } from "../view/furniture";
import type { Placed } from "../view/furnish";

// Furniture as meshes. An item is built from its parts (data/furniture.json);
// a room's worth of placed items is merged into one mesh per colour, so a
// furnished hole costs a handful of draw calls per room rather than one per
// part. Parts that glow share emissive materials that brighten at night.

const SEGMENTS = { cyl: 12, sphW: 10, sphH: 8 };
const GLOW = { day: 0.35, nightBoost: 0.9 };

export type { Placed };

/** Unit shapes, scaled per part. */
const unit = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, SEGMENTS.cyl),
  sph: new THREE.SphereGeometry(0.5, SEGMENTS.sphW, SEGMENTS.sphH),
};

/** One part's geometry, in its item's own frame. */
function partGeometry(part: Part): THREE.BufferGeometry {
  const g = unit[part.s].clone();
  const a = part.z[0]!;
  const b = part.z[1] ?? a;
  const c = part.z[2] ?? a;
  if (part.s === "box") g.scale(a, b, c);
  else if (part.s === "cyl") g.scale(a, b, a);
  else g.scale(a, a, a);
  if (part.r) {
    const [rx, ry, rz] = part.r.map((d) => (d * Math.PI) / 180) as [number, number, number];
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, "XYZ")));
  }
  g.translate(...part.p);
  return g;
}

/**
 * Materials, shared by colour: plain, or glowing. Wall hangings use their own
 * copies, adjusted by `hung` (so they can vanish with their wall).
 */
const materials = new Map<string, { material: THREE.MeshStandardMaterial; glow: boolean }>();
let nightGlow = 0;
function material(color: string, glow: boolean, hung?: Hung): THREE.MeshStandardMaterial {
  const key = `${color}:${glow}${hung ? `:${hung.key}` : ""}`;
  let entry = materials.get(key);
  if (!entry) {
    const m = glow
      ? new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: GLOW.day + nightGlow * GLOW.nightBoost, roughness: 0.4 })
      : new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05 });
    entry = { material: hung ? hung.material(m) : m, glow };
    materials.set(key, entry);
  }
  return entry.material;
}

/** Glowing parts (screens, lamps, grow lights) brighten as the sky darkens: 0 at noon, 1 at night. */
export function setFurnitureGlow(night: number): void {
  nightGlow = night;
  for (const { material: m, glow } of materials.values()) if (glow) m.emissiveIntensity = GLOW.day + night * GLOW.nightBoost;
}

/**
 * Wall hangings: each item's tag (its wall's inward normal, at twice its
 * length when there's something to see across the wall, the wall's base and
 * top, and a point on the wall), written to every vertex as `aWall` and
 * `aHang`, and how to adjust their materials so they react to them.
 */
export interface HangTag {
  nx: number;
  nz: number;
  y0: number;
  y1: number;
  ax: number;
  az: number;
}
export interface Hung {
  tags: HangTag[];
  key: string;
  material: (m: THREE.MeshStandardMaterial) => THREE.MeshStandardMaterial;
}

/**
 * Placed items as meshes, one per material, merged. `accent` is the room's
 * category colour. Returns an empty group when there's nothing to place.
 */
export function furnitureMeshes(placed: Placed[], accent: string, hung?: Hung): THREE.Group {
  const byMaterial = new Map<string, { material: THREE.MeshStandardMaterial; parts: THREE.BufferGeometry[] }>();
  const m = new THREE.Matrix4();
  placed.forEach((p, i) => {
    const def = itemDef(p.item);
    m.makeRotationY(p.turn).setPosition(p.x, p.y, p.z);
    const tag = hung?.tags[i];
    for (const part of def.parts) {
      const color = partColor(part, accent);
      const key = `${color}:${!!part.glow}`;
      let entry = byMaterial.get(key);
      if (!entry) byMaterial.set(key, (entry = { material: material(color, !!part.glow, hung), parts: [] }));
      const g = partGeometry(part);
      g.applyMatrix4(m);
      if (tag) {
        const n = g.getAttribute("position").count;
        g.setAttribute("aWall", new THREE.Float32BufferAttribute(Array.from({ length: n }, () => [tag.nx, tag.nz, tag.y0, tag.y1]).flat(), 4));
        g.setAttribute("aHang", new THREE.Float32BufferAttribute(Array.from({ length: n }, () => [tag.ax, tag.az]).flat(), 2));
      }
      entry.parts.push(g);
    }
  });
  const group = new THREE.Group();
  for (const { material: mat, parts } of byMaterial.values()) {
    const merged = mergeGeometries(parts.map((g) => g.toNonIndexed()));
    parts.forEach((g) => g.dispose());
    if (merged) group.add(new THREE.Mesh(merged, mat));
  }
  group.userData = { furniture: true };
  return group;
}

/** One item on its own, at the origin facing +z (for the dev tool's preview and catalogue). */
export function itemMesh(item: string, accent: string): THREE.Group {
  return furnitureMeshes([{ item, x: 0, y: 0, z: 0, turn: 0 }], accent);
}

/** Free a furniture group's geometry (materials are shared and stay). */
export function disposeFurniture(group: THREE.Object3D): void {
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose();
  });
}

export function disposeFurnitureMaterials(): void {
  materials.forEach(({ material: m }) => m.dispose());
  materials.clear();
}
