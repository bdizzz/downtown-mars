// The fine textures of the first-person furniture models (#361): small grey tiles, made here by
// code so they're reproducible, packed into public/models/fp.bin by scripts/models.mjs. A model's
// material names one ("cushion@fabric", see models/kit.py). Each is detail only: grey around 0.5,
// which the game doubles and multiplies into the part's own colour, so the named colours and the
// room's accent still set the palette. Every tile wraps seamlessly.
//
//   node scripts/textures.mjs   writes models/textures.png, a contact sheet to look at (not used by the game)

import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

/** Pixels per side of each tile. */
export const TEXTURE_SIZE = 128;

/** A seeded hash of integer lattice points, 0–1. */
function hash(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Value noise that wraps every `period` cells (or `pu` across and `pv` down): u, v in 0–1 across the tile. */
function noise(u, v, period, seed, pv = period) {
  const pu = period;
  const x = u * pu;
  const y = v * pv;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const at = (i, j) => hash(((i % pu) + pu) % pu, ((j % pv) + pv) % pv, seed);
  const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
  const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
  return a + (b - a) * sy;
}

const TAU = Math.PI * 2;
const clamp = (v) => Math.min(1, Math.max(0, v));

/**
 * The textures, by name: each a function of u, v (0–1 across the tile) giving a grey, 0–1, kept
 * near 0.5 on average. The order is their index in fp.bin; add new ones at the end.
 */
export const TEXTURES = {
  // Woven threads, over and under, a little uneven: upholstery, curtains, blankets.
  fabric: (u, v) => {
    const n = 16;
    const warp = Math.sin(u * n * TAU) * 0.5 + 0.5;
    const weft = Math.sin(v * n * TAU) * 0.5 + 0.5;
    const over = (Math.floor(u * n * 2) + Math.floor(v * n * 2)) % 2 === 0;
    const thread = over ? 0.35 + 0.35 * weft : 0.35 + 0.35 * warp;
    return 0.38 + thread * 0.25 + (noise(u, v, 32, 1) - 0.5) * 0.1;
  },
  // Quilted: stitched diamonds puffing up between the seams: mattresses, padded panels.
  quilt: (u, v) => {
    const a = ((u + v) * 4) % 1;
    const b = ((u - v + 1) * 4) % 1;
    const puff = Math.sin(a * Math.PI) * Math.sin(b * Math.PI);
    const seam = Math.min(a, 1 - a, b, 1 - b) < 0.03 ? -0.18 : 0;
    return 0.42 + puff * 0.16 + seam + (noise(u, v, 16, 2) - 0.5) * 0.06;
  },
  // Brushed metal: fine streaks along u: steel, machine covers, rails.
  brushed: (u, v) => 0.5 + (noise(u, v, 8, 3, 64) - 0.5) * 0.12 + (noise(u, v, 2, 4, 128) - 0.5) * 0.18,
  // Perforated: a grid of round holes: vents, speaker grilles, guards.
  perforated: (u, v) => {
    const n = 8;
    const du = ((u * n) % 1) - 0.5;
    const dv = ((v * n) % 1) - 0.5;
    const d = Math.hypot(du, dv);
    return d < 0.28 ? 0.18 + d * 0.6 : 0.58;
  },
  // Tread plate: raised diagonal lozenges on a flat ground: steps, machine bases, floors.
  tread: (u, v) => {
    const n = 4;
    const cu = (u * n) % 1;
    const cv = (v * n) % 1;
    const flip = (Math.floor(u * n) + Math.floor(v * n)) % 2 === 0;
    const a = flip ? cu - cv : cu + cv - 1;
    const raised = Math.abs(a) < 0.08 && Math.abs((flip ? cu + cv - 1 : cu - cv)) < 0.32;
    return (raised ? 0.66 : 0.46) + (noise(u, v, 32, 5) - 0.5) * 0.06;
  },
  // Grain: a fine speckle and mottle: fibre composite, moulded plastic, painted panels.
  grain: (u, v) => 0.5 + (noise(u, v, 8, 6) - 0.5) * 0.12 + (hash(Math.floor(u * TEXTURE_SIZE), Math.floor(v * TEXTURE_SIZE), 7) - 0.5) * 0.1,
};

export const TEXTURE_NAMES = Object.keys(TEXTURES);

/** One texture's tile as bytes, row by row (v down), 0–255. */
export function texturePixels(name, size = TEXTURE_SIZE) {
  const f = TEXTURES[name];
  if (!f) throw new Error(`no texture "${name}" (scripts/textures.mjs has ${TEXTURE_NAMES.join(", ")})`);
  const out = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) out[y * size + x] = Math.round(clamp(f((x + 0.5) / size, (y + 0.5) / size)) * 255);
  return out;
}

/** A greyscale PNG of some rows of bytes. */
function png(width, height, rows) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // greyscale
  const raw = Buffer.concat(rows.map((r) => Buffer.concat([Buffer.from([0]), Buffer.from(r)])));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // The contact sheet: each texture tiled twice across, side by side.
  const size = TEXTURE_SIZE;
  const tiles = TEXTURE_NAMES.map((n) => texturePixels(n));
  const width = tiles.length * size * 2;
  const rows = [];
  for (let y = 0; y < size * 2; y++) {
    const row = new Uint8Array(width);
    tiles.forEach((t, i) => {
      for (let x = 0; x < size * 2; x++) row[i * size * 2 + x] = t[(y % size) * size + (x % size)];
    });
    rows.push(row);
  }
  const out = new URL("../models/textures.png", import.meta.url);
  writeFileSync(out, png(width, size * 2, rows));
  console.log(`models/textures.png: ${TEXTURE_NAMES.join(", ")}`);
}
