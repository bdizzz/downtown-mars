// Furniture models made in Blender (#357), drawn only in first person (#360): packs every
// models/<item>.glb into public/models/fp.bin, which the web (view/models.ts) fetches the first
// time you go into first person, and Godot (Furniture.cs) reads the same way. Every other view
// draws items from their code-built parts (data/furniture.json).
//
//   node scripts/models.mjs            convert the committed .glb files (no Blender needed)
//   node scripts/models.mjs --export   first run every models/*.py in Blender (blender -b), then convert
//
// A .glb holds one object, `<item>`. Each material is a colour name from data/furniture.json
// ("accent" for the room's colour), with a `glow` extra for glowing parts; COLOR_0 is the baked
// shade (ambient occlusion). See models/kit.py and docs/FURNITURE.md.
//
// fp.bin: "DMFP", a version (u32), the header's length in bytes (u32), the header (JSON, padded with
// spaces to 4 bytes), then the arrays. The header is { limits, items: { <item>: [slot, ...] } }, each
// slot { c, glow?, verts, tris, v, n, shade?, i }, where v, n, shade and i are byte offsets into the
// arrays (which start after the header): positions and normals float32 xyz per vertex, shade uint8
// per vertex (255 unshaded), triangles uint16 vertex indices, three each. Little-endian, each array
// starting on 4 bytes.

import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "models");
const furniture = JSON.parse(readFileSync(join(root, "data/furniture.json"), "utf8"));
/** The limit per item: about 800 triangles in first person (#359). */
const LIMITS = { triangles: { fp: 800 } };
const VERSION = 1;

if (process.argv.includes("--export")) {
  const blender = process.env.BLENDER ?? "blender";
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".py") && f !== "kit.py").sort()) {
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
    const c = mat.name.replace(/\+glow$/, "").replace(/\.\d+$/, "");
    if (c !== "accent" && !(c in furniture.colors)) throw new Error(`${item}: material "${mat.name}" isn't a colour in data/furniture.json`);
    const v = read(glb, prim.attributes.POSITION);
    if (v.length / 3 > 65535) throw new Error(`${item}: more than 65535 vertices in one colour`);
    const slot = { c, glow: !!mat.extras?.glow, v, n: read(glb, prim.attributes.NORMAL) };
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

// The arrays, each on 4 bytes, and the header pointing into them.
const chunks = [];
let size = 0;
const put = (typed) => {
  const at = size;
  const padded = new Uint8Array(Math.ceil(typed.byteLength / 4) * 4);
  padded.set(new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength));
  chunks.push(padded);
  size += padded.length;
  return at;
};
const header = { about: "Generated by scripts/models.mjs from models/*.glb (#360). Don't edit by hand.", limits: LIMITS, items: {} };
for (const [item, model] of Object.entries(items)) {
  header.items[item] = model.map((s) => {
    const out = { c: s.c };
    if (s.glow) out.glow = true;
    out.verts = s.v.length / 3;
    out.tris = s.i.length / 3;
    out.v = put(Float32Array.from(s.v));
    out.n = put(Float32Array.from(s.n));
    if (s.shade) out.shade = put(Uint8Array.from(s.shade, (x) => Math.round(Math.min(1, Math.max(0, x)) * 255)));
    out.i = put(Uint16Array.from(s.i));
    return out;
  });
}
let json = JSON.stringify(header);
json += " ".repeat((4 - (Buffer.byteLength(json) % 4)) % 4);
const head = Buffer.alloc(12);
head.write("DMFP", 0, "ascii");
head.writeUInt32LE(VERSION, 4);
head.writeUInt32LE(Buffer.byteLength(json), 8);
const out = Buffer.concat([head, Buffer.from(json), ...chunks]);
mkdirSync(join(root, "public/models"), { recursive: true });
writeFileSync(join(root, "public/models/fp.bin"), out);
console.log(`public/models/fp.bin: ${Object.keys(items).length} models, ${(out.length / 1024).toFixed(1)} KB`);
