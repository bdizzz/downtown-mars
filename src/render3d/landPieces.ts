import * as THREE from "three";
import made from "../../models/land/pieces.json";

// The land's hero pieces (#497), sculpted in Blender (models/land/land.py: mesas and buttes worn back in
// beds, a crater's tiered mound, buttresses for a canyon's walls) and committed as models/land/pieces.json,
// so the game and the bridge read them as they are and the build never runs Blender. Each is in its own unit
// frame: a radial piece's footprint has radius 1, a buttress is 2 wide with its face toward -z; y runs from
// the ground (0) to its top (1).

export type PieceName = "mesa_a" | "mesa_b" | "butte_a" | "butte_b" | "mound" | "buttress_a" | "buttress_b" | "buttress_c";

interface Packed {
  min: number[];
  max: number[];
  positions: string;
  shade: string;
  indices: string;
}

const PIECES = (made as unknown as { pieces: Record<PieceName, Packed> }).pieces;

function bytes(b64: string): Uint8Array {
  if (typeof atob === "function") return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Uint8Array(Buffer.from(b64, "base64"));
}

/** A piece's shape in its unit frame: where each vertex is, how dark its baked occlusion leaves it (0 to 1), and its triangles. */
export interface Piece {
  positions: Float32Array;
  shade: Float32Array;
  indices: Uint16Array;
}

const cache = new Map<PieceName, Piece>();

export function piece(name: PieceName): Piece {
  const hit = cache.get(name);
  if (hit) return hit;
  const p = PIECES[name];
  const q = bytes(p.positions);
  const view = new DataView(q.buffer, q.byteOffset, q.byteLength);
  const positions = new Float32Array(q.byteLength / 2);
  for (let i = 0; i < positions.length; i++) {
    const k = i % 3;
    positions[i] = p.min[k]! + (view.getUint16(i * 2, true) / 65535) * (p.max[k]! - p.min[k]!);
  }
  const s = bytes(p.shade);
  const shade = Float32Array.from(s, (v) => v / 255);
  const ib = bytes(p.indices);
  const iv = new DataView(ib.buffer, ib.byteOffset, ib.byteLength);
  const indices = new Uint16Array(ib.byteLength / 2);
  for (let i = 0; i < indices.length; i++) indices[i] = iv.getUint16(i * 2, true);
  const made = { positions, shade, indices };
  cache.set(name, made);
  return made;
}

/**
 * A piece placed in the world: each unit-frame point (x, y, z) goes to `place(x, y, z)`. Its faces stay
 * facets (flat-shaded, as the rest of the land), its occlusion becomes the vertices' colour, and each vertex
 * keeps how far up the piece it stands (landH) for the rock's beds.
 */
export function placedGeometry(name: PieceName, place: (x: number, y: number, z: number) => [number, number, number]): THREE.BufferGeometry {
  const p = piece(name);
  const pos: number[] = [];
  const col: number[] = [];
  const hs: number[] = [];
  for (const i of p.indices) {
    const x = p.positions[i * 3]!;
    const y = p.positions[i * 3 + 1]!;
    const z = p.positions[i * 3 + 2]!;
    pos.push(...place(x, y, z));
    const s = p.shade[i]!;
    col.push(s, s, s);
    hs.push(Math.max(0, Math.min(1, y)));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute("landH", new THREE.Float32BufferAttribute(hs, 1));
  geo.computeVertexNormals();
  return geo;
}
