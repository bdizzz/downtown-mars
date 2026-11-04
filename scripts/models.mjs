// Furniture models made in Blender (#357): turns each models/<item>.glb into data/models.json,
// which the web (render3d/furniture3d.ts) and Godot (Furniture.cs) read as they read
// data/furniture.json. An item with a model draws it in place of its code-built parts.
//
//   node scripts/models.mjs            convert the committed .glb files (no Blender needed)
//   node scripts/models.mjs --export   first run every models/*.py in Blender (blender -b), then convert
//
// A .glb holds two objects, `<item>` (near) and `<item>.far`. Each material is a colour name from
// data/furniture.json ("accent" for the room's colour), with a `glow` extra for glowing parts;
// COLOR_0 is the baked shade (ambient occlusion). See models/kit.py and docs/FURNITURE.md.

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "models");
const furniture = JSON.parse(readFileSync(join(root, "data/furniture.json"), "utf8"));
/** The trial's limits per item (#357): near is what first person sees, far is drawn past 55 m. */
const LIMITS = { triangles: { near: 300, far: 60 } };

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

const round = (d) => (v) => Math.round(v * 10 ** d) / 10 ** d;

/** One mesh's primitives as slots: a colour, whether it glows, and its triangles. */
function slots(glb, mesh, item, lod) {
  return mesh.primitives.map((prim) => {
    const mat = glb.json.materials[prim.material];
    const c = mat.name.replace(/\+glow$/, "").replace(/\.\d+$/, "");
    if (c !== "accent" && !(c in furniture.colors)) throw new Error(`${item} ${lod}: material "${mat.name}" isn't a colour in data/furniture.json`);
    const v = read(glb, prim.attributes.POSITION).map(round(4));
    const n = read(glb, prim.attributes.NORMAL).map(round(3));
    const slot = { c };
    if (mat.extras?.glow) slot.glow = true;
    slot.v = v;
    slot.n = n;
    if (prim.attributes.COLOR_0 !== undefined) {
      const k = COMPONENTS[glb.json.accessors[prim.attributes.COLOR_0].type];
      const rgba = read(glb, prim.attributes.COLOR_0);
      slot.shade = Array.from({ length: v.length / 3 }, (_, i) => round(2)(rgba[i * k]));
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
  const model = {};
  for (const node of glb.json.nodes) {
    if (node.mesh === undefined) continue;
    const lod = node.name === item ? "near" : node.name === `${item}.far` ? "far" : null;
    if (!lod) throw new Error(`models/${f}: object "${node.name}" should be "${item}" or "${item}.far"`);
    if (node.translation || node.rotation || node.scale) throw new Error(`models/${f}: apply "${node.name}"'s transform before exporting`);
    model[lod] = slots(glb, glb.json.meshes[node.mesh], item, lod);
  }
  for (const lod of ["near", "far"]) {
    if (!model[lod]) throw new Error(`models/${f}: no ${lod} object`);
    const tris = model[lod].reduce((n, s) => n + s.i.length / 3, 0);
    const limit = LIMITS.triangles[lod];
    console.log(`${item} ${lod}: ${tris} triangles (limit ${limit})${tris > limit ? "  OVER" : ""}`);
    if (tris > limit) process.exitCode = 1;
  }
  items[item] = model;
}

const out = { about: "Generated by scripts/models.mjs from models/*.glb (#357). Don't edit by hand.", limits: LIMITS, items };
writeFileSync(join(root, "data/models.json"), JSON.stringify(out) + "\n");
console.log(`data/models.json: ${Object.keys(items).length} models, ${(JSON.stringify(out).length / 1024).toFixed(1)} KB`);
