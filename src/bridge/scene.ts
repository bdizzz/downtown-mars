import * as THREE from "three";
import { config } from "../sim/config";
import { canDig, diggingFloor } from "../sim/digging";
import type { SimState } from "../sim/state";
import { buildLayout, disposeLayout } from "../render3d/rooms3d";
import { floorAtY } from "../render3d/cylinder";
import type { Lamp } from "../render3d/lights3d";
import type { Placed } from "../view/furnish";
import { occupied, type RoomSpots } from "../render3d/people3d";
import { gameTime } from "../sim/clock";
import { tubeRuns, type TubeRun } from "../view/gallery";
import { grimeLevel } from "../view/grime";

// The hole's 3D scene for the Godot viewer, built by the web game's own code (render3d/rooms3d.ts),
// so both draw the same rooms, walls, doors, windows, tubes and corridors. Triangles are merged by
// material, floor and part of the ring into chunks: few enough draw calls for a whole colony, small
// enough that the camera, each light and each shadow pass leave out what they don't reach. Godot gives each material its own look by name. Furniture
// travels as placements (item, where, which way, the room's accent colour): Godot builds each item
// once from data/furniture.json and draws every copy of it in one go.

/** Chunks split each floor into this many parts round the ring, so the camera and lights can leave out what they don't reach. */
const SECTORS = Number(process.env.DM_SECTORS ?? 8);

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
  /** Walls down: float32 per vertex, the wall tag (4), a line's second wall (2), and where their faces stand (3 + 3, rooms3d.ts FaceTag.at), when any vertex has one. */
  walls?: string;
  walls2?: string;
  faces?: string;
  /** Lines: each vertex's room (id + 1) on a room's outline, else 0 (float32). */
  rooms?: string;
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
export function sceneKey(state: SimState, gameId: number, topFloor: number | null, roomColors = true): string {
  const grime = state.layout.rooms.map(grimeLevel).join("");
  return `${gameId}:${state.holeId}:${state.layout.version}:${drillFloor(state)}:${topFloor}:${roomColors}:${grime}`;
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
  /** Walls down (rooms3d.ts aWall, aWall2): each vertex's wall tag, and a line's second wall; with any set, `walled`. */
  wall: number[];
  wall2: number[];
  /** Where each vertex's wall faces stand (rooms3d.ts aFace, aFace2): its wall's, and a line's second wall's. */
  face: number[];
  walled: boolean;
  /** Lines: each vertex's room (its id + 1) when it's a room's outline, else 0, for the viewer to tint by the room's trouble or the hover. */
  room: number[];
  roomed: boolean;
}

/** People (the web's people3d.ts): who's at a post, in a seat or in bed now, and the gallery tubes the walkers stroll. */
export interface PeopleMessage {
  type: "people";
  /** [kind (0 post, 1 seat, 2 bed), x, y, z, turn, floor, clothes, skin] */
  seated: number[][];
  tubes: TubeRun[];
  population: number;
}

/** What decides who's where: the scene, the hour, each room's staff and the head count. */
export function peopleKey(state: SimState, scene: string): string {
  const hour = Math.floor(gameTime(state.tick, config).dayFraction * 24);
  const staff = state.layout.rooms.map((r) => state.roomStatus[r.id]?.staff ?? 0).join(",");
  return `${scene}:${hour}:${staff}:${state.population.count}`;
}

export function buildPeople(state: SimState, spots: RoomSpots[]): PeopleMessage {
  const hour = Math.floor(gameTime(state.tick, config).dayFraction * 24);
  const kinds = { post: 0, seat: 1, bed: 2 } as const;
  const seated = occupied(spots, hour, (id) => state.roomStatus[id]?.staff ?? 0, state.population.count).map(({ spot: s, clothes, skin }) => [
    kinds[s.kind],
    round(s.x),
    round(s.y),
    round(s.z),
    round(s.turn),
    s.floor,
    clothes,
    skin,
  ]);
  return { type: "people", seated, tubes: tubeRuns(state.layout), population: state.population.count };
}

