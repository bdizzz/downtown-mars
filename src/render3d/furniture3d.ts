import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { itemDef, partColor, type Part } from "../view/furniture";
import { GLOW_MODE, withGlowFx, withShimmer, withSway } from "./details3d";
import { PART_MAT, withPartPatterns } from "./surfaces";
import type { Placed } from "../view/furnish";

// Furniture as meshes. An item is built from its parts (data/furniture.json);
// a room's worth of placed items is merged into one mesh for what's plain and
// one for what glows, coloured per vertex, so a furnished room costs a couple
// of draw calls. Glowing parts share an emissive material that brightens at
// night. Each room also gets a coarser copy for when it's far from the camera
// (fewer facets, no small parts); the stage swaps between them.

const SEGMENTS = { cyl: 12, sphW: 10, sphH: 8 };
/** The far copy: rounder things with fewer facets, and parts smaller than `smallest` (metres, their longest side) left out. */
const FAR = { cyl: 6, sphW: 6, sphH: 4, smallest: 0.45 };
const GLOW = { day: 0.35, nightBoost: 0.9 };

/** Beyond this distance (metres) from the camera, a room's furniture draws its far copy. */
export const FURNITURE_LOD = { far: 55 };

export type Detail = "near" | "far";
export type { Placed };

/** Unit shapes, scaled per part, for each level of detail. */
const unit: Record<Detail, Record<Part["s"], THREE.BufferGeometry>> = {
  near: {
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, SEGMENTS.cyl),
    sph: new THREE.SphereGeometry(0.5, SEGMENTS.sphW, SEGMENTS.sphH),
  },
  far: {
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, FAR.cyl),
    sph: new THREE.SphereGeometry(0.5, FAR.sphW, FAR.sphH),
  },
};

/** A part's longest side, metres. */
function extent(part: Part): number {
  return Math.max(...part.z);
}

/** One part's geometry, in its item's own frame. */
function partGeometry(part: Part, detail: Detail = "near"): THREE.BufferGeometry {
  const g = unit[detail][part.s].clone();
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
 * What a part is made of, for its material: plain; glowing (screens, lamps,
 * fires, in their own colour); growing (it sways); or water (it shimmers).
 */
type Kind = "plain" | "glow" | "plant" | "water";
const PLANT_COLORS = new Set(["plant", "leaf", "potato", "soy", "stalk", "wheat", "barley", "algae", "flower"]);
function kindOf(part: Part): Kind {
  if (part.glow) return "glow";
  if (PLANT_COLORS.has(part.c)) return "plant";
  if (part.c === "water") return "water";
  return "plain";
}

/** How a glowing part behaves: fires dance, lamps and grow lights hold steady, small lights blink, screens flicker. */
function glowMode(part: Part): number {
  if (part.c === "fire") return GLOW_MODE.fire;
  if (part.c === "lamp" || part.c === "grow") return GLOW_MODE.steady;
  return extent(part) < GLOW_BLINK_UNDER ? GLOW_MODE.blink : GLOW_MODE.screen;
}
/** What parts are made of, by colour, for their fine pattern (surfaces.ts). */
const PART_MATS: Record<string, number> = {
  wood: PART_MAT.wood,
  composite: PART_MAT.wood,
  cushion: PART_MAT.fabric,
  cream: PART_MAT.fabric,
  metal: PART_MAT.metal,
  steel: PART_MAT.metal,
  panel: PART_MAT.painted,
  hazard: PART_MAT.painted,
  soil: PART_MAT.soil,
  substrate: PART_MAT.soil,
};

/** Glowing parts smaller than this (metres, their longest side) are indicator lights, and blink. */
const GLOW_BLINK_UNDER = 0.12;

/**
 * Materials, one per kind, all taking their colour from the vertices. Wall
 * hangings use their own copies, adjusted by `hung` (so they can vanish with their wall).
 */
const materials = new Map<string, { material: THREE.MeshStandardMaterial; glow: boolean }>();
let nightGlow = 0;
function material(kind: Kind, hung?: Hung): THREE.MeshStandardMaterial {
  const key = `${kind}${hung ? `:${hung.key}` : ""}`;
  let entry = materials.get(key);
  if (!entry) {
    let m: THREE.MeshStandardMaterial;
    if (kind === "glow") m = withGlowFx(glowing(new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0xffffff, emissiveIntensity: GLOW.day + nightGlow * GLOW.nightBoost, roughness: 0.4 })));
    else if (kind === "plant") m = withSway(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
    else if (kind === "water") m = withShimmer(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.1 }));
    else m = withPartPatterns(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.05 }));
    entry = { material: hung ? hung.material(m) : m, glow: kind === "glow" };
    materials.set(key, entry);
  }
  return entry.material;
}

