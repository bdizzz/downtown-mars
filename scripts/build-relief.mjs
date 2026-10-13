// Build data/mars-relief.jpg, the shaded relief the map draws (the web's map screen and the Godot
// viewer's globe), from NASA's MOLA MEGDR 16 px/degree grid (MEGT90N000EB.IMG from the PDS
// Geosciences Node, public domain):
// (https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg016/megt90n000eb.img, not kept in the repo)
//
//   node scripts/build-relief.mjs path/to/megt90n000eb.img
//
// The source is 5760 × 2880 big-endian int16 metres, simple cylindrical, rows from 90°N south,
// columns from 0°E east. We average 2 × 2 blocks to 2880 × 1440 (8 px a degree), colour each by
// height, light it from the north-west and whiten the polar caps, then save it as a JPEG (macOS's
// sips does the encoding). The game itself (deposits, site reports) uses the 1° grid in
// data/mars-elevation.json (scripts/build-elevation.mjs); this is only for looking at.
import { execFileSync } from "node:child_process";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const SRC_W = 5760;
const SRC_H = 2880;
const FACTOR = 2;
const OUT = "data/mars-relief.jpg";
const QUALITY = 86;

// The height colours and the polar caps live in data/mars-map.json, which the game reads too (a site's
// soil is the map's colour there, unlit; holes can't go on the caps).
const MAP = JSON.parse(readFileSync("data/mars-map.json", "utf8"));
const RAMP = MAP.ramp.stops;
/** Lighting: the height difference across a cell's diagonal neighbours that lifts it by one; the shade's limits. */
const SHADE_PER_M = 1 / 900;
const SHADE_MIN = 0.55;
const SHADE_MAX = 1.35;
const CAP = MAP.caps;

function ramp(e) {
  for (let i = 1; i < RAMP.length; i++) {
    const [e1, c1] = RAMP[i];
    const [e0, c0] = RAMP[i - 1];
    if (e <= e1) {
      const t = Math.max(0, (e - e0) / (e1 - e0));
      return [c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t];
    }
  }
  return RAMP[RAMP.length - 1][1];
}

const path = process.argv[2];
if (!path) {
  console.error("Usage: node scripts/build-relief.mjs path/to/megt90n000eb.img");
  process.exit(1);
}
const buf = readFileSync(path);
if (buf.length !== SRC_W * SRC_H * 2) {
  console.error(`Expected ${SRC_W * SRC_H * 2} bytes, got ${buf.length}`);
  process.exit(1);
}

const w = SRC_W / FACTOR;
const h = SRC_H / FACTOR;
const elev = new Float32Array(w * h);
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let dy = 0; dy < FACTOR; dy++) for (let dx = 0; dx < FACTOR; dx++) sum += buf.readInt16BE(((y * FACTOR + dy) * SRC_W + x * FACTOR + dx) * 2);
    elev[y * w + x] = sum / (FACTOR * FACTOR);
  }
}
const at = (x, y) => elev[Math.min(h - 1, Math.max(0, y)) * w + (((x % w) + w) % w)];

// PNG rows: a filter byte (none), then RGB.
const raw = Buffer.alloc(h * (1 + w * 3));
for (let y = 0; y < h; y++) {
  const lat = 90 - ((y + 0.5) * 180) / h;
  const row = y * (1 + w * 3);
  for (let x = 0; x < w; x++) {
    const shade = Math.min(SHADE_MAX, Math.max(SHADE_MIN, 1 + (at(x - 1, y - 1) - at(x + 1, y + 1)) * SHADE_PER_M));
    let [r, g, b] = ramp(at(x, y));
    const cap = Math.min(1, Math.max(0, (Math.abs(lat) - (lat > 0 ? CAP.north : CAP.south)) / CAP.fade));
    if (cap > 0) [r, g, b] = [r + (CAP.color[0] - r) * cap, g + (CAP.color[1] - g) * cap, b + (CAP.color[2] - b) * cap];
    const i = row + 1 + x * 3;
    raw[i] = Math.min(255, Math.round(r * shade));
    raw[i + 1] = Math.min(255, Math.round(g * shade));
    raw[i + 2] = Math.min(255, Math.round(b * shade));
  }
}

// A plain PNG (IHDR, IDAT, IEND), then sips makes the JPEG.
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (b) => {
  let c = 0xffffffff;
  for (const v of b) c = crcTable[(c ^ v) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, sum]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(w, 0);
ihdr.writeUInt32BE(h, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // RGB
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
const tmp = OUT.replace(/\.jpg$/, ".tmp.png");
writeFileSync(tmp, png);
execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", String(QUALITY), tmp, "--out", OUT], { stdio: "ignore" });
unlinkSync(tmp);
console.log(`Wrote ${OUT}: ${w} × ${h}, ${(readFileSync(OUT).length / 1024).toFixed(0)} KB`);
