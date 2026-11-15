// Build data/mars-names.json, the names on the founding map's globe (#499), from the IAU's gazetteer of
// planetary nomenclature (USGS Astrogeology, public domain), the Mars centre points:
// (https://planetarynames.wr.usgs.gov/shapefiles/MARS_nomenclature_center_pts.zip, not kept in the repo)
//
//   node scripts/build-names.mjs path/to/MARS_nomenclature_center_pts.dbf
//
// Reads the shapefile's table (dBASE, UTF-8) for each feature's name, kind, size and middle; keeps all but
// the old telescope-era albedo features (the modern names cover the same ground); and writes them biggest
// first, so the globe can show the biggest that fit at each zoom. The game's own features (traits, "near")
// stay in data/mars-features.json.
import { readFileSync, writeFileSync } from "node:fs";

const path = process.argv[2];
if (!path) {
  console.error("Usage: node scripts/build-names.mjs path/to/MARS_nomenclature_center_pts.dbf");
  process.exit(1);
}
const buf = readFileSync(path);
const records = buf.readUInt32LE(4);
const headerLength = buf.readUInt16LE(8);
const recordLength = buf.readUInt16LE(10);
const fields = [];
for (let at = 32; buf[at] !== 0x0d; at += 32) {
  fields.push({ name: buf.toString("latin1", at, at + 11).replace(/\0.*$/, ""), length: buf[at + 16] });
}
const rows = [];
for (let r = 0; r < records; r++) {
  let at = headerLength + r * recordLength;
  if (buf[at] === 0x2a) continue; // deleted
  at += 1;
  const row = {};
  for (const f of fields) {
    row[f.name] = buf.toString("utf8", at, at + f.length).trim();
    at += f.length;
  }
  rows.push(row);
}

/** The kind, in a word, from the IAU's "Crater, craters" style. */
const kind = (type) => type.split(",")[0].trim().toLowerCase();
const names = rows
  .filter((r) => !/^Albedo/.test(r.type))
  .map((r) => ({ name: r.name, kind: kind(r.type), km: Math.round(Number(r.diameter) * 10) / 10, lat: Math.round(Number(r.center_lat) * 100) / 100, lon: Math.round(Number(r.center_lon) * 100) / 100 }))
  .sort((a, b) => b.km - a.km);
const out = {
  _note: "The IAU's names for features on Mars (#499), from the USGS gazetteer's centre points, biggest first: name, kind (crater, vallis, mons...), size in km, and the middle (degrees north, degrees east 0 to 360). Made by scripts/build-names.mjs.",
  names,
};
writeFileSync("data/mars-names.json", JSON.stringify(out).replace(/\},\{/g, "},\n{") + "\n");
console.log(`wrote data/mars-names.json: ${names.length} names`);
