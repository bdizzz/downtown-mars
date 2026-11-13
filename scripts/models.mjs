// Furniture models made in Blender (#357), drawn only in first person (#360): packs every
// models/<item>.glb into public/models/fp.bin, which the web (view/models.ts) fetches the first
// time you go into first person, and Godot (Furniture.cs) reads the same way. Every other view
// draws items from their code-built parts (data/furniture.json).
//
//   node scripts/models.mjs            convert the committed .glb files (no Blender needed)
//   node scripts/models.mjs --export   first run every models/*.py in Blender (blender -b), then convert
//
// A .glb holds one object, `<item>`. Each material is a colour name from data/furniture.json
// ("accent" for the room's colour), then "+glow" for glowing parts and "@<texture>" for a fine
// texture from scripts/textures.mjs (as "cushion@fabric"); COLOR_0 is the baked shade (ambient
// occlusion), TEXCOORD_0 the texture's coordinates. See models/kit.py and docs/FURNITURE.md.
//
// fp.bin, version 3 (packed tight in #371): "DMFP", a version (u32), the header's length in bytes
// (u32), the header (JSON, padded with spaces to 4 bytes), then the arrays, one after another with no
// gaps. The header is { limits, textures, items: { <item>: { box, slots: [slot, ...] } } }. `textures`
// is { size, names }: the tiles come first in the arrays, size by size bytes each (0–255 grey, rows
// top down), in the order of `names`. Five streams follow, one after another, each holding every
// slot's values in turn (items in header order, their slots in order):
//   positions  uint16 xyz per vertex, 0–65535 across the item's box [x0, y0, z0, x1, y1, z1] (metres)
//   normals    int8 x2 per vertex, octahedral (±127 is ±1)
//   shade      uint8 per vertex, the baked ambient occlusion (255 unshaded)
//   uv         textured slots only: uint16 x2 per vertex, 0–65535 across the slot's uv [u0, v0, u1, v1]
//   triangles  three corners each, a corner one byte b < 255, the vertex b back from `next`, or 255
//              then the vertex's index as uint16; `next` starts at 0 for each slot and is one past
//              the highest vertex used so far
// Each slot is { c, glow?, tex?, verts, tris, uv? }; tex is the texture's index. Little-endian, no
// padding. Read by view/models.ts (parseFpModels) and godot/src/Furniture.cs (LoadFp).

import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { projectFirstFetch } from "./fpsize.mjs";
import { TEXTURE_NAMES, TEXTURE_SIZE, texturePixels } from "./textures.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "models");
const furniture = JSON.parse(readFileSync(join(root, "data/furniture.json"), "utf8"));
/**
 * The limits (#362): about 800 triangles per item in first person (#359), and the shared textures at
 * most 16 tiles of 128 by 128 (256 KB in all). The benchmark in docs/FURNITURE.md drew a near-limit
 * model for every item and found no cost in frames, web or Godot; download size is what to watch.
 * `firstFetch` (#371): fp.bin gzipped, projected to a model for every item in data/furniture.json at
 * today's average size, stays under 3 MB (raised from 1 MB in #391, when the models became the default everywhere and a setting to opt out; also checked by tests/models.test.ts).
 */
const LIMITS = { triangles: { fp: 800 }, textures: { size: 128, count: 16 }, firstFetch: 3_000_000 };
const VERSION = 3;

if (process.argv.includes("--export")) {
  const blender = process.env.BLENDER ?? "blender";
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".py") && f !== "kit.py" && !f.startsWith("_")).sort()) {
    const out = execFileSync(blender, ["-b", "--factory-startup", "-P", join(dir, f)], { encoding: "utf8" });
    for (const line of out.split("\n")) if (line.startsWith("MODEL")) console.log(line);
  }
}

const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const ARRAYS = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const NORMALISE = { 5121: 255, 5123: 65535 };