/** Emissive light tinted by the vertex colour, so every glowing part shares one material. */
function glowing(m: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n  totalEmissiveRadiance *= vColor.rgb;");
  };
  m.customProgramCacheKey = () => "furniture-glow";
  return m;
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
 * Placed items as meshes, at one level of detail: one for plain parts and one
 * for glowing ones, merged, each tagged with its detail (`userData.detail`).
 * `accent` is the room's category colour. The far copy is built the first time
 * it's shown (see `showDetail`). Returns an empty group when there's nothing to place.
 */
export function furnitureMeshes(placed: Placed[], accent: string, hung?: Hung, detail: Detail = "near"): THREE.Group {
  const group = new THREE.Group();
  const m = new THREE.Matrix4();
  const colour = new THREE.Color();
  {
    const byKind = new Map<Kind, THREE.BufferGeometry[]>();
    placed.forEach((p, i) => {
      const def = itemDef(p.item);
      m.makeRotationY(p.turn).setPosition(p.x, p.y, p.z);
      const tag = hung?.tags[i];
      for (const part of def.parts) {
        if (detail === "far" && extent(part) < FAR.smallest) continue;
        const kind = kindOf(part);
        const g = partGeometry(part, detail).toNonIndexed();
        g.applyMatrix4(m);
        const n = g.getAttribute("position").count;
        colour.set(partColor(part, accent));
        const rgb = new Float32Array(n * 3);
        for (let k = 0; k < n; k++) rgb.set([colour.r, colour.g, colour.b], k * 3);
        g.setAttribute("color", new THREE.BufferAttribute(rgb, 3));
        if (kind === "glow") g.setAttribute("aGlow", new THREE.BufferAttribute(new Float32Array(n).fill(glowMode(part)), 1));
        if (kind === "plain") g.setAttribute("aMat", new THREE.BufferAttribute(new Float32Array(n).fill(PART_MATS[part.c] ?? PART_MAT.none), 1));
        if (tag) {
          const wall = new Float32Array(n * 4);
          const hang = new Float32Array(n * 2);
          for (let k = 0; k < n; k++) {
            wall.set([tag.nx, tag.nz, tag.y0, tag.y1], k * 4);
            hang.set([tag.ax, tag.az], k * 2);
          }
          g.setAttribute("aWall", new THREE.BufferAttribute(wall, 4));
          g.setAttribute("aHang", new THREE.BufferAttribute(hang, 2));
        }
        let list = byKind.get(kind);
        if (!list) byKind.set(kind, (list = []));
        list.push(g);
      }
    });
    for (const [kind, parts] of byKind) {
      const merged = mergeGeometries(parts);
      parts.forEach((g) => g.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, material(kind, hung));
      mesh.userData.detail = detail;
      group.add(mesh);
    }
  }
  group.userData = { furniture: true, centre: centreOf(placed), far: () => furnitureMeshes(placed, accent, hung, "far").children };
  return group;
}

/** The middle of some placed items, where a room's furniture is measured from for its level of detail. */
export function centreOf(placed: Placed[]): THREE.Vector3 {
  const c = new THREE.Vector3();
  for (const p of placed) c.add(new THREE.Vector3(p.x, p.y, p.z));
  return placed.length ? c.divideScalar(placed.length) : c;
}

/** Show a furniture group's near or far copy (building the far one the first time). Returns whether anything changed. */
export function showDetail(group: THREE.Object3D, detail: Detail): boolean {
  if ((group.userData.detailShown ?? "near") === detail) return false;
  group.userData.detailShown = detail;
  if (detail === "far" && !group.userData.farBuilt) {
    group.userData.farBuilt = true;
    const make = group.userData.far as (() => THREE.Object3D[]) | undefined;
    if (make) group.add(...make());
  }
  for (const o of group.children) if (o.userData.detail) o.visible = o.userData.detail === detail;
  return true;
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
