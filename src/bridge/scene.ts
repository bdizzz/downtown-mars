import * as THREE from "three";
import { config } from "../sim/config";
import { canDig, diggingFloor } from "../sim/digging";
import type { SimState } from "../sim/state";
import { buildLayout, disposeLayout } from "../render3d/rooms3d";
import { floorAtY } from "../render3d/cylinder";
import type { Lamp } from "../render3d/lights3d";
import type { Placed } from "../view/furnish";
import { grimeLevel } from "../view/grime";

// The hole's 3D scene for the Godot viewer, built by the web game's own code (render3d/rooms3d.ts),
// so both draw the same rooms, walls, doors, windows, tubes and corridors. Meshes are merged by
// material and floor into chunks: a few hundred draw calls for a whole colony, while Godot can
// still leave out floors off screen. Godot gives each material its own look by name. Furniture
// travels as placements (item, where, which way, the room's accent colour): Godot builds each item
// once from data/furniture.json and draws every copy of it in one go.

/** The web view's rock and unconnected-room colours (stage3d.ts). */
const COLORS = { rock: 0x6a3a28, stranded: 0xe0503a };

export interface SceneMaterial {
  name: string;
  kind: "standard" | "basic" | "line";
  color: string;
  emissive: string;
  emissiveIntensity: number;
  roughness: number;
  metalness: number;
  opacity: number;
  transparent: boolean;
  vertexColors: boolean;
  doubleSided: boolean;
}

export interface SceneChunk {
  material: number;
  /** The floor it's on (0: the surface and crust), for leaving out what's hidden. */
  floor: number;
  lines: boolean;
  /** Float32 xyz per vertex, base64; triangles unindexed, lines in pairs. */
  positions: string;
  normals?: string;
  /** Float32 rgb per vertex. */
  colors?: string;
}

export interface SceneMessage {
  type: "scene";
  gameId: number;
  layoutVersion: number;
  topFloor: number | null;
  floors: number;
  materials: SceneMaterial[];
  chunks: SceneChunk[];
  lamps: Omit<Lamp, "px" | "pz">[];
  labels: { text: string; x: number; y: number; z: number; roomId: number }[];
  /** Furniture: item ids and accent colours, and per item placed [item, accent, x, y, z, turn] (indexes into those two lists). */
  furniture: { items: string[]; accents: string[]; placed: number[][] };
  buildMs: number;
}

/** What decides the scene: when it changes, build again. */
export function sceneKey(state: SimState, gameId: number, topFloor: number | null): string {
  const grime = state.layout.rooms.map(grimeLevel).join("");
  return `${gameId}:${state.layout.version}:${drillFloor(state)}:${topFloor}:${grime}`;
}

function drillFloor(state: SimState): number | null {
  return canDig(state, config) ? diggingFloor(state) : null;
}

const hex = (c: THREE.Color | undefined) => `#${(c ?? new THREE.Color(0xffffff)).getHexString()}`;

function describe(m: THREE.Material): SceneMaterial {
  const s = m as THREE.MeshStandardMaterial;
  const kind = m instanceof THREE.LineBasicMaterial ? "line" : m instanceof THREE.MeshStandardMaterial ? "standard" : "basic";
  return {
    name: m.name || "",
    kind,
    color: hex(s.color),
    emissive: hex(s.emissive ?? new THREE.Color(0)),
    emissiveIntensity: s.emissiveIntensity ?? 0,
    roughness: s.roughness ?? 1,
    metalness: s.metalness ?? 0,
    opacity: m.opacity,
    transparent: m.transparent,
    vertexColors: m.vertexColors,
    doubleSided: m.side === THREE.DoubleSide,
  };
}

const round = (x: number) => Math.round(x * 1000) / 1000;

function base64(a: number[]): string {
  return Buffer.from(new Float32Array(a).buffer).toString("base64");
}

interface Bucket {
  material: number;
  floor: number;
  lines: boolean;
  pos: number[];
  nrm: number[];
  col: number[] | null;
}

