import * as THREE from "three";
import { buildTerrain, GROUND_BASE, siteSeed, soilTint } from "../render3d/terrain3d";
import { soilAt } from "../sim/map";
import { siteLatitude } from "../view/sunPath";
import type { SimState } from "../sim/state";

// The land round the hole for the Godot viewer, built by the web's own code (render3d/terrain3d.ts),
// so the same site gets the same land in both: the ground rolling away from the pad, with its craters;
// the boulders, as one shape and a placement each; the far ridge of the horizon; and the landforms in
// front of it (massifs, mesas, plateaus, hills, crater rims; T-016), a mesh and colour each.
// The ground's colour leans toward the map's at the site (T-073), and the site's latitude sets the
// sun's path and the stars' turning (T-020, view/sunPath.ts; Godot's Live.cs does the same sums).
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
  /** Degrees north: the sun's path and the stars' pole. */
  latitude: number;
  groundColor: string;
  ground: ReturnType<typeof meshData>;
  rocks: { mesh: ReturnType<typeof meshData>; color: string; transforms: string };
  /** The far ridge all the way round. */
  horizon: { mesh: ReturnType<typeof meshData>; color: string };
  /** The massifs, mesas, plateaus, hills and crater rims in front of it, each its own colour (paler the farther off). */
  landforms: { mesh: ReturnType<typeof meshData>; color: string }[];
}

export const terrainKey = (state: SimState) => `${state.holeId}:${state.layout.hole.shaftRadiusM}:${state.site?.lat}:${state.site?.lon}:${state.name}`;

export function terrainMessage(state: SimState): TerrainMessage {
  const ground = new THREE.MeshStandardMaterial();
  const soil = state.site ? soilAt(state.site) : null;
  const t = buildTerrain(state.layout.hole.shaftRadiusM, siteSeed(state.site, state.name), ground, soil);
  let rocks: TerrainMessage["rocks"] | null = null;
  let horizon: TerrainMessage["horizon"] | null = null;
  const landforms: TerrainMessage["landforms"] = [];
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
      const part = { mesh: meshData(o.geometry), color: `#${(o.material as THREE.MeshStandardMaterial).color.getHexString()}` };
      if (o.name === "landform") landforms.push(part);
      else horizon = part;
    }
  });
  const message: TerrainMessage = {
    type: "terrain",
    holeId: state.holeId,
    style: t.style,
    latitude: siteLatitude(state.site),
    groundColor: `#${soilTint(GROUND_BASE, soil).toString(16).padStart(6, "0")}`,
    ground: meshData(t.ground.geometry),
    rocks: rocks!,
    horizon: horizon!,
    landforms,
  };
  t.group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
  });
  return message;
}
