// Furniture models made in Blender (#357), the first-person tier (#360): public/models/fp.bin,
// packed by scripts/models.mjs from models/*.glb (its header comment has the format). Drawn only
// in first person, up close; every other view draws items from their code-built parts
// (data/furniture.json), and so does first person for an item with no model. The file is fetched
// the first time you go into first person, so the overhead game's download doesn't grow.
// Pure data, no Three.js, so tests can read it from disk.

/** One material's worth of a model: a colour name (or "accent"), whether it glows, and its triangles. */
export interface ModelSlot {
  c: string;
  glow?: boolean;
  /** Positions, metres, in the item's frame (x across, y up, z to its front), three per vertex. */
  v: Float32Array;
  /** Normals, three per vertex. */
  n: Float32Array;
  /** Baked shade per vertex (ambient occlusion, 1 is unshaded). */
  shade?: Float32Array;
  /** Its fine texture (an index into the textures, #361), and where on it each vertex is (u, v, tiles across). */
  tex?: number;
  uv?: Float32Array;
  /** Triangles, three vertex indices each, counter-clockwise from outside. */
  i: Uint16Array;
}

/** An item's first-person model: its slots. */
export type Model = ModelSlot[];

/** The fine textures (scripts/textures.mjs): grey tiles, size by size bytes each, one after another in the order of `names`. */
export interface FpTextures {
  size: number;
  names: string[];
  pixels: Uint8Array;
}

export interface FpModels {
  /** firstFetch (#371): bytes, gzipped, that fp.bin may reach when every item has a model. */
  limits: { triangles: { fp: number }; textures: { size: number; count: number }; firstFetch: number };
  textures: FpTextures;
  items: Record<string, Model>;
}

interface SlotHeader {
  c: string;
  glow?: boolean;
  tex?: number;
  /** A textured slot's texture coordinates' range, [u0, v0, u1, v1]. */
  uv?: [number, number, number, number];
  verts: number;
  tris: number;
}

const MAGIC = "DMFP";
const VERSION = 3;

/** An octahedral normal (two signed bytes, #371) back to a unit vector, into `out` at `at`. */
export function unpackNormal(a: number, b: number, out: Float32Array, at: number): void {
  let x = Math.max(-1, a / 127);
  let y = Math.max(-1, b / 127);
  const z = 1 - Math.abs(x) - Math.abs(y);
  if (z < 0) [x, y] = [(1 - Math.abs(y)) * (x < 0 ? -1 : 1), (1 - Math.abs(x)) * (y < 0 ? -1 : 1)];
  const l = Math.hypot(x, y, z) || 1;
  out[at] = x / l;
  out[at + 1] = y / l;
  out[at + 2] = z / l;
}