export function buildScene(state: SimState, gameId: number, topFloor: number | null): SceneMessage {
  const t0 = performance.now();
  const layout = state.layout;
  const group = buildLayout(layout, drillFloor(state), COLORS, false, topFloor, true, grimeLevel);
  group.updateMatrixWorld(true);

  const materials: SceneMaterial[] = [];
  const materialIndex = new Map<THREE.Material, number>();
  const buckets = new Map<string, Bucket>();
  const lamps: SceneMessage["lamps"] = [];
  const labels: SceneMessage["labels"] = [];
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3();
  const box = new THREE.Box3();
  const instance = new THREE.Matrix4();
  const world = new THREE.Matrix4();

  const indexOf = (m: THREE.Material) => {
    let i = materialIndex.get(m);
    if (i === undefined) {
      i = materials.length;
      materials.push(describe(m));
      materialIndex.set(m, i);
    }
    return i;
  };

  // Furniture: what stands where (and its lamps); its meshes aren't sent.
  const items: string[] = [];
  const accents: string[] = [];
  const placed: number[][] = [];
  const indexIn = (list: string[], s: string) => {
    const i = list.indexOf(s);
    return i >= 0 ? i : list.push(s) - 1;
  };
  const furnitureGroups: THREE.Object3D[] = [];
  group.traverse((o) => {
    if (o.userData.furniture && o.userData.placed) furnitureGroups.push(o);
  });
  for (const g of furnitureGroups) {
    for (const l of (g.userData.lamps as Lamp[] | undefined) ?? []) lamps.push({ x: l.x, y: l.y, z: l.z, floor: l.floor, color: l.color, reach: l.reach, strength: l.strength });
    const accent = indexIn(accents, g.userData.accent as string);
    for (const p of g.userData.placed as Placed[]) placed.push([indexIn(items, p.item), accent, round(p.x), round(p.y), round(p.z), round(p.turn)]);
    g.removeFromParent();
  }

  group.traverse((o) => {
    if (o instanceof THREE.Sprite) {
      if (o.userData.label && typeof o.userData.roomId === "number") labels.push({ text: (o.userData.text as string) ?? "", x: o.position.x, y: o.position.y, z: o.position.z, roomId: o.userData.roomId as number });
      return;
    }
    const mesh = o as THREE.Mesh | THREE.LineSegments;
    if (!(mesh instanceof THREE.Mesh || mesh instanceof THREE.LineSegments) || !mesh.visible) return;
    const material = Array.isArray(mesh.material) ? mesh.material[0]! : mesh.material;
    // The web's fake light pools: Godot has real lights.
    if (material.blending === THREE.AdditiveBlending) return;
    const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
    const p = geo.getAttribute("position");
    if (!p || p.count === 0) return;
    const nrmAttr = geo.getAttribute("normal");
    const colAttr = geo.getAttribute("color");
    const lines = mesh instanceof THREE.LineSegments;
    const count = mesh instanceof THREE.InstancedMesh ? mesh.count : 1;
    for (let k = 0; k < count; k++) {
      world.copy(mesh.matrixWorld);
      if (mesh instanceof THREE.InstancedMesh) world.multiply((mesh.getMatrixAt(k, instance), instance));
      normalMatrix.getNormalMatrix(world);
      box.makeEmpty();
      for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(world));
      const floor = Math.max(0, floorAtY((box.min.y + box.max.y) / 2));
      const mi = indexOf(material);
      const key = `${mi}:${floor}:${lines}`;
      let b = buckets.get(key);
      if (!b) buckets.set(key, (b = { material: mi, floor, lines, pos: [], nrm: [], col: material.vertexColors ? [] : null }));
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(world);
        b.pos.push(v.x, v.y, v.z);
        if (!lines) {
          if (nrmAttr) n.fromBufferAttribute(nrmAttr, i).applyMatrix3(normalMatrix).normalize();
          else n.set(0, 1, 0);
          b.nrm.push(n.x, n.y, n.z);
        }
        if (b.col) {
          if (colAttr) b.col.push(colAttr.getX(i), colAttr.getY(i), colAttr.getZ(i));
          else b.col.push(1, 1, 1);
        }
      }
    }
    if (geo !== mesh.geometry) geo.dispose();
  });
  disposeLayout(group);

  const chunks: SceneChunk[] = [...buckets.values()].map((b) => ({
    material: b.material,
    floor: b.floor,
    lines: b.lines,
    positions: base64(b.pos),
    ...(b.lines ? {} : { normals: base64(b.nrm) }),
    ...(b.col ? { colors: base64(b.col) } : {}),
  }));
  return {
    type: "scene",
    gameId,
    layoutVersion: layout.version,
    topFloor,
    floors: layout.hole.floors,
    materials,
    chunks,
    lamps,
    labels,
    furniture: { items, accents, placed },
    buildMs: performance.now() - t0,
  };
}