/** A .glb's JSON and binary chunk. */
function readGlb(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${path}: not a .glb`);
  let at = 12;
  let json;
  let bin;
  while (at < buf.length) {
    const len = buf.readUInt32LE(at);
    const type = buf.readUInt32LE(at + 4);
    const chunk = buf.subarray(at + 8, at + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString("utf8"));
    else if (type === 0x004e4942) bin = chunk;
    at += 8 + len;
  }
  return { json, bin };
}

/** An accessor's values as plain numbers (normalised integers to 0–1). */
function read({ json, bin }, index) {
  const acc = json.accessors[index];
  const view = json.bufferViews[acc.bufferView];
  const Type = ARRAYS[acc.componentType];
  const n = COMPONENTS[acc.type];
  const start = (view.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const stride = view.byteStride ?? n * Type.BYTES_PER_ELEMENT;
  const out = [];
  const data = new DataView(bin.buffer, bin.byteOffset);
  for (let i = 0; i < acc.count; i++) {
    for (let k = 0; k < n; k++) {
      const off = start + i * stride + k * Type.BYTES_PER_ELEMENT;
      let v;
      if (Type === Float32Array) v = data.getFloat32(off, true);
      else if (Type === Uint16Array) v = data.getUint16(off, true);
      else if (Type === Uint32Array) v = data.getUint32(off, true);
      else if (Type === Uint8Array) v = data.getUint8(off);
      else throw new Error(`unsupported component type ${acc.componentType}`);
      out.push(acc.normalized && NORMALISE[acc.componentType] ? v / NORMALISE[acc.componentType] : v);
    }
  }
  return out;
}

/** One mesh's primitives as slots: a colour, whether it glows, and its triangles. */
function slots(glb, mesh, item) {
  return mesh.primitives.map((prim) => {
    const mat = glb.json.materials[prim.material];
    const name = /^([A-Za-z_]+)(\+glow)?(?:@([a-z_]+))?(?:\.\d+)?$/.exec(mat.name);
    if (!name) throw new Error(`${item}: material "${mat.name}" should be <colour>[+glow][@texture]`);
    const [, c, glowing, tex] = name;
    if (c !== "accent" && !(c in furniture.colors)) throw new Error(`${item}: material "${mat.name}" isn't a colour in data/furniture.json`);
    if (tex && !TEXTURE_NAMES.includes(tex)) throw new Error(`${item}: material "${mat.name}": no texture "${tex}" in scripts/textures.mjs`);
    const v = read(glb, prim.attributes.POSITION);
    if (v.length / 3 > 65535) throw new Error(`${item}: more than 65535 vertices in one colour`);
    const slot = { c, glow: !!(glowing || mat.extras?.glow), v, n: read(glb, prim.attributes.NORMAL) };
    if (tex) {
      if (prim.attributes.TEXCOORD_0 === undefined) throw new Error(`${item}: "${mat.name}" has a texture but no texture coordinates`);
      slot.tex = TEXTURE_NAMES.indexOf(tex);
      slot.uv = read(glb, prim.attributes.TEXCOORD_0);
    }
    if (prim.attributes.COLOR_0 !== undefined) {
      const k = COMPONENTS[glb.json.accessors[prim.attributes.COLOR_0].type];
      const rgba = read(glb, prim.attributes.COLOR_0);
      slot.shade = Array.from({ length: v.length / 3 }, (_, i) => rgba[i * k]);
    }
    slot.i = prim.indices !== undefined ? read(glb, prim.indices) : Array.from({ length: v.length / 3 }, (_, i) => i);
    return slot;
  });
}

const items = {};
for (const f of readdirSync(dir).filter((f) => f.endsWith(".glb")).sort()) {
  const item = f.replace(/\.glb$/, "");
  if (!furniture.items[item]) throw new Error(`models/${f}: no item "${item}" in data/furniture.json`);
  const glb = readGlb(join(dir, f));
  const nodes = glb.json.nodes.filter((node) => node.mesh !== undefined);
  if (nodes.length !== 1 || nodes[0].name !== item) throw new Error(`models/${f}: should hold one object, "${item}" (found ${nodes.map((n) => n.name).join(", ")})`);
  const [node] = nodes;
  if (node.translation || node.rotation || node.scale) throw new Error(`models/${f}: apply "${node.name}"'s transform before exporting`);
  const model = slots(glb, glb.json.meshes[node.mesh], item);
  const tris = model.reduce((n, s) => n + s.i.length / 3, 0);
  const limit = LIMITS.triangles.fp;
  console.log(`${item}: ${tris} triangles (limit ${limit})${tris > limit ? "  OVER" : ""}`);
  if (tris > limit) process.exitCode = 1;
  items[item] = model;
}

// The arrays, packed one after another (the format is at the top).
const chunks = [];
const put = (typed) => chunks.push(new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength));
if (TEXTURE_SIZE > LIMITS.textures.size) throw new Error(`scripts/textures.mjs: tiles of ${TEXTURE_SIZE} px, over the limit of ${LIMITS.textures.size}`);
if (TEXTURE_NAMES.length > LIMITS.textures.count) throw new Error(`scripts/textures.mjs: ${TEXTURE_NAMES.length} textures, over the limit of ${LIMITS.textures.count}`);
const header = { about: "Generated by scripts/models.mjs from models/*.glb (#360, #361, #371). Don't edit by hand.", limits: LIMITS, textures: {}, items: {} };
const textures = new Uint8Array(TEXTURE_NAMES.length * TEXTURE_SIZE * TEXTURE_SIZE);
TEXTURE_NAMES.forEach((name, k) => textures.set(texturePixels(name), k * TEXTURE_SIZE * TEXTURE_SIZE));
header.textures = { size: TEXTURE_SIZE, names: TEXTURE_NAMES };
put(textures);

