import * as THREE from "three";

// The land's hero pieces (#497), sculpted in Blender (models/land/land.py: mesas and buttes worn back in
// beds, a crater's tiered mound, buttresses for a canyon's walls) and committed as public/models/land.bin, so
// the build never runs Blender. The 3D view fetches the file as it starts (until it's in, the land is drawn
// from its code-built shapes, then built again); the bridge reads it from disk. Each piece is in its own unit
// frame: a radial piece's footprint has radius 1, a buttress is 2 wide with its face toward -z; y runs from
// the ground (0) to its top (1).

export type PieceName = "mesa_a" | "mesa_b" | "butte_a" | "butte_b" | "mound" | "buttress_a" | "buttress_b" | "buttress_c";

/** A piece's shape in its unit frame: where each vertex is, how dark its baked occlusion leaves it (0 to 1), and its triangles. */
export interface Piece {
  positions: Float32Array;
  shade: Float32Array;
  indices: Uint16Array;
}

let pieces: Map<PieceName, Piece> | null = null;

/** Whether the pieces are in (the land uses them only then). */
export const piecesReady = (): boolean => pieces !== null;

/** Read land.bin (see models/land/land.py for its layout). */
export function setPieces(buffer: ArrayBuffer | Uint8Array): void {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (String.fromCharCode(...bytes.subarray(0, 4)) !== "DMLP") throw new Error("land.bin: not a land pieces file");
  const headLength = view.getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + headLength))) as {
    pieces: Record<PieceName, { min: number[]; max: number[]; vertices: number; triangles: number; offset: number }>;
  };
  const body = 8 + headLength;
  const out = new Map<PieceName, Piece>();
  for (const [name, p] of Object.entries(header.pieces) as [PieceName, (typeof header.pieces)[PieceName]][]) {
    let at = body + p.offset;
    const positions = new Float32Array(p.vertices * 3);
    for (let i = 0; i < positions.length; i++, at += 2) {
      const k = i % 3;
      positions[i] = p.min[k]! + (view.getUint16(at, true) / 65535) * (p.max[k]! - p.min[k]!);
    }
    const shade = new Float32Array(p.vertices);
    for (let i = 0; i < p.vertices; i++) shade[i] = bytes[at + i]! / 255;
    at += p.vertices + (p.vertices % 2);
    const indices = new Uint16Array(p.triangles * 3);
    for (let i = 0; i < indices.length; i++, at += 2) indices[i] = view.getUint16(at, true);
    out.set(name, { positions, shade, indices });
  }
  pieces = out;
}

export function piece(name: PieceName): Piece {
  const p = pieces?.get(name);
  if (!p) throw new Error(`land piece ${name} isn't loaded`);
  return p;
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
