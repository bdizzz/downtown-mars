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
  limits: { triangles: { fp: number }; textures: { size: number; count: number } };
  textures: FpTextures;
  items: Record<string, Model>;
}

interface SlotHeader {
  c: string;
  glow?: boolean;
  tex?: number;
  uv?: number;
  verts: number;
  tris: number;
  v: number;
  n: number;
  shade?: number;
  i: number;
}

const MAGIC = "DMFP";
const VERSION = 2;

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
    textures: { size: number; names: string[]; at: number };
    items: Record<string, SlotHeader[]>;
  };
  const base = 12 + len;
  const t = header.textures;
  const textures: FpTextures = { size: t.size, names: t.names, pixels: new Uint8Array(buf, base + t.at, t.names.length * t.size * t.size) };
  const items: Record<string, Model> = {};
  for (const [id, slots] of Object.entries(header.items)) {
    items[id] = slots.map((s) => {
      const slot: ModelSlot = {
        c: s.c,
        v: new Float32Array(buf, base + s.v, s.verts * 3),
        n: new Float32Array(buf, base + s.n, s.verts * 3),
        i: new Uint16Array(buf, base + s.i, s.tris * 3),
      };
      if (s.glow) slot.glow = true;
      if (s.shade !== undefined) slot.shade = Float32Array.from(new Uint8Array(buf, base + s.shade, s.verts), (x) => x / 255);
      if (s.tex !== undefined && s.uv !== undefined) {
        slot.tex = s.tex;
        slot.uv = new Float32Array(buf, base + s.uv, s.verts * 2);
      }
      return slot;
    });
  }
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
