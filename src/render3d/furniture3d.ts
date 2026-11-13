import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { itemDef, partColor, type Part } from "../view/furniture";
import { GLOW_MODE, withGlowFx, withShimmer, withSway } from "./details3d";
import { PART_MAT, withPartPatterns } from "./surfaces";
import { stageScale, type Placed } from "../view/furnish";
import { fpModelFor, fpTextures, slotExtent, type ModelSlot } from "../view/models";

// Furniture as meshes. An item is built from its parts (data/furniture.json);
// a room's worth of placed items is merged into one mesh for what's plain and
// one for what glows, coloured per vertex, so a furnished room costs a couple
// of draw calls. Glowing parts share an emissive material that brightens at
// night. Each room also gets a coarser copy for when it's far from the camera
// (fewer facets, no small parts); the stage swaps between them. In first person, rooms near
// the camera get a third copy, `fp`: items with a Blender-made model (view/models.ts, #360) draw
// it, the rest their near parts.

const SEGMENTS = { cyl: 12, sphW: 10, sphH: 8 };
/** The far copy: rounder things with fewer facets, and parts smaller than `smallest` (metres, their longest side) left out. */
const FAR = { cyl: 6, sphW: 6, sphH: 4, smallest: 0.45 };
const GLOW = { day: 0.35, nightBoost: 0.9 };

/** Beyond this distance (metres) from the camera, a room's furniture draws its far copy. */
export const FURNITURE_LOD = { far: 55 };

/** How detailed a room's furniture is drawn: near, far (past FURNITURE_LOD.far), or fp (first person, near: models where items have them). */
export type Detail = "near" | "far" | "fp";
export type { Placed };

/** Unit shapes, scaled per part, for each level of detail. */
const unit: Record<Exclude<Detail, "fp">, Record<Part["s"], THREE.BufferGeometry>> = {
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

/** A model slot's triangles (public/models/fp.bin) as unindexed geometry, in its item's own frame. */
function slotGeometry(slot: ModelSlot): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(slot.v, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(slot.n, 3));
  if (slot.shade) g.setAttribute("shade", new THREE.BufferAttribute(slot.shade, 1));
  if (slot.uv) g.setAttribute("aFpUv", new THREE.BufferAttribute(slot.uv, 2));
  g.setIndex(new THREE.BufferAttribute(slot.i, 1));
  const flat = g.toNonIndexed();
  g.dispose();
  return flat;
}

const slotSizes = new WeakMap<ModelSlot, number>();
function slotSize(slot: ModelSlot): number {
  let s = slotSizes.get(slot);
  if (s === undefined) slotSizes.set(slot, (s = slotExtent(slot)));
  return s;
}

/** One part's geometry, in its item's own frame. */
function partGeometry(part: Part, detail: Detail = "near"): THREE.BufferGeometry {
  const g = unit[detail === "far" ? "far" : "near"][part.s].clone();
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
/** What decides a part's (or a model slot's) material: its colour, whether it glows, and its longest side (metres). */
interface Look {
  c: string;
  glow?: boolean;
  size: number;
  /** A model slot's fine texture (#361), an index into fpTextures(). */
  tex?: number;
}
const PLANT_COLORS = new Set(["plant", "leaf", "potato", "soy", "stalk", "wheat", "barley", "algae", "flower"]);
function kindOf(part: Look): Kind {
  if (part.glow) return "glow";
  if (PLANT_COLORS.has(part.c)) return "plant";
  if (part.c === "water") return "water";
  return "plain";
}

/** How a glowing part behaves: fires dance, lamps and grow lights hold steady, small lights blink, screens flicker. */
function glowMode(part: Look): number {
  if (part.c === "fire") return GLOW_MODE.fire;
  if (part.c === "lamp" || part.c === "grow") return GLOW_MODE.steady;
  return part.size < GLOW_BLINK_UNDER ? GLOW_MODE.blink : GLOW_MODE.screen;
}
/** What parts are made of, by colour, for their fine pattern (surfaces.ts). */
const PART_MATS: Record<string, number> = {
  fibre: PART_MAT.fibre,
  composite: PART_MAT.fibre,
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
function material(kind: Kind, hung?: Hung, textured = false): THREE.MeshStandardMaterial {
  const key = `${kind}${textured ? ":fp" : ""}${hung ? `:${hung.key}` : ""}`;
  let entry = materials.get(key);
  if (!entry) {
    let m: THREE.MeshStandardMaterial;
    if (kind === "glow") m = withGlowFx(glowing(new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0xffffff, emissiveIntensity: GLOW.day + nightGlow * GLOW.nightBoost, roughness: 0.4 })));
    else if (kind === "plant") m = withSway(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
    else if (kind === "water") m = withShimmer(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.1 }));
    else m = withPartPatterns(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.05 }));
    if (textured) m = withFpTextures(m);
    entry = { material: hung ? hung.material(m) : m, glow: kind === "glow" };
    entry.material.name = `furniture:${key}`;
    materials.set(key, entry);
  }
  return entry.material;
}