/** fp.bin's bytes as models. Throws if they aren't an fp.bin this game reads. */
export function parseFpModels(buf: ArrayBuffer): FpModels {
  const view = new DataView(buf);
  const magic = String.fromCharCode(...new Uint8Array(buf, 0, 4));
  if (magic !== MAGIC) throw new Error("fp.bin: not a furniture models file");
  const version = view.getUint32(4, true);
  if (version !== VERSION) throw new Error(`fp.bin: version ${version}, expected ${VERSION}`);
  const len = view.getUint32(8, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 12, len))) as {
    limits: FpModels["limits"];
    textures: { size: number; names: string[] };
    items: Record<string, { box: number[]; slots: SlotHeader[] }>;
  };
  // The streams' starts (the format is in scripts/models.mjs): textures, positions, normals, shade, uv, triangles.
  const t = header.textures;
  const slots = Object.values(header.items).flatMap((it) => it.slots);
  const verts = slots.reduce((n, s) => n + s.verts, 0);
  const uvVerts = slots.reduce((n, s) => n + (s.uv ? s.verts : 0), 0);
  let pos = 12 + len;
  const textures: FpTextures = { size: t.size, names: t.names, pixels: new Uint8Array(buf, pos, t.names.length * t.size * t.size) };
  pos += textures.pixels.length;
  let nrm = pos + verts * 6;
  let shade = nrm + verts * 2;
  let uv = shade + verts;
  let tri = uv + uvVerts * 4;
  const bytes = new Uint8Array(buf);
  const items: Record<string, Model> = {};
  for (const [id, { box, slots }] of Object.entries(header.items)) {
    const scale = [0, 1, 2].map((a) => (box[3 + a]! - box[a]!) / 65535);
    items[id] = slots.map((s) => {
      const v = new Float32Array(s.verts * 3);
      for (let k = 0; k < v.length; k++, pos += 2) v[k] = box[k % 3]! + view.getUint16(pos, true) * scale[k % 3]!;
      const n = new Float32Array(s.verts * 3);
      for (let k = 0; k < s.verts; k++, nrm += 2) unpackNormal(view.getInt8(nrm), view.getInt8(nrm + 1), n, k * 3);
      const i = new Uint16Array(s.tris * 3);
      for (let k = 0, next = 0; k < i.length; k++) {
        const b = bytes[tri++]!;
        const at = b < 255 ? next - b : view.getUint16(tri, true);
        if (b === 255) tri += 2;
        i[k] = at;
        next = Math.max(next, at + 1);
      }
      const slot: ModelSlot = { c: s.c, v, n, i, shade: Float32Array.from(bytes.subarray(shade, shade + s.verts), (x) => x / 255) };
      shade += s.verts;
      if (s.glow) slot.glow = true;
      if (s.uv) {
        const [u0, v0, u1, v1] = s.uv;
        const coords = new Float32Array(s.verts * 2);
        for (let k = 0; k < coords.length; k++, uv += 2) coords[k] = k % 2 ? v0 + view.getUint16(uv, true) * ((v1 - v0) / 65535) : u0 + view.getUint16(uv, true) * ((u1 - u0) / 65535);
        if (s.tex !== undefined) {
          slot.tex = s.tex;
          slot.uv = coords;
        }
      }
      return slot;
    });
  }
  if (tri !== buf.byteLength) throw new Error(`fp.bin: ${buf.byteLength - tri} bytes left over`);
  return { limits: header.limits, textures, items };
}

let models: FpModels | null = null;
let loading: Promise<boolean> | null = null;

/** Use these models (tests read fp.bin from disk; the game fetches it with loadFpModels). */
export function setFpModels(m: FpModels | null): void {
  models = m;
}

/**
 * Fetch fp.bin, once (later calls get the same promise). Resolves true once the models are in,
 * false if they couldn't be had (first person then draws the code-built parts).
 */
export function loadFpModels(url: string): Promise<boolean> {
  loading ??= fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`${url}: ${r.status}`);
      return r.arrayBuffer();
    })
    .then((buf) => {
      models = parseFpModels(buf);
      return true;
    })
    .catch((e: unknown) => {
      console.warn("First-person furniture models didn't load; drawing the code-built parts.", e);
      return false;
    });
  return loading;
}

/** Whether the first-person models are in. */
export function fpLoaded(): boolean {
  return models !== null;
}

/** Whether models are drawn (dev: `__stage3d.models(false)` compares with the code-built items). */
let enabled = true;

/** Dev only: one model drawn for every item, to measure what models everywhere would cost (`__stage3d.models(true, "bunk_bed")`). */
let everywhere: string | null = null;

export function setModelsEnabled(on: boolean, stress: string | null = null): void {
  enabled = on;
  everywhere = stress;
}

/** What's drawn now, for caches of built furniture: changes when models are switched (dev). */
export function modelsKey(): string {
  return enabled ? (everywhere ?? "m") : "";
}

/** An item's first-person model, if it has one, they're loaded and models are on. */
export function fpModelFor(item: string): Model | undefined {
  if (!enabled || !models) return undefined;
  return models.items[everywhere ?? item];
}

/** The items with a first-person model (none until they're loaded). */
export function modelIds(): string[] {
  return models ? Object.keys(models.items) : [];
}

export function modelLimits(): FpModels["limits"] | undefined {
  return models?.limits;
}

/** The models' fine textures, once loaded. */
export function fpTextures(): FpTextures | undefined {
  return models?.textures;
}

/** A slot's longest side, metres (for whether a glowing slot blinks, as a part's extent). */
export function slotExtent(slot: ModelSlot): number {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let k = 0; k < slot.v.length; k++) {
    const a = k % 3;
    lo[a] = Math.min(lo[a]!, slot.v[k]!);
    hi[a] = Math.max(hi[a]!, slot.v[k]!);
  }
  return Math.max(hi[0]! - lo[0]!, hi[1]! - lo[1]!, hi[2]! - lo[2]!);
}