/** 0–65535 across [lo, hi]. */
const quantise = (x, lo, hi) => (hi > lo ? Math.round(((x - lo) / (hi - lo)) * 65535) : 0);
/** A unit normal as two signed bytes, octahedral. */
function octahedral(x, y, z) {
  const l = Math.abs(x) + Math.abs(y) + Math.abs(z) || 1;
  let u = x / l;
  let v = y / l;
  if (z < 0) [u, v] = [(1 - Math.abs(v)) * (u < 0 ? -1 : 1), (1 - Math.abs(u)) * (v < 0 ? -1 : 1)];
  return [Math.round(u * 127), Math.round(v * 127)];
}
/** The lowest and highest of every `n`th value from `a`, as float32 (what the header's JSON gives the readers back). */
const range = (values, n, a) => {
  let lo = Infinity;
  let hi = -Infinity;
  for (let k = a; k < values.length; k += n) (lo = Math.min(lo, values[k])), (hi = Math.max(hi, values[k]));
  return [Math.fround(lo), Math.fround(hi)];
};

// Each stream gathers every slot's values, in order, and they go out one after another: like
// values sit together and compress better than slot by slot.
const streams = { v: [], n: [], shade: [], uv: [], i: [] };
for (const [item, model] of Object.entries(items)) {
  const all = model.flatMap((s) => s.v);
  const [x, y, z] = [0, 1, 2].map((a) => range(all, 3, a));
  const box = [x[0], y[0], z[0], x[1], y[1], z[1]];
  header.items[item] = {
    box,
    slots: model.map((s) => {
      const verts = s.v.length / 3;
      const out = { c: s.c };
      if (s.glow) out.glow = true;
      if (s.tex !== undefined) out.tex = s.tex;
      out.verts = verts;
      out.tris = s.i.length / 3;
      streams.v.push(Uint16Array.from(s.v, (p, k) => quantise(p, box[k % 3], box[3 + (k % 3)])));
      const n = new Int8Array(verts * 2);
      for (let k = 0; k < verts; k++) n.set(octahedral(s.n[k * 3], s.n[k * 3 + 1], s.n[k * 3 + 2]), k * 2);
      streams.n.push(n);
      streams.shade.push(s.shade ? Uint8Array.from(s.shade, (a) => Math.round(Math.min(1, Math.max(0, a)) * 255)) : new Uint8Array(verts).fill(255));
      if (s.uv) {
        const [u, v] = [range(s.uv, 2, 0), range(s.uv, 2, 1)];
        out.uv = [u[0], v[0], u[1], v[1]];
        streams.uv.push(Uint16Array.from(s.uv, (t, k) => quantise(t, out.uv[k % 2], out.uv[2 + (k % 2)])));
      }
      // Corners as steps back from the next unused vertex (Blender mostly numbers vertices in the
      // order its triangles use them), or 255 and the index itself as uint16.
      let next = 0;
      const codes = [];
      for (const k of s.i) {
        const back = next - k;
        if (back >= 0 && back < 255) codes.push(back);
        else codes.push(255, k & 255, k >> 8);
        next = Math.max(next, k + 1);
      }
      streams.i.push(Uint8Array.from(codes));
      return out;
    }),
  };
}
for (const list of Object.values(streams)) for (const typed of list) put(typed);
let json = JSON.stringify(header);
json += " ".repeat((4 - (Buffer.byteLength(json) % 4)) % 4);
const head = Buffer.alloc(12);
head.write("DMFP", 0, "ascii");
head.writeUInt32LE(VERSION, 4);
head.writeUInt32LE(Buffer.byteLength(json), 8);
const out = Buffer.concat([head, Buffer.from(json), ...chunks]);
mkdirSync(join(root, "public/models"), { recursive: true });
writeFileSync(join(root, "public/models/fp.bin"), out);
const count = Object.keys(items).length;
const every = Object.keys(furniture.items).length;
const projected = projectFirstFetch(out, textures.length, count, every);
console.log(`public/models/fp.bin: ${count} models, ${TEXTURE_NAMES.length} textures, ${(out.length / 1024).toFixed(1)} KB (${(gzipSync(out).length / 1024).toFixed(1)} KB gzipped)`);
console.log(`  projected to all ${every} items: ${(projected / 1e6).toFixed(2)} MB gzipped (limit ${LIMITS.firstFetch / 1e6} MB)${projected > LIMITS.firstFetch ? "  OVER" : ""}`);
if (projected > LIMITS.firstFetch) process.exitCode = 1;
