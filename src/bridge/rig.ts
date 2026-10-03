import * as THREE from "three";
import { canDig, diggingFloor, ticksToDig } from "../sim/digging";
import { config } from "../sim/config";
import type { SimState } from "../sim/state";
import { floorSpan, FLOOR_H, RIG_DROP } from "../render3d/cylinder";
import { makeDrillRig } from "../render3d/drillRig";

// The drill rig for the Godot viewer, built by the web's own code (render3d/drillRig.ts) and braced
// in the bore as the web places it: sent as a tree of parts, each with its transform and its meshes,
// so the parts that move (named "rig:…") keep their pivots. Godot rides it down with the dig front,
// stretches the cables, and turns, runs and blinks it itself. Sent again only when the grippers
// change (they brace once there's bore enough), or for another hole.

interface RigNode {
  name: string;
  p: number[];
  q: number[];
  s: number[];
  meshes: { material: number; positions: string; normals: string }[];
  children: RigNode[];
}

export interface RigMessage {
  type: "rig";
  holeId: number;
  materials: { name: string; color: string; emissive: string; emissiveIntensity: number; roughness: number; metalness: number; opacity: number; transparent: boolean }[];
  root: RigNode;
  /** Where the cables start (rig space, metres up), and the conveyor's length for the spoil riding it. */
  tops: { hoist: number; power: number; conveyor: number };
}

const b64 = (a: ArrayLike<number>) => Buffer.from(new Float32Array(a).buffer).toString("base64");

/** Where the cutter face is (y) and how much fresh bore is above it, as the web's stage works it out. */
function placing(state: SimState): { front: number; bore: number; active: boolean } {
  const floor = canDig(state, config) ? diggingFloor(state) : null;
  const needed = floor ? ticksToDig(floor, config) : 1;
  const progress = floor ? Math.min(1, state.drill.progress / Math.max(1, needed)) : 0;
  const deepest = state.layout.hole.floors;
  const front = (floor !== null ? floorSpan(floor)[1] - progress * FLOOR_H : floorSpan(deepest)[0]) - RIG_DROP;
  return { front, bore: floorSpan(deepest)[0] - front, active: state.drill.active && floor !== null };
}

/** The grippers brace on the bore once there's room for them: what decides when the rig is sent again. */
export function rigKey(state: SimState, gameId: number): string {
  const { bore } = placing(state);
  return `${gameId}:${state.holeId}:${state.layout.hole.shaftRadiusM}:${bore >= 3}`;
}

export function rigMessage(state: SimState): RigMessage {
  const rig = makeDrillRig(state.layout.hole);
  const { front, bore, active } = placing(state);
  rig.place(front, bore, active);
  const materials: RigMessage["materials"] = [];
  const index = new Map<THREE.Material, number>();
  const materialOf = (m: THREE.Material) => {
    let i = index.get(m);
    if (i === undefined) {
      const s = m as THREE.MeshStandardMaterial;
      i = materials.push({
        name: m.name,
        color: `#${s.color.getHexString()}`,
        emissive: `#${(s.emissive ?? new THREE.Color(0)).getHexString()}`,
        emissiveIntensity: s.emissiveIntensity ?? 0,
        roughness: s.roughness ?? 1,
        metalness: s.metalness ?? 0,
        opacity: m.opacity,
        transparent: m.transparent,
      }) - 1;
      index.set(m, i);
    }
    return i;
  };
  const walk = (o: THREE.Object3D): RigNode => {
    const meshes: RigNode["meshes"] = [];
    if (o instanceof THREE.Mesh) {
      const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
      if (!geo.getAttribute("normal")) geo.computeVertexNormals();
      meshes.push({ material: materialOf(Array.isArray(o.material) ? o.material[0]! : o.material), positions: b64(geo.getAttribute("position").array), normals: b64(geo.getAttribute("normal").array) });
    }
    return {
      name: o.name,
      p: o.position.toArray(),
      q: o.quaternion.toArray(),
      s: o.scale.toArray(),
      meshes,
      children: o.children.map(walk),
    };
  };
  const root = walk(rig.group);
  // The rig rides with the front: Godot places it, so the tree starts at the origin.
  root.p = [0, 0, 0];
  const tops = rig.group.userData.cableTops as RigMessage["tops"];
  rig.dispose();
  return { type: "rig", holeId: state.holeId, materials, root, tops };
}
