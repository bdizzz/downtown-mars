// Build data/mars-elevation.json from NASA's MOLA MEGDR 4 px/degree grid
// (MEGT90N000CB.IMG from the PDS Geosciences Node, public domain):
//
//   node scripts/build-elevation.mjs path/to/megt90n000cb.img
//
// The source is 1440 × 720 big-endian int16 metres, simple cylindrical,
// rows from 90°N south, columns from 0°E east. We average 4 × 4 blocks into a
// 1° grid and store tens of metres to keep the file small.
import { readFileSync, writeFileSync } from "node:fs";

const SRC_W = 1440;
const SRC_H = 720;
const FACTOR = 4;
const UNIT_M = 10;

const path = process.argv[2];
if (!path) {
  console.error("Usage: node scripts/build-elevation.mjs path/to/megt90n000cb.img");
  process.exit(1);
}
const buf = readFileSync(path);
if (buf.length !== SRC_W * SRC_H * 2) {
  console.error(`Expected ${SRC_W * SRC_H * 2} bytes, got ${buf.length}`);
  process.exit(1);
}

const w = SRC_W / FACTOR;
const h = SRC_H / FACTOR;
const elev = new Array(w * h);
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let dy = 0; dy < FACTOR; dy++) {
      for (let dx = 0; dx < FACTOR; dx++) {
        sum += buf.readInt16BE(((y * FACTOR + dy) * SRC_W + x * FACTOR + dx) * 2);
      }
    }
    elev[y * w + x] = Math.round(sum / (FACTOR * FACTOR) / UNIT_M);
  }
}

const out = {
  _source:
    "NASA Mars Global Surveyor MOLA MEGDR, MEGT90N000CB.IMG (PDS Geosciences Node, public domain), averaged from 0.25° to 1°. Built by scripts/build-elevation.mjs.",
  width: w,
  height: h,
  degreesPerCell: 1,
  northLatitude: 90,
  westLongitude: 0,
  longitudeDirection: "east",
  unitMeters: UNIT_M,
  elevation: elev,
};
writeFileSync("data/mars-elevation.json", JSON.stringify(out) + "\n");
console.log(`Wrote data/mars-elevation.json: ${w} × ${h}, ${(JSON.stringify(out).length / 1024).toFixed(0)} KB`);
