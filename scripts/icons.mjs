// Draw the web app's icons into public/icons/: the borehole seen from above,
// a dark shaft with the drill's warm light at the bottom, two rings of rooms
// in their category colours around it, the gallery tube glowing along the
// shaft wall, all set in the Mars surface. Run `node scripts/icons.mjs` after
// changing the drawing; the PNGs are checked in. No dependencies: each pixel
// is supersampled and the PNG is written with node's zlib.
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// Colours from docs/ART.md.
const ground = hex("#7a3b22");
const rock = hex("#2a1510");
const shaft = hex("#120a14");
const accent = hex("#e07a3f");
const glass = hex("#9fd2ff");
// Housing, food, water, air, health, admin, power, public, services: a lived-in hole.
const rooms = ["#6f93bd", "#86ad58", "#4f9fc8", "#8cc8cf", "#d48092", "#c9a456", "#e0bf4a", "#d9a870", "#5aa89c"].map(hex);

/** Small deterministic hash in [0, 1), for the ground's speckle and the room colours. */
function hash(a, b) {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** One ring of rooms between radii r0 and r1, n slots, with rock seams between them. */
function ring(c, a, r0, r1, n, seed) {
  const slot = ((a / (2 * Math.PI)) * n + n) % n;
  const i = Math.floor(slot);
  const seam = (0.02 * n) / (2 * Math.PI * c); // half a seam, the same width at every radius
  if (slot - i < seam || i + 1 - slot < seam || c < r0 + 0.02 || c > r1 - 0.02) return rock;
  const base = rooms[Math.floor(hash(i + 1, seed) * rooms.length)];
  // Lit from the shaft side: a little brighter toward the inner wall.
  return mix(base, rock, 0.12 + 0.3 * ((c - r0) / (r1 - r0)));
}

/** Colour at (x, y), each in [-1, 1], with the borehole's rim at radius `scale`. */
function colour(x, y, scale) {
  const c = Math.hypot(x, y) / scale;
  const a = Math.atan2(y, x) + Math.PI / 2;
  if (c > 1) {
    const speck = hash(Math.floor((x + 1) * 90), Math.floor((y + 1) * 90));
    return mix(mix(ground, rock, 0.35 + 0.15 * speck), rock, Math.min(1, (c - 1) * 0.5));
  }
  if (c > 0.93) return mix(accent, rock, 0.15); // the hole's rim
  if (c > 0.64) return ring(c, a, 0.64, 0.93, 16, 2);
  if (c > 0.4) return ring(c, a, 0.4, 0.64, 9, 1);
  if (c > 0.36) return mix(glass, shaft, 0.25); // gallery tube
  // The shaft: dark, with the drill's light glowing at the bottom.
  const glow = Math.max(0, 1 - c / 0.22);
  return mix(mix(rock, shaft, Math.min(1, (0.36 - c) / 0.12)), accent, glow * glow);
}

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** An opaque square PNG, size × size, the rim at `scale` of the half-width. */
function png(size, scale) {
  const ss = 4;
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let py = 0; py < size; py++) {
    raw[py * (size * 3 + 1)] = 0; // filter: none
    for (let px = 0; px < size; px++) {
      const sum = [0, 0, 0];
      for (let sy = 0; sy < ss; sy++)
        for (let sx = 0; sx < ss; sx++) {
          const col = colour(((px + (sx + 0.5) / ss) / size) * 2 - 1, ((py + (sy + 0.5) / ss) / size) * 2 - 1, scale);
          for (let k = 0; k < 3; k++) sum[k] += col[k];
        }
      for (let k = 0; k < 3; k++) raw[py * (size * 3 + 1) + 1 + px * 3 + k] = Math.round(sum[k] / (ss * ss));
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

const dir = new URL("../public/icons/", import.meta.url);
mkdirSync(dir, { recursive: true });
// Plain icons fill most of the square; maskable ones keep the hole inside the
// central 80% circle that every launcher mask leaves visible. iOS rounds the
// apple-touch-icon's corners itself and wants it opaque, as all of these are.
const icons = [
  ["icon-192.png", 192, 0.9],
  ["icon-512.png", 512, 0.9],
  ["maskable-512.png", 512, 0.72],
  ["apple-touch-icon.png", 180, 0.8],
  ["favicon-32.png", 32, 0.98],
];
for (const [name, size, scale] of icons) {
  writeFileSync(new URL(name, dir), png(size, scale));
  console.log(`public/icons/${name}`);
}
