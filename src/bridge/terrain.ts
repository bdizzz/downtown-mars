import * as THREE from "three";
import { buildTerrain, siteSeed } from "../render3d/terrain3d";
import type { SimState } from "../sim/state";

// The land round the hole for the Godot viewer, built by the web's own code (render3d/terrain3d.ts),
// so the same site gets the same land in both: the ground rolling away from the pad, with its craters;
// the boulders, as one shape and a placement each; and the horizon's mountains, mesas or hills.
// Sent once per hole.

const b64f = (a: ArrayLike<number>) => Buffer.from(new Float32Array(a).buffer).toString("base64");
const b64i = (a: ArrayLike<number>) => Buffer.from(new Uint32Array(a).buffer).toString("base64");

/** A mesh as positions and normals (float32) and, when indexed, indices (uint32). */
function meshData(geo: THREE.BufferGeometry) {
  if (!geo.getAttribute("normal")) geo.computeVertexNormals();
  return {
    positions: b64f(geo.getAttribute("position").array),
    normals: b64f(geo.getAttribute("normal").array),
    ...(geo.index ? { indices: b64i(geo.index.array) } : {}),
  };
}

export interface TerrainMessage {
  type: "terrain";
  holeId: number;
  style: string;
  ground: ReturnType<typeof meshData>;
  rocks: { mesh: ReturnType<typeof meshData>; color: string; transforms: string };
  horizon: { mesh: ReturnType<typeof meshData>; color: string };
}

export const terrainKey = (state: SimState) => `${state.holeId}:${state.layout.hole.shaftRadiusM}:${state.site?.lat}:${state.site?.lon}:${state.name}`;

export function terrainMessage(state: SimState): TerrainMessage {
  const ground = new THREE.MeshStandardMaterial();
  const t = buildTerrain(state.layout.hole.shaftRadiusM, siteSeed(state.site, state.name), ground);
  let rocks: TerrainMessage["rocks"] | null = null;
  let horizon: TerrainMessage["horizon"] | null = null;
  t.group.traverse((o) => {
    if (o instanceof THREE.InstancedMesh) {
      // Each boulder's transform: a 3×4 matrix (Godot's Transform3D: basis columns, then origin).
      const out: number[] = [];
      const m = new THREE.Matrix4();
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m);
        const e = m.elements;
        out.push(e[0]!, e[1]!, e[2]!, e[4]!, e[5]!, e[6]!, e[8]!, e[9]!, e[10]!, e[12]!, e[13]!, e[14]!);
      }
      rocks = { mesh: meshData(o.geometry.index ? o.geometry.toNonIndexed() : o.geometry), color: `#${(o.material as THREE.MeshStandardMaterial).color.getHexString()}`, transforms: b64f(out) };
    } else if (o instanceof THREE.Mesh && o !== t.ground) {
      horizon = { mesh: meshData(o.geometry), color: `#${(o.material as THREE.MeshStandardMaterial).color.getHexString()}` };
    }
  });
  const message: TerrainMessage = { type: "terrain", holeId: state.holeId, style: t.style, ground: meshData(t.ground.geometry), rocks: rocks!, horizon: horizon! };
  t.group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
  });
  return message;
}