/**
 * The first-person models' fine textures (#361, view/models.ts) as one array texture, made the
 * first time it's needed: grey detail, doubled and multiplied into the colour, so 0.5 leaves it be.
 */
let fpTextureArray: THREE.DataArrayTexture | null = null;
function fpTextureFor(): THREE.DataArrayTexture | null {
  if (fpTextureArray) return fpTextureArray;
  const t = fpTextures();
  if (!t) return null;
  const tex = new THREE.DataArrayTexture(t.pixels, t.size, t.size, t.names.length);
  tex.format = THREE.RedFormat;
  tex.type = THREE.UnsignedByteType;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return (fpTextureArray = tex);
}

/** Furniture's first-person copy: each vertex's texture (`aTex`, -1 for none) at `aFpUv` tints its colour. */
function withFpTextures(m: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  const prev = m.onBeforeCompile;
  const prevKey = m.customProgramCacheKey();
  m.onBeforeCompile = (shader, renderer) => {
    prev.call(m, shader, renderer);
    shader.uniforms.fpTextures = { value: fpTextureFor() };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 aFpUv;\nattribute float aTex;\nvarying vec2 vFpUv;\nvarying float vFpTex;")
      .replace("#include <project_vertex>", "vFpUv = aFpUv;\nvFpTex = aTex;\n#include <project_vertex>");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform highp sampler2DArray fpTextures;\nvarying vec2 vFpUv;\nvarying float vFpTex;")
      .replace("#include <color_fragment>", "#include <color_fragment>\nif (vFpTex > -0.5) diffuseColor.rgb *= texture(fpTextures, vec3(vFpUv, floor(vFpTex + 0.5))).r * 2.0;");
  };
  m.customProgramCacheKey = () => `${prevKey}|fp-textures`;
  return m;
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
 * Wall hangings: each item's tag (its wall face's tag, as rooms3d.ts
 * `faceTag`: inward normal, longer with a room across the wall, and where
 * the face stands; the wall's base and top; and a point on the wall), written
 * to every vertex as `aWall`, `aFace` and `aHang`, and how to adjust their
 * materials so they react to them.
 */
export interface HangTag {
  nx: number;
  nz: number;
  at: [number, number, number];
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
 * `accent` is the room's category colour. The far and first-person copies are
 * built the first time they're shown (see `showDetail`). Returns an empty group when there's nothing to place.
 */
export function furnitureMeshes(placed: Placed[], accent: string, hung?: Hung, detail: Detail = "near"): THREE.Group {
  const group = new THREE.Group();
  const m = new THREE.Matrix4();
  const colour = new THREE.Color();
  {
    const byKind = new Map<Kind, THREE.BufferGeometry[]>();
    /** Adds one part's (or model slot's) geometry, in its item's own frame, to its kind's list; a growing crop's part at its stage's size. */
    const add = (g: THREE.BufferGeometry, look: Look, tag: HangTag | undefined, stage?: number): void => {
      const kind = kindOf(look);
      const k = stageScale(look.c, stage);
      if (k <= 0) {
        g.dispose();
        return;
      }
      if (k < 1) {
        // Shrunk toward its own foot: it comes up out of the soil as it grows.
        g.computeBoundingBox();
        const b = g.boundingBox!;
        const foot = new THREE.Vector3((b.min.x + b.max.x) / 2, b.min.y, (b.min.z + b.max.z) / 2);
        g.applyMatrix4(new THREE.Matrix4().makeTranslation(-foot.x, -foot.y, -foot.z)).applyMatrix4(new THREE.Matrix4().makeScale(k, k, k)).applyMatrix4(new THREE.Matrix4().makeTranslation(foot.x, foot.y, foot.z));
      }
      g.applyMatrix4(m);
      // Parts come with uvs and models don't: nothing reads them (patterns go by position, surfaces.ts),
      // and geometries merge only with the same attributes, so a room mixing the two needs them gone.
      if (g.getAttribute("uv")) g.deleteAttribute("uv");
      const n = g.getAttribute("position").count;
      colour.set(partColor(look, accent));
      const rgb = new Float32Array(n * 3);
      // A model's baked shade darkens its corners (code-built parts have none).
      const shade = g.getAttribute("shade");
      if (shade) g.deleteAttribute("shade");
      for (let k = 0; k < n; k++) {
        const s = shade ? shade.getX(k) : 1;
        rgb.set([colour.r * s, colour.g * s, colour.b * s], k * 3);
      }
      g.setAttribute("color", new THREE.BufferAttribute(rgb, 3));
      if (kind === "glow") g.setAttribute("aGlow", new THREE.BufferAttribute(new Float32Array(n).fill(glowMode(look)), 1));
      // A textured model slot takes its texture rather than its colour's pattern.
      if (kind === "plain") g.setAttribute("aMat", new THREE.BufferAttribute(new Float32Array(n).fill(look.tex !== undefined ? PART_MAT.none : (PART_MATS[look.c] ?? PART_MAT.none)), 1));
      // The first-person copy's plain surfaces all carry a texture and where on it (none: -1), so they merge.
      if (detail === "fp" && kind === "plain") {
        if (!g.getAttribute("aFpUv")) g.setAttribute("aFpUv", new THREE.BufferAttribute(new Float32Array(n * 2), 2));
        g.setAttribute("aTex", new THREE.BufferAttribute(new Float32Array(n).fill(look.tex ?? -1), 1));
      } else if (g.getAttribute("aFpUv")) g.deleteAttribute("aFpUv");
      if (tag) {
        const wall = new Float32Array(n * 4);
        const hang = new Float32Array(n * 2);
        const face = new Float32Array(n * 3);
        for (let k = 0; k < n; k++) {
          wall.set([tag.nx, tag.nz, tag.y0, tag.y1], k * 4);
          hang.set([tag.ax, tag.az], k * 2);
          face.set(tag.at, k * 3);
        }
        g.setAttribute("aWall", new THREE.BufferAttribute(wall, 4));
        g.setAttribute("aHang", new THREE.BufferAttribute(hang, 2));
        g.setAttribute("aFace", new THREE.BufferAttribute(face, 3));
      }
      let list = byKind.get(kind);
      if (!list) byKind.set(kind, (list = []));
      list.push(g);
    };
    placed.forEach((p, i) => {
      const def = itemDef(p.item);
      m.makeRotationY(p.turn).setPosition(p.x, p.y, p.z);
      const tag = hung?.tags[i];
      const model = detail === "fp" ? fpModelFor(p.item) : undefined;
      if (model) {
        for (const slot of model) add(slotGeometry(slot), { c: slot.c, glow: slot.glow, size: slotSize(slot), tex: slot.tex }, tag, p.stage);
        return;
      }
      for (const part of def.parts) {
        if (detail === "far" && extent(part) < FAR.smallest) continue;
        add(partGeometry(part, detail).toNonIndexed(), { c: part.c, glow: part.glow, size: extent(part) }, tag, p.stage);
      }
    });
    for (const [kind, parts] of byKind) {
      const merged = mergeGeometries(parts);
      parts.forEach((g) => g.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, material(kind, hung, detail === "fp" && kind === "plain"));
      mesh.userData.detail = detail;
      group.add(mesh);
    }
  }
  group.userData = {
    furniture: true,
    centre: centreOf(placed),
    far: () => furnitureMeshes(placed, accent, hung, "far").children,
    fp: () => furnitureMeshes(placed, accent, hung, "fp").children,
    hasFp: () => placed.some((p) => fpModelFor(p.item)),
  };
  return group;
}

/** The middle of some placed items, where a room's furniture is measured from for its level of detail. */
export function centreOf(placed: Placed[]): THREE.Vector3 {
  const c = new THREE.Vector3();
  for (const p of placed) c.add(new THREE.Vector3(p.x, p.y, p.z));
  return placed.length ? c.divideScalar(placed.length) : c;
}

/**
 * Show a furniture group's near, far or first-person copy (building the far and first-person ones the
 * first time). A room with no item that has a model (or before the models are in) shows near for fp.
 * Returns whether anything changed.
 */
export function showDetail(group: THREE.Object3D, wanted: Detail): boolean {
  const detail = wanted === "fp" && !(group.userData.hasFp as (() => boolean) | undefined)?.() ? "near" : wanted;
  if ((group.userData.detailShown ?? "near") === detail) return false;
  group.userData.detailShown = detail;
  if (detail !== "near" && !group.userData[`${detail}Built`]) {
    group.userData[`${detail}Built`] = true;
    const make = group.userData[detail] as (() => THREE.Object3D[]) | undefined;
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