/** The scene, and each furnished room's spots for people (kept by the bridge, not sent). */
/** Room colours off: rooms in what they're built from (rock, marscrete, brick, metal), as the web's toggle. */
export function buildScene(state: SimState, gameId: number, topFloor: number | null, roomColors = true): { message: SceneMessage; spots: RoomSpots[] } {
  const t0 = performance.now();
  const layout = state.layout;
  const group = buildLayout(layout, drillFloor(state), COLORS, false, topFloor, roomColors, grimeLevel);
  group.updateMatrixWorld(true);

  const materials: SceneMaterial[] = [];
  const materialIndex = new Map<THREE.Material, number>();
  const buckets = new Map<string, Bucket>();
  const lamps: SceneMessage["lamps"] = [];
  const labels: SceneMessage["labels"] = [];
  const centre = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3();
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
  const spots: RoomSpots[] = [];
  group.traverse((o) => {
    if (o.userData.furniture && o.userData.placed) furnitureGroups.push(o);
  });
  for (const g of furnitureGroups) {
    for (const l of (g.userData.lamps as Lamp[] | undefined) ?? []) lamps.push({ x: l.x, y: l.y, z: l.z, floor: l.floor, color: l.color, reach: l.reach, strength: l.strength });
    if (g.userData.people) spots.push(g.userData.people as RoomSpots);
    const accent = indexIn(accents, g.userData.accent as string);
    // A wall hanging carries its wall (as rooms3d.ts hangTag): normal, bottom and top, and the point on it behind the item.
    for (const p of g.userData.placed as (Placed & { hang?: { nx: number; nz: number; at: [number, number, number]; y0: number; y1: number; ax: number; az: number } })[]) {
      const base = [indexIn(items, p.item), accent, round(p.x), round(p.y), round(p.z), round(p.turn)];
      placed.push(p.hang ? [...base, round(p.hang.nx), round(p.hang.nz), round(p.hang.y0), round(p.hang.y1), round(p.hang.ax), round(p.hang.az), ...p.hang.at.map(round)] : base);
    }
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
    const wallAttr = geo.getAttribute("aWall");
    const wall2Attr = geo.getAttribute("aWall2");
    const faceAttr = geo.getAttribute("aFace");
    const face2Attr = geo.getAttribute("aFace2");
    const lines = mesh instanceof THREE.LineSegments;
    const outlineOf = lines && typeof mesh.userData.roomId === "number" ? (mesh.userData.roomId as number) + 1 : 0;
    const count = mesh instanceof THREE.InstancedMesh ? mesh.count : 1;
    const mi = indexOf(material);
    const per = lines ? 2 : 3;
    const pts = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    const nrms = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    for (let k = 0; k < count; k++) {
      world.copy(mesh.matrixWorld);
      if (mesh instanceof THREE.InstancedMesh) world.multiply((mesh.getMatrixAt(k, instance), instance));
      normalMatrix.getNormalMatrix(world);
      // Triangle by triangle (segment by segment), into the chunk for its floor and its part of the ring.
      for (let i = 0; i + per <= p.count; i += per) {
        centre.set(0, 0, 0);
        for (let j = 0; j < per; j++) {
          pts[j]!.fromBufferAttribute(p, i + j).applyMatrix4(world);
          centre.add(pts[j]!);
          if (!lines) {
            if (nrmAttr) nrms[j]!.fromBufferAttribute(nrmAttr, i + j).applyMatrix3(normalMatrix).normalize();
            else nrms[j]!.set(0, 1, 0);
          }
        }
        centre.divideScalar(per);
        const floor = Math.max(0, floorAtY(centre.y));
        const sector = Math.floor(((Math.atan2(centre.z, centre.x) / (Math.PI * 2) + 1) % 1) * SECTORS) % SECTORS;
        const key = `${mi}:${floor}:${sector}:${lines}`;
        let b = buckets.get(key);
        if (!b) buckets.set(key, (b = { material: mi, floor, lines, pos: [], nrm: [], col: material.vertexColors ? [] : null, wall: [], wall2: [], face: [], walled: false, room: [], roomed: false }));
        for (let j = 0; j < per; j++) {
          b.pos.push(pts[j]!.x, pts[j]!.y, pts[j]!.z);
          if (!lines) b.nrm.push(nrms[j]!.x, nrms[j]!.y, nrms[j]!.z);
          if (b.col) {
            if (colAttr) b.col.push(colAttr.getX(i + j), colAttr.getY(i + j), colAttr.getZ(i + j));
            else b.col.push(1, 1, 1);
          }
          if (wallAttr) {
            b.wall.push(wallAttr.getX(i + j), wallAttr.getY(i + j), wallAttr.getZ(i + j), wallAttr.getW(i + j));
            b.walled ||= wallAttr.getX(i + j) !== 0 || wallAttr.getY(i + j) !== 0;
          } else b.wall.push(0, 0, 0, 0);
          if (wall2Attr) b.wall2.push(wall2Attr.getX(i + j), wall2Attr.getY(i + j));
          else b.wall2.push(0, 0);
          if (faceAttr) b.face.push(faceAttr.getX(i + j), faceAttr.getY(i + j), faceAttr.getZ(i + j));
          else b.face.push(0, 0, 0);
          if (face2Attr) b.face.push(face2Attr.getX(i + j), face2Attr.getY(i + j), face2Attr.getZ(i + j));
          else b.face.push(0, 0, 0);
          if (lines) {
            b.room.push(outlineOf);
            b.roomed ||= outlineOf > 0;
          }
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
    ...(b.walled ? { walls: base64(b.wall), walls2: base64(b.wall2), faces: base64(b.face) } : {}),
    ...(b.roomed ? { rooms: base64(b.room) } : {}),
  }));
  const message: SceneMessage = {
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
  return { message, spots };
}
