// The furniture catalogue's source: every item's low-poly model and which
// items each room type may hold. Run `node scripts/furniture.mjs` to write
// data/furniture.json (the game reads that; this is only for authoring).
//
// Metres. An item's footprint is centred on x = 0, z = 0, with y = 0 the
// floor. Width runs along x and depth along z: the back is −z (against its
// wall), the front +z (into the room). Parts are boxes, cylinders and
// spheres with a colour name ("accent" is the room's category colour), an
// optional rotation in degrees and a glow for screens and lamps. Each item's
// size is worked out from its parts, so it always covers them.

import { writeFileSync } from "node:fs";

const r3 = (v) => Math.round(v * 1000) / 1000;
const box = (p, z, c, o = {}) => ({ s: "box", p: p.map(r3), z: z.map(r3), c, ...(o.r ? { r: o.r } : {}), ...(o.glow ? { glow: true } : {}) });
const cyl = (p, dia, h, c, o = {}) => ({ s: "cyl", p: p.map(r3), z: [r3(dia), r3(h)], c, ...(o.r ? { r: o.r } : {}), ...(o.glow ? { glow: true } : {}) });
const sph = (p, dia, c, o = {}) => ({ s: "sph", p: p.map(r3), z: [r3(dia)], c, ...(o.glow ? { glow: true } : {}) });
const glow = { glow: true };

/** Four legs under a w × d top at height h. */
const legs = (w, d, h, c = "metal", t = 0.05, inset = 0.05) => [-1, 1].flatMap((sx) => [-1, 1].map((sz) => box([sx * (w / 2 - inset - t / 2), h / 2, sz * (d / 2 - inset - t / 2)], [t, h, t], c)));
/** A table: legs and a top. */
const table = (w, d, h, top = "panel", leg = "metal") => [...legs(w, d, h - 0.04, leg), box([0, h - 0.02, 0], [w, 0.04, d], top)];
/** A chair facing +z at (x, z), turned by `turn` degrees. */
const chairAt = (x, z, c = "accent", turn = 0) => {
  const t = (turn * Math.PI) / 180;
  const at = (lx, lz) => [x + lx * Math.cos(t) + lz * Math.sin(t), z - lx * Math.sin(t) + lz * Math.cos(t)];
  const [bx, bz] = at(0, -0.21);
  const parts = [box([x, 0.45, z], [0.46, 0.05, 0.46], c, turn ? { r: [0, turn, 0] } : {}), box([bx, 0.72, bz], [0.46, 0.45, 0.04], c, turn ? { r: [0, turn, 0] } : {})];
  for (const [lx, lz] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) {
    const [px, pz] = at(lx, lz);
    parts.push(box([px, 0.22, pz], [0.04, 0.44, 0.04], "metal"));
  }
  return parts;
};
/** A small screen with a stand, facing +z, at (x, y, z). */
const monitor = (x, y, z, w = 0.55) => [box([x, y - 0.12, z - 0.05], [0.06, 0.2, 0.06], "dark"), box([x, y + 0.12, z], [w, w * 0.62, 0.04], "dark"), box([x, y + 0.12, z + 0.021], [w - 0.05, w * 0.62 - 0.05, 0.005], "glow", glow)];
/** Leafy crown: a few overlapping spheres. */
const foliage = (x, y, z, s = 1, a = "plant", b = "leaf") => [sph([x, y, z], 0.7 * s, a), sph([x + 0.18 * s, y + 0.15 * s, z + 0.1 * s], 0.45 * s, b), sph([x - 0.2 * s, y + 0.08 * s, z - 0.12 * s], 0.5 * s, b), sph([x + 0.05 * s, y + 0.3 * s, z - 0.05 * s], 0.4 * s, a)];

// ---- footprint: the box around each part, after its rotation (Euler XYZ, as Three.js) ----
function half(p) {
  const z = p.z;
  const h = p.s === "box" ? [z[0] / 2, z[1] / 2, z[2] / 2] : p.s === "cyl" ? [z[0] / 2, z[1] / 2, z[0] / 2] : [z[0] / 2, z[0] / 2, z[0] / 2];
  if (!p.r) return h;
  const [rx, ry, rz] = p.r.map((a) => (a * Math.PI) / 180);
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(rx), Math.sin(rx), Math.cos(ry), Math.sin(ry), Math.cos(rz), Math.sin(rz)];
  const R = [
    [cy * cz, -cy * sz, sy],
    [cx * sz + sx * sy * cz, cx * cz - sx * sy * sz, -sx * cy],
    [sx * sz - cx * sy * cz, sx * cz + cx * sy * sz, cx * cy],
  ];
  return R.map((row) => row.reduce((n, v, j) => n + Math.abs(v) * h[j], 0));
}
const up = (v) => Math.ceil(Math.round(v * 1e6) / 1e6 * 20) / 20;

const items = {};
function item(id, name, parts, mount) {
  let [w, d, h] = [0, 0, 0];
  for (const p of parts) {
    const [hx, hy, hz] = half(p);
    w = Math.max(w, 2 * (Math.abs(p.p[0]) + hx));
    d = Math.max(d, 2 * (Math.abs(p.p[2]) + hz));
    h = Math.max(h, p.p[1] + hy);
  }
  items[id] = { name, size: [up(w), up(d), up(h)], parts, ...(mount ? { mount } : {}) };
}

// =====================================================================
// Wall hangings: modelled from their bottom edge, hung at their mount height
// (the last argument). Their backs go flat against the wall.
// =====================================================================

/** A picture frame (w × h) with a canvas in it. */
const framed = (w, h, frame = "fibre") => [box([0, h / 2, 0], [w, h, 0.04], frame), box([0, h / 2, 0.021], [w - 0.1, h - 0.1, 0.01], "cream")];
item("painting", "Painting", [
  ...framed(0.9, 0.7),
  // A landscape: sky, hills and a sun.
  box([0, 0.47, 0.027], [0.8, 0.26, 0.005], "glow"),
  box([-0.12, 0.25, 0.028], [0.56, 0.2, 0.005], "rust"),
  box([0.2, 0.2, 0.029], [0.4, 0.12, 0.005], "composite"),
  cyl([0.22, 0.5, 0.03], 0.1, 0.005, "power", { r: [90, 0, 0] }),
], 1.5);
item("painting_wide", "Wide painting", [
  ...framed(1.8, 0.9),
  box([0, 0.62, 0.027], [1.7, 0.36, 0.005], "accent"),
  box([-0.4, 0.3, 0.028], [0.9, 0.3, 0.005], "rust"),
  box([0.45, 0.25, 0.029], [0.8, 0.2, 0.005], "plant"),
  cyl([-0.55, 0.65, 0.03], 0.14, 0.005, "white", { r: [90, 0, 0] }),
], 1.45);
item("poster", "Poster", [
  box([0, 0.42, 0], [0.6, 0.84, 0.01], "white"),
  box([0, 0.52, 0.006], [0.5, 0.5, 0.004], "accent"),
  cyl([0, 0.55, 0.009], 0.26, 0.004, "power", { r: [90, 0, 0] }),
  ...[0.18, 0.12].map((y) => box([0, y, 0.006], [0.44, 0.03, 0.004], "dark")),
], 1.3);
item("wall_lamp", "Wall lamp", [
  box([0, 0.12, 0], [0.12, 0.24, 0.04], "metal"),
  box([0, 0.12, 0.08], [0.04, 0.04, 0.14], "metal"),
  cyl([0, 0.22, 0.15], 0.22, 0.2, "cream"),
  cyl([0, 0.14, 0.15], 0.16, 0.03, "lamp", glow),
], 1.9);
item("wall_shelf", "Wall shelf", [
  box([0, 0.14, 0.1], [1.0, 0.04, 0.22], "fibre"),
  ...[-0.42, 0.42].map((x) => box([x, 0.06, 0.03], [0.03, 0.12, 0.08], "dark")),
  ...[-0.32, -0.26, -0.2].map((x, i) => box([x, 0.27 + i * 0.01, 0.1], [0.05, 0.22 + i * 0.02, 0.16], ["accent", "rust", "board"][i])),
  cyl([0.05, 0.24, 0.1], 0.12, 0.16, "copper"),
  sph([0.3, 0.23, 0.1], 0.14, "mirror"),
], 1.45);
item("wall_mirror", "Mirror", [box([0, 0.5, 0], [0.6, 1.0, 0.03], "fibre"), box([0, 0.5, 0.016], [0.52, 0.92, 0.005], "mirror")], 1.1);
item("wall_clock", "Clock", [
  cyl([0, 0.2, 0.02], 0.4, 0.04, "dark", { r: [90, 0, 0] }),
  cyl([0, 0.2, 0.041], 0.34, 0.005, "white", { r: [90, 0, 0] }),
  box([0, 0.25, 0.045], [0.02, 0.11, 0.005], "dark"),
  box([0.05, 0.2, 0.045], [0.1, 0.02, 0.005], "dark"),
], 2.2);
item("chart_board", "Chart board", [
  box([0, 0.45, 0], [1.4, 0.9, 0.04], "white"),
  box([0, 0.02, 0.03], [1.3, 0.03, 0.06], "metal"),
  // A rising line, bars and notes.
  ...[[-0.45, 0.35], [-0.2, 0.45], [0.05, 0.4], [0.3, 0.6]].map(([x, y], i, all) => {
    const [nx, ny] = all[i + 1] ?? [0.5, 0.7];
    const len = Math.hypot(nx - x, ny - y);
    return box([(x + nx) / 2, (y + ny) / 2, 0.022], [len, 0.02, 0.004], "blueprint", { r: [0, 0, (Math.atan2(ny - y, nx - x) * 180) / Math.PI] });
  }),
  ...[-0.5, -0.4, -0.3].map((x, i) => box([x, 0.2 + i * 0.03, 0.022], [0.07, 0.12 + i * 0.06, 0.004], "accent")),
  box([0.45, 0.2, 0.022], [0.3, 0.2, 0.004], "power"),
], 1.25);
item("readout_panel", "Readout panel", [
  box([0, 0.35, 0], [1.2, 0.7, 0.08], "dark"),
  box([-0.28, 0.4, 0.041], [0.56, 0.44, 0.005], "glow", glow),
  ...[0.12, 0.2, 0.28].map((x, i) => box([x + 0.1, 0.28 + i * 0.06, 0.042], [0.06, 0.2 + i * 0.12, 0.005], "power", glow)),
  ...[-0.4, -0.25, -0.1].map((x) => box([x, 0.1, 0.045], [0.08, 0.05, 0.01], "accent")),
], 1.35);
item("gauge_panel", "Gauges", [
  box([0, 0.3, 0], [0.9, 0.6, 0.1], "metal"),
  ...[-0.25, 0.05, 0.3].map((x) => cyl([x, 0.36, 0.051], 0.2, 0.01, "white", { r: [90, 0, 0] })),
  ...[-0.25, 0.05, 0.3].map((x, i) => box([x + 0.03, 0.38, 0.058], [0.08, 0.015, 0.004], "fire", { r: [0, 0, 30 - i * 40] })),
  box([0, 0.1, 0.051], [0.7, 0.06, 0.005], "hazard"),
], 1.3);
item("mars_map", "Map of Mars", [
  box([0, 0.55, 0], [2.0, 1.1, 0.04], "dark"),
  box([0, 0.55, 0.021], [1.9, 1.0, 0.005], "rust"),
  // Highlands, a canyon, and the colony's holes marked.
  box([-0.4, 0.8, 0.024], [0.8, 0.3, 0.004], "composite"),
  box([0.3, 0.45, 0.024], [0.9, 0.06, 0.004], "soil", { r: [0, 0, -8] }),
  cyl([0.55, 0.8, 0.026], 0.3, 0.004, "stone", { r: [90, 0, 0] }),
  ...[[-0.6, 0.3], [-0.1, 0.55], [0.7, 0.25]].map(([x, y]) => cyl([x, y, 0.028], 0.07, 0.006, "glow", { r: [90, 0, 0], glow: true })),
], 1.3);
item("notice_board", "Notice board", [
  box([0, 0.4, 0], [1.2, 0.8, 0.04], "fibre"),
  box([0, 0.4, 0.021], [1.1, 0.7, 0.005], "composite"),
  ...[[-0.35, 0.55, "white"], [-0.05, 0.5, "power"], [0.3, 0.58, "accent"], [-0.3, 0.22, "cream"], [0.1, 0.25, "white"], [0.38, 0.2, "grow"]].map(([x, y, c]) =>
    box([x, y, 0.026], [0.22, 0.24, 0.004], c, { r: [0, 0, (x * 20) % 7] }),
  ),
], 1.3);
item("safety_sign", "Safety sign", [
  box([0, 0.3, 0], [0.6, 0.6, 0.02], "hazard"),
  box([0, 0.3, 0.011], [0.38, 0.38, 0.004], "dark", { r: [0, 0, 45] }),
  box([0, 0.3, 0.014], [0.3, 0.3, 0.004], "hazard", { r: [0, 0, 45] }),
  box([0, 0.33, 0.016], [0.04, 0.14, 0.004], "dark"),
  box([0, 0.23, 0.016], [0.04, 0.04, 0.004], "dark"),
], 1.75);
item("wall_planter", "Hanging planter", [
  box([0, 0.45, 0.12], [0.8, 0.2, 0.24], "accent"),
  box([0, 0.55, 0.12], [0.74, 0.02, 0.2], "soil"),
  // Leaves over the rim, and vines trailing down the front.
  ...[-0.25, 0, 0.25].flatMap((x) => [sph([x, 0.65, 0.12], 0.26, "leaf"), box([x + 0.05, 0.2, 0.22], [0.05, 0.4, 0.05], "plant")]),
], 1.35);
item("banner", "Banner", [
  box([0, 1.58, 0.03], [0.9, 0.04, 0.04], "metal"),
  box([0, 0.9, 0.02], [0.8, 1.3, 0.01], "accent"),
  box([0, 1.05, 0.026], [0.5, 0.5, 0.004], "white"),
  cyl([0, 1.05, 0.029], 0.3, 0.004, "power", { r: [90, 0, 0] }),
  box([0, 0.3, 0.02], [0.8, 0.1, 0.01], "hazard"),
], 1.6);
item("plaque", "Plaque", [box([0, 0.17, 0], [0.5, 0.34, 0.03], "copper"), box([0, 0.17, 0.016], [0.42, 0.26, 0.004], "stone"), ...[0.22, 0.15, 0.08].map((y) => box([0, y, 0.019], [0.3, 0.02, 0.003], "dark"))], 1.4);


// Family snapshots: a cluster of small frames, each a different size and colour.
item("family_photos", "Family photos", [
  ...[[-0.36, 0.34, 0.26, 0.32, "fibre", "water"], [-0.02, 0.4, 0.34, 0.26, "dark", "cream"], [0.33, 0.3, 0.24, 0.3, "copper", "plant"], [-0.2, 0.08, 0.3, 0.2, "dark", "rust"], [0.16, 0.06, 0.22, 0.16, "fibre", "glow"]].flatMap(([x, y, w, h, f, c]) => [
    box([x, y + h / 2, 0], [w, h, 0.03], f),
    box([x, y + h / 2, 0.016], [w - 0.06, h - 0.06, 0.004], c),
  ]),
], 1.35);
item("wall_textile", "Woven hanging", [
  cyl([0, 1.2, 0.03], 0.04, 0.9, "fibre", { r: [0, 0, 90] }),
  box([0, 0.66, 0.02], [0.7, 1.06, 0.015], "cushion"),
  // Bands of colour woven across it, and tassels along the bottom.
  ...[[0.98, "accent"], [0.82, "hazard"], [0.66, "cream"], [0.5, "rust"], [0.34, "accent"]].map(([y, c]) => box([0, y, 0.029], [0.66, 0.08, 0.004], c)),
  box([0, 0.66, 0.031], [0.18, 0.18, 0.004], "power", { r: [0, 0, 45] }),
  ...[-0.3, -0.18, -0.06, 0.06, 0.18, 0.3].map((x) => box([x, 0.06, 0.02], [0.03, 0.12, 0.02], "cushion")),
], 1.3);
item("earth_photo", "Picture of Earth", [
  box([0, 0.35, 0], [0.7, 0.7, 0.04], "dark"),
  box([0, 0.35, 0.021], [0.62, 0.62, 0.004], "rubber"),
  cyl([0.03, 0.38, 0.025], 0.42, 0.004, "blueprint", { r: [90, 0, 0] }),
  box([-0.02, 0.44, 0.028], [0.16, 0.12, 0.004], "plant", { r: [0, 0, 20] }),
  box([0.08, 0.3, 0.028], [0.1, 0.14, 0.004], "composite", { r: [0, 0, -10] }),
  box([0.02, 0.52, 0.029], [0.24, 0.03, 0.004], "white", { r: [0, 0, -12] }),
  cyl([-0.2, 0.14, 0.027], 0.1, 0.004, "stone", { r: [90, 0, 0] }),
], 1.4);
item("coat_hooks", "Coat hooks", [
  box([0, 0.95, 0.02], [1.2, 0.08, 0.04], "fibre"),
  ...[-0.45, -0.15, 0.15, 0.45].map((x) => box([x, 0.92, 0.07], [0.03, 0.03, 0.08], "steel")),
  // A jacket, a bag and a scarf.
  box([-0.45, 0.55, 0.09], [0.36, 0.72, 0.1], "accent"),
  box([-0.45, 0.85, 0.12], [0.16, 0.1, 0.06], "accent"),
  box([0.15, 0.62, 0.1], [0.28, 0.3, 0.14], "composite"),
  box([0.15, 0.8, 0.1], [0.03, 0.14, 0.02], "dark"),
  box([0.45, 0.6, 0.08], [0.1, 0.6, 0.03], "hazard"),
], 0.9);
item("whiteboard", "Whiteboard", [
  box([0, 0.5, 0], [1.6, 1.0, 0.03], "steel"),
  box([0, 0.5, 0.016], [1.52, 0.92, 0.004], "white"),
  box([0, 0.02, 0.04], [1.4, 0.04, 0.08], "steel"),
  ...[[-0.45, 0.8, 0.5, "blueprint"], [-0.5, 0.7, 0.4, "blueprint"], [-0.42, 0.6, 0.55, "fire"], [0.35, 0.3, 0.6, "blueprint"]].map(([x, y, w, c]) => box([x, y, 0.02], [w, 0.02, 0.003], c)),
  // A box-and-arrow sketch.
  box([0.3, 0.72, 0.019], [0.3, 0.2, 0.003], "plant"),
  box([0.3, 0.72, 0.02], [0.26, 0.16, 0.003], "white"),
  box([0.05, 0.55, 0.02], [0.3, 0.02, 0.003], "dark", { r: [0, 0, -30] }),
  ...[-0.3, -0.2].map((x, i) => box([x, 0.06, 0.07], [0.1, 0.02, 0.02], i ? "fire" : "blueprint")),
], 1.0);
item("pipe_manifold", "Pipe manifold", [
  ...[0.12, 0.34, 0.56].map((y, i) => cyl([0, y, 0.1], 0.1, 1.6, ["metal", "copper", "steel"][i], { r: [0, 0, 90] })),
  ...[-0.7, 0.7].map((x) => box([x, 0.34, 0.03], [0.06, 0.7, 0.06], "dark")),
  ...[[-0.3, 0.12], [0.25, 0.34], [-0.05, 0.56]].flatMap(([x, y]) => [
    cyl([x, y, 0.1], 0.14, 0.12, "dark", { r: [0, 0, 90] }),
    box([x, y, 0.19], [0.02, 0.02, 0.1], "dark"),
    cyl([x, y, 0.24], 0.16, 0.02, "fire", { r: [90, 0, 0] }),
  ]),
  box([0.55, 0.45, 0.16], [0.14, 0.14, 0.04], "white"),
], 1.7);
item("cable_tray", "Cable tray", [
  box([0, 0.02, 0.15], [1.8, 0.03, 0.3], "metal"),
  box([0, 0.08, 0.295], [1.8, 0.12, 0.01], "metal"),
  ...[-0.8, 0, 0.8].map((x) => box([x, 0.06, 0.05], [0.04, 0.12, 0.1], "dark")),
  ...[[0.08, "dark"], [0.14, "rubber"], [0.2, "hazard"], [0.25, "blueprint"]].map(([z, c]) => cyl([0, 0.07, z], 0.05, 1.8, c, { r: [0, 0, 90] })),
], 2.95);
item("tool_board", "Tool pegboard", [
  box([0, 0.45, 0], [1.2, 0.9, 0.03], "composite"),
  ...[0.2, 0.45, 0.7].flatMap((y) => [-0.45, -0.15, 0.15, 0.45].map((x) => box([x + 0.1, y - 0.1, 0.018], [0.02, 0.02, 0.004], "dark"))),
  // A spanner, a hammer, pliers, a saw and a coil of cable.
  box([-0.4, 0.55, 0.03], [0.05, 0.5, 0.02], "steel"),
  box([-0.2, 0.62, 0.03], [0.04, 0.4, 0.03], "fibre"),
  box([-0.2, 0.82, 0.04], [0.18, 0.06, 0.05], "metal"),
  ...[-0.03, 0.03].map((dx) => box([dx, 0.55, 0.03], [0.03, 0.3, 0.02], "fire", { r: [0, 0, dx * 300] })),
  box([0.28, 0.6, 0.025], [0.3, 0.14, 0.01], "steel"),
  box([0.4, 0.6, 0.03], [0.08, 0.16, 0.03], "fibre"),
  cyl([0.3, 0.22, 0.05], 0.24, 0.08, "hazard", { r: [90, 0, 0] }),
], 1.1);
item("fire_extinguisher", "Fire extinguisher", [
  box([0, 0.3, 0.01], [0.16, 0.24, 0.02], "dark"),
  cyl([0, 0.28, 0.1], 0.16, 0.52, "red"),
  cyl([0, 0.57, 0.1], 0.07, 0.06, "dark"),
  box([0.04, 0.62, 0.1], [0.14, 0.03, 0.04], "dark"),
  box([-0.04, 0.5, 0.18], [0.03, 0.2, 0.03], "rubber"),
  // Its sign above.
  box([0, 0.78, 0.005], [0.22, 0.14, 0.01], "red"),
  box([0, 0.78, 0.011], [0.08, 0.1, 0.003], "white"),
], 0.8);
item("first_aid_kit", "First-aid box", [
  box([0, 0.2, 0.06], [0.4, 0.4, 0.12], "white"),
  box([0, 0.2, 0.121], [0.2, 0.06, 0.004], "red"),
  box([0, 0.2, 0.121], [0.06, 0.2, 0.004], "red"),
  box([0.17, 0.2, 0.125], [0.02, 0.08, 0.01], "metal"),
], 1.4);
item("air_vent", "Air vent", [
  box([0, 0.18, 0.01], [0.7, 0.36, 0.02], "steel"),
  box([0, 0.18, 0.021], [0.6, 0.28, 0.004], "dark"),
  ...[0.08, 0.13, 0.18, 0.23, 0.28].map((y) => box([0, y, 0.026], [0.58, 0.02, 0.012], "metal", { r: [30, 0, 0] })),
], 2.7);
item("intercom", "Intercom", [
  box([0, 0.15, 0.02], [0.2, 0.3, 0.04], "panel"),
  box([0, 0.2, 0.041], [0.14, 0.1, 0.004], "glow", glow),
  ...[0.09, 0.05].map((y) => box([0, y, 0.043], [0.1, 0.02, 0.006], "dark")),
  cyl([0.06, 0.27, 0.043], 0.02, 0.006, "plant", { r: [90, 0, 0], glow: true }),
], 1.35);
item("menu_board", "Menu board", [
  box([0, 0.3, 0], [1.3, 0.6, 0.05], "dark"),
  box([0, 0.3, 0.026], [1.2, 0.5, 0.004], "board"),
  box([0, 0.5, 0.029], [0.5, 0.05, 0.003], "power", glow),
  ...[0.4, 0.33, 0.26, 0.19, 0.12].flatMap((y, i) => [box([-0.2, y, 0.029], [0.55 - (i % 2) * 0.12, 0.025, 0.003], "white"), box([0.45, y, 0.029], [0.12, 0.025, 0.003], "hazard")]),
], 1.75);
item("utensil_rack", "Utensil rack", [
  box([0, 0.72, 0.03], [1.1, 0.03, 0.03], "steel"),
  ...[-0.5, 0.5].map((x) => box([x, 0.72, 0.01], [0.03, 0.06, 0.04], "dark")),
  // Pans, a ladle, a whisk and a sieve, hanging by their handles.
  ...[[-0.35, 0.3], [-0.05, 0.24]].flatMap(([x, d]) => [box([x, 0.58, 0.05], [0.03, 0.26, 0.02], "dark"), cyl([x, 0.4 - d / 4, 0.05], d, 0.05, "copper", { r: [90, 0, 0] })]),
  box([0.18, 0.5, 0.05], [0.02, 0.42, 0.02], "steel"),
  sph([0.18, 0.3, 0.07], 0.1, "steel"),
  box([0.32, 0.54, 0.05], [0.02, 0.34, 0.02], "steel"),
  sph([0.32, 0.36, 0.05], 0.1, "metal"),
  cyl([0.45, 0.48, 0.06], 0.18, 0.06, "metal", { r: [90, 0, 0] }),
], 1.3);
item("grow_light", "Grow light", [
  ...[-0.6, 0.6].map((x) => box([x, 0.1, 0.15], [0.04, 0.04, 0.3], "metal")),
  box([0, 0.06, 0.3], [1.5, 0.08, 0.14], "dark"),
  box([0, 0.015, 0.3], [1.44, 0.01, 0.1], "grow", glow),
], 2.5);
item("work_light", "Work light", [
  box([0, 0.12, 0.01], [0.14, 0.22, 0.02], "dark"),
  box([0, 0.14, 0.08], [0.04, 0.04, 0.14], "dark"),
  cyl([0, 0.1, 0.18], 0.2, 0.18, "hazard"),
  cyl([0, 0.06, 0.18], 0.14, 0.08, "lamp", glow),
  ...[-0.08, 0.08].map((dx) => box([dx, 0.1, 0.18], [0.01, 0.16, 0.2], "dark")),
], 2.45);

// =====================================================================
// Services: maintenance and cleaning crews
// =====================================================================

item("parts_rack", "Parts rack", [
  ...[-0.55, 0.55].map((x) => box([x, 1.0, 0], [0.05, 2.0, 0.55], "metal")),
  ...[0.1, 0.7, 1.3, 1.9].map((y) => box([0, y, 0], [1.15, 0.04, 0.55], "metal")),
  // Bins of spares, gears, a coil of pipe and a motor on the shelves.
  ...[[-0.35, 0.28, "hazard"], [0, 0.28, "accent"], [0.35, 0.28, "hazard"], [-0.3, 0.88, "accent"], [0.3, 0.88, "blueprint"]].map(([x, y, c]) => box([x, y, 0.02], [0.3, 0.28, 0.4], c)),
  ...[-0.3, 0.05].map((x) => cyl([x, 1.5, 0.05], 0.3, 0.06, "steel", { r: [90, 0, 0] })),
  cyl([0.35, 1.48, 0], 0.22, 0.32, "copper"),
  box([-0.2, 2.05, 0], [0.5, 0.25, 0.4], "panel"),
  box([0.3, 2.02, 0.05], [0.3, 0.2, 0.3], "dark"),
]);
item("repair_stand", "Repair stand", [
  ...legs(1.2, 0.7, 0.75, "dark", 0.06),
  box([0, 0.78, 0], [1.2, 0.05, 0.7], "metal"),
  // A pump opened up on the stand, its cover off to one side.
  cyl([-0.1, 1.05, 0], 0.45, 0.5, "accent", { r: [0, 0, 90] }),
  cyl([0.25, 1.05, 0], 0.3, 0.2, "steel", { r: [0, 0, 90] }),
  box([-0.1, 1.33, 0], [0.12, 0.08, 0.12], "dark"),
  box([0.4, 0.83, 0.18], [0.3, 0.04, 0.3], "accent"),
  box([-0.45, 0.82, -0.2], [0.2, 0.03, 0.08], "steel"),
  box([-0.45, 0.82, -0.08], [0.18, 0.03, 0.05], "hazard"),
]);
item("cleaning_cart", "Cleaning cart", [
  ...legs(0.9, 0.5, 0.12, "dark", 0.04),
  box([0, 0.45, 0], [0.9, 0.7, 0.5], "accent"),
  box([0, 0.82, 0], [0.92, 0.04, 0.52], "panel"),
  // A mop bucket, spray bottles and a bin bag.
  cyl([0.25, 0.97, 0], 0.3, 0.26, "water"),
  box([0.25, 1.4, 0.05], [0.03, 0.9, 0.03], "fibre"),
  ...[-0.35, -0.22].map((x, i) => cyl([x, 0.95, 0.1], 0.09, 0.22, i ? "plant" : "water")),
  box([-0.1, 0.96, -0.1], [0.25, 0.26, 0.2], "dark"),
]);
item("mop_rack", "Mop rack", [
  box([0, 1.4, 0], [1.2, 0.08, 0.1], "fibre"),
  ...[-0.45, -0.15, 0.15, 0.45].flatMap((x, i) => [box([x, 0.85, 0.08], [0.03, 1.1, 0.03], "fibre"), box([x, 0.2, 0.08], [0.22, 0.25, 0.08], ["cream", "accent", "cream", "hazard"][i])]),
  box([0, 0.05, 0.1], [1.2, 0.1, 0.25], "metal"),
]);
item("drying_rack", "Drying rack", [
  ...[-0.5, 0.5].map((x) => box([x, 0.8, 0], [0.04, 1.6, 0.5], "steel")),
  ...[0.7, 1.1, 1.5].map((y) => box([0, y, 0], [1.0, 0.03, 0.03], "steel")),
  // Towels and cloths hung over the bars.
  ...[[-0.25, 1.1, "cream"], [0.05, 1.1, "accent"], [0.3, 1.5, "white"], [-0.2, 1.5, "cushion"], [0.25, 0.7, "cream"]].map(([x, y, c]) => box([x, y - 0.2, 0], [0.22, 0.4, 0.04], c)),
]);

// =====================================================================
// Homes and people
// =====================================================================

item("bunk_bed", "Bunk bed", [
  ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => box([sx * 0.96, 0.95, sz * 0.43], [0.06, 1.9, 0.06], "metal"))),
  box([0, 0.34, 0], [1.98, 0.06, 0.92], "dark"),
  box([0, 0.44, 0], [1.88, 0.14, 0.84], "accent"),
  box([0.25, 0.52, 0.02], [1.3, 0.03, 0.86], "cream"),
  box([-0.76, 0.56, 0], [0.32, 0.1, 0.6], "white"),
  box([0, 1.24, 0], [1.98, 0.06, 0.92], "dark"),
  box([0, 1.34, 0], [1.88, 0.14, 0.84], "accent"),
  box([0.25, 1.42, 0.02], [1.3, 0.03, 0.86], "cream"),
  box([-0.76, 1.46, 0], [0.32, 0.1, 0.6], "white"),
  // The top bunk's rail, and the ladder at its foot.
  box([0.1, 1.62, 0.43], [1.4, 0.05, 0.04], "metal"),
  ...[0.72, 0.9].map((x) => box([x, 1.0, 0.47], [0.04, 1.6, 0.04], "metal")),
  ...[0.45, 0.8, 1.15].map((y) => box([0.81, y, 0.47], [0.2, 0.03, 0.03], "metal")),
  // A curtain half drawn on the lower bunk.
  box([-0.55, 0.9, 0.45], [0.7, 0.72, 0.02], "accent"),
]);
item("bed", "Bed", [
  ...legs(2.1, 1.0, 0.28, "dark"),
  box([0, 0.3, 0], [2.1, 0.06, 1.0], "dark"),
  box([0, 0.42, 0], [2.0, 0.18, 0.92], "white"),
  box([0.25, 0.52, 0], [1.4, 0.05, 0.96], "accent"),
  box([0.25, 0.49, 0.47], [1.4, 0.12, 0.02], "accent"),
  box([-0.8, 0.56, 0], [0.34, 0.12, 0.66], "white"),
  box([-1.03, 0.6, 0], [0.06, 0.6, 1.02], "composite"),
]);
item("locker", "Locker", [
  box([0, 0.95, 0], [0.6, 1.9, 0.5], "metal"),
  box([0, 0.95, 0.251], [0.02, 1.84, 0.01], "dark"),
  ...[1.55, 1.62, 1.69].map((y) => box([0, y, 0.253], [0.4, 0.02, 0.01], "dark")),
  box([0.1, 1.0, 0.26], [0.03, 0.16, 0.02], "steel"),
  box([0, 1.92, 0], [0.62, 0.04, 0.52], "dark"),
  box([0, 0.03, 0], [0.62, 0.06, 0.52], "dark"),
]);
item("footlocker", "Footlocker", [
  box([0, 0.19, 0], [0.9, 0.38, 0.5], "accent"),
  box([0, 0.4, 0], [0.92, 0.05, 0.52], "dark"),
  ...[-0.3, 0.3].map((x) => box([x, 0.2, 0], [0.06, 0.4, 0.52], "dark")),
  box([0, 0.3, 0.26], [0.12, 0.08, 0.02], "steel"),
]);
item("table", "Table", [...table(1.2, 0.8, 0.75), box([0.2, 0.78, 0.05], [0.25, 0.02, 0.18], "white"), cyl([-0.25, 0.8, -0.1], 0.08, 0.1, "accent")]);
item("stool", "Stool", [cyl([0, 0.22, 0], 0.06, 0.44, "metal"), cyl([0, 0.02, 0], 0.34, 0.04, "metal"), cyl([0, 0.12, 0], 0.3, 0.02, "metal"), cyl([0, 0.45, 0], 0.38, 0.06, "accent")]);
item("chair", "Chair", chairAt(0, 0));
item("office_chair", "Office chair", [
  ...[0, 72, 144, 216, 288].map((a) => box([0.2 * Math.sin((a * Math.PI) / 180), 0.03, 0.2 * Math.cos((a * Math.PI) / 180)], [0.06, 0.05, 0.4], "dark", { r: [0, a, 0] })),
  cyl([0, 0.26, 0], 0.07, 0.42, "metal"),
  box([0, 0.5, 0.02], [0.52, 0.08, 0.5], "dark"),
  box([0, 0.85, -0.23], [0.48, 0.6, 0.06], "dark"),
  box([0, 0.85, -0.19], [0.4, 0.5, 0.02], "accent"),
  ...[-1, 1].map((sx) => box([sx * 0.27, 0.66, 0.02], [0.04, 0.04, 0.36], "dark")),
]);
item("rug", "Rug", [box([0, 0.008, 0], [2.4, 0.016, 1.7], "cushion"), box([0, 0.012, 0], [2.0, 0.012, 1.3], "accent"), box([0, 0.016, 0], [1.6, 0.01, 0.9], "cushion")]);
item("armchair", "Armchair", [
  box([0, 0.22, 0], [0.9, 0.44, 0.9], "accent"),
  box([0, 0.5, 0.05], [0.66, 0.12, 0.76], "cushion"),
  box([0, 0.74, -0.37], [0.9, 0.6, 0.16], "accent"),
  ...[-1, 1].map((sx) => box([sx * 0.39, 0.6, 0.05], [0.12, 0.3, 0.8], "accent")),
  box([0.2, 0.72, -0.25], [0.3, 0.26, 0.1], "cream", { r: [-15, 0, 0] }),
]);
item("sofa", "Sofa", [
  box([0, 0.22, 0], [2.0, 0.44, 0.9], "accent"),
  ...[-0.42, 0.42].map((x) => box([x, 0.5, 0.05], [0.82, 0.12, 0.76], "cushion")),
  box([0, 0.72, -0.37], [2.0, 0.54, 0.16], "accent"),
  ...[-1, 1].map((sx) => box([sx * 0.93, 0.58, 0.05], [0.14, 0.28, 0.8], "accent")),
  box([-0.6, 0.72, -0.25], [0.32, 0.28, 0.1], "cream", { r: [-15, 0, 0] }),
]);
item("side_table", "Side table", [cyl([0, 0.3, 0], 0.08, 0.58, "metal"), cyl([0, 0.59, 0], 0.5, 0.03, "composite"), cyl([0, 0.02, 0], 0.36, 0.04, "metal"), cyl([0.08, 0.7, 0.05], 0.06, 0.18, "metal"), sph([0.08, 0.84, 0.05], 0.18, "lamp", glow)]);
item("plant_pot", "Potted plant", [cyl([0, 0.24, 0], 0.5, 0.48, "panel"), cyl([0, 0.47, 0], 0.54, 0.04, "accent"), cyl([0, 0.49, 0], 0.44, 0.02, "soil"), cyl([0, 0.7, 0], 0.05, 0.42, "rust"), ...foliage(0, 1.0, 0, 0.9)]);
item("partition", "Privacy screen", [
  box([0, 0.9, 0], [1.8, 1.7, 0.05], "accent"),
  box([0, 1.77, 0], [1.84, 0.05, 0.07], "metal"),
  ...[-1, 1].map((sx) => box([sx * 0.9, 0.9, 0], [0.05, 1.8, 0.07], "metal")),
  ...[-1, 1].map((sx) => box([sx * 0.9, 0.02, 0], [0.08, 0.04, 0.4], "metal")),
]);
item("floor_lamp", "Floor lamp", [cyl([0, 0.02, 0], 0.36, 0.04, "dark"), cyl([0, 0.8, 0], 0.04, 1.56, "metal"), cyl([0, 1.62, 0], 0.4, 0.3, "cream"), cyl([0, 1.5, 0], 0.3, 0.04, "lamp", glow)]);
item("tv_unit", "Media wall", [
  box([0, 0.25, 0], [2.0, 0.5, 0.45], "composite"),
  box([0, 0.25, 0.226], [1.9, 0.03, 0.01], "dark"),
  box([0, 1.25, -0.15], [1.7, 0.95, 0.06], "dark"),
  box([0, 1.25, -0.115], [1.6, 0.86, 0.01], "glow", glow),
  ...[-0.8, 0.8].map((x) => box([x, 0.7, 0.05], [0.18, 0.4, 0.18], "dark")),
]);
item("coat_rack", "Coat rack", [cyl([0, 0.02, 0], 0.4, 0.04, "dark"), cyl([0, 0.9, 0], 0.05, 1.8, "metal"), box([0.12, 1.4, 0.05], [0.24, 0.7, 0.14], "accent"), box([-0.1, 1.45, -0.04], [0.2, 0.6, 0.12], "cushion")]);
// Homes: apartments of every tier (the finer the home, the more of these it holds).
item("double_bed", "Double bed", [
  ...legs(2.1, 1.7, 0.28, "fibre"),
  box([0, 0.3, 0], [2.1, 0.06, 1.7], "fibre"),
  box([0.02, 0.43, 0], [2.0, 0.2, 1.62], "white"),
  box([0.3, 0.55, 0], [1.4, 0.06, 1.66], "accent"),
  box([0.3, 0.51, 0.82], [1.4, 0.14, 0.02], "accent"),
  box([0.95, 0.59, 0], [0.3, 0.05, 1.66], "cream"),
  ...[-0.4, 0.4].map((z) => box([-0.72, 0.6, z], [0.36, 0.14, 0.62], "white")),
  // The headboard: padded, in the fibre frame.
  box([-1.03, 0.75, 0], [0.06, 0.9, 1.72], "fibre"),
  box([-0.99, 0.82, 0], [0.04, 0.6, 1.5], "cushion"),
]);
item("wardrobe", "Wardrobe", [
  box([0, 1.0, 0], [1.2, 2.0, 0.6], "fibre"),
  box([0, 1.02, 0.301], [0.015, 1.9, 0.01], "dark"),
  ...[-1, 1].map((sx) => box([sx * 0.08, 1.05, 0.31], [0.03, 0.28, 0.03], "steel")),
  box([0, 2.02, 0], [1.24, 0.04, 0.62], "dark"),
  box([0, 0.04, 0], [1.16, 0.08, 0.56], "dark"),
]);
item("dresser", "Dresser", [
  box([0, 0.42, 0], [1.2, 0.8, 0.5], "fibre"),
  ...[0.18, 0.42, 0.66].flatMap((y) => [box([0, y, 0.251], [1.14, 0.2, 0.01], "composite"), box([0, y, 0.26], [0.2, 0.03, 0.02], "steel")]),
  box([0, 0.83, 0], [1.24, 0.03, 0.54], "dark"),
  box([0, 1.3, -0.2], [0.8, 0.9, 0.03], "mirror"),
  box([0, 1.3, -0.215], [0.88, 0.98, 0.02], "fibre"),
  cyl([0.42, 0.95, 0.05], 0.12, 0.2, "accent"),
  ...foliage(0.42, 1.12, 0.05, 0.3),
]);
item("coffee_table", "Coffee table", [
  ...table(1.1, 0.6, 0.42, "fibre", "dark"),
  box([-0.25, 0.44, 0.02], [0.3, 0.03, 0.22], "accent"),
  box([-0.25, 0.47, 0.02], [0.26, 0.03, 0.2], "cream"),
  cyl([0.3, 0.46, -0.05], 0.09, 0.09, "white"),
]);
item("kitchenette", "Kitchenette", [
  box([0, 0.44, 0], [2.4, 0.88, 0.62], "fibre"),
  ...[-0.9, -0.3, 0.3, 0.9].map((x) => box([x, 0.44, 0.311], [0.56, 0.78, 0.01], "composite")),
  box([0, 0.9, 0], [2.44, 0.04, 0.66], "stone"),
  // The sink and its tap, and a two-ring hob.
  box([-0.6, 0.905, 0.02], [0.5, 0.02, 0.4], "steel"),
  box([-0.6, 1.02, -0.2], [0.04, 0.22, 0.04], "steel"),
  ...[0.45, 0.8].map((x) => cyl([x, 0.925, 0.02], 0.22, 0.01, "dark")),
  // Wall cupboards, and a light under them.
  box([0, 1.85, -0.14], [2.4, 0.7, 0.34], "fibre"),
  ...[-0.9, -0.3, 0.3, 0.9].map((x) => box([x, 1.85, 0.031], [0.56, 0.64, 0.01], "composite")),
  box([0, 1.49, -0.05], [2.2, 0.02, 0.1], "lamp", glow),
  cyl([0.15, 0.99, -0.15], 0.18, 0.14, "accent"),
]);
item("bathroom_pod", "Bathroom", [
  // A little room in the room: panelled walls, a door, a light over it.
  box([0, 1.2, -0.78], [2.2, 2.4, 0.04], "panel"),
  ...[-1, 1].map((sx) => box([sx * 1.08, 1.2, 0], [0.04, 2.4, 1.6], "panel")),
  box([0.5, 1.2, 0.78], [1.2, 2.4, 0.04], "panel"),
  box([-0.55, 1.05, 0.79], [0.8, 2.1, 0.04], "accent"),
  box([-0.3, 1.05, 0.815], [0.03, 0.18, 0.03], "steel"),
  box([-0.55, 2.28, 0.78], [0.9, 0.24, 0.04], "panel"),
  box([0, 2.42, 0], [2.24, 0.04, 1.64], "white"),
  box([0.5, 2.1, 0.81], [0.5, 0.12, 0.02], "lamp", glow),
]);
item("bathtub", "Bathtub", [
  box([0, 0.28, 0], [1.7, 0.56, 0.8], "white"),
  box([0, 0.5, 0], [1.5, 0.08, 0.6], "water"),
  box([0, 0.58, 0], [1.72, 0.04, 0.82], "white"),
  box([-0.78, 0.72, 0], [0.06, 0.26, 0.06], "steel"),
  box([-0.72, 0.84, 0], [0.16, 0.04, 0.04], "steel"),
  box([0.5, 0.62, 0.3], [0.3, 0.05, 0.2], "cream"),
]);
item("fireplace", "Fireplace", [
  box([0, 0.55, 0], [1.4, 1.1, 0.4], "stone"),
  box([0, 0.42, 0.18], [0.9, 0.5, 0.06], "dark"),
  box([0, 0.36, 0.2], [0.8, 0.22, 0.04], "fire", glow),
  ...[-0.2, 0.05, 0.25].map((x) => box([x, 0.24, 0.2], [0.22, 0.06, 0.08], "fibre")),
  box([0, 1.12, 0.02], [1.5, 0.06, 0.46], "fibre"),
  ...[-0.5, 0.45].map((x) => cyl([x, 1.25, 0], 0.08, 0.2, "accent")),
]);
item("piano", "Piano", [
  box([0, 0.65, -0.1], [1.5, 1.3, 0.4], "dark"),
  box([0, 0.72, 0.16], [1.4, 0.08, 0.3], "dark"),
  box([0, 0.77, 0.2], [1.3, 0.02, 0.18], "white"),
  box([0, 0.78, 0.16], [1.3, 0.01, 0.07], "dark"),
  ...[-1, 1].map((sx) => box([sx * 0.66, 0.36, 0.2], [0.08, 0.72, 0.08], "dark")),
  box([0, 1.32, -0.1], [1.52, 0.04, 0.42], "fibre"),
  box([0, 0.46, 0.55], [0.9, 0.06, 0.34], "cushion"),
  ...[-1, 1].map((sx) => box([sx * 0.4, 0.22, 0.55], [0.06, 0.44, 0.3], "dark")),
]);
item("laundry_machine", "Washer", [
  box([0, 0.45, 0], [0.7, 0.9, 0.65], "white"),
  cyl([0, 0.45, 0.33], 0.46, 0.02, "dark", { r: [90, 0, 0] }),
  cyl([0, 0.45, 0.335], 0.36, 0.02, "mirror", { r: [90, 0, 0] }),
  box([0, 0.82, 0.326], [0.6, 0.1, 0.01], "panel"),
  box([0.2, 0.82, 0.332], [0.08, 0.05, 0.005], "glow", glow),
]);

// =====================================================================
// Food
// =====================================================================

item("stove_counter", "Stove counter", [
  box([0, 0.43, 0], [2.0, 0.86, 0.7], "panel"),
  box([0, 0.9, 0], [2.02, 0.06, 0.72], "steel"),
  ...[-0.75, -0.35].flatMap((x) => [-0.15, 0.15].map((z) => cyl([x, 0.94, z], 0.24, 0.02, "dark"))),
  cyl([-0.75, 1.02, 0.15], 0.28, 0.14, "steel"),
  cyl([-0.35, 1.0, -0.15], 0.3, 0.1, "dark"),
  box([0.45, 0.45, 0.352], [0.8, 0.5, 0.01], "dark"),
  box([0.45, 0.45, 0.356], [0.6, 0.3, 0.005], "fire", glow),
  box([0.45, 0.76, 0.36], [0.6, 0.03, 0.03], "steel"),
  box([0, 2.05, -0.18], [2.0, 0.4, 0.34], "steel"),
  box([0, 1.84, -0.1], [1.8, 0.04, 0.2], "lamp", glow),
]);
item("prep_counter", "Prep counter", [
  box([0, 0.43, 0], [2.0, 0.86, 0.7], "panel"),
  box([0, 0.9, 0], [2.02, 0.05, 0.72], "steel"),
  box([-0.5, 0.9, 0.02], [0.6, 0.02, 0.45], "water"),
  cyl([-0.5, 1.05, -0.25], 0.04, 0.3, "steel"),
  box([0.45, 0.94, 0.05], [0.5, 0.03, 0.35], "composite"),
  ...[0.3, 0.45, 0.6].map((x) => sph([x, 0.99, 0.05], 0.08, x === 0.45 ? "rust" : "leaf")),
  box([0, 0.45, 0.352], [1.8, 0.04, 0.01], "accent"),
  box([0, 1.6, -0.3], [2.0, 0.04, 0.1], "steel"),
  ...[-0.7, -0.3, 0.1].map((x) => cyl([x, 1.68, -0.3], 0.12, 0.14, "white")),
]);
item("fridge", "Fridge", [
  box([0, 1.0, 0], [0.9, 2.0, 0.75], "white"),
  box([0, 1.3, 0.376], [0.86, 0.02, 0.01], "dark"),
  ...[1.6, 0.8].map((y) => box([0.35, y, 0.39], [0.04, 0.4, 0.04], "steel")),
  box([-0.2, 1.75, 0.378], [0.2, 0.12, 0.01], "glow", glow),
]);
item("dining_table", "Dining table", [
  ...table(2.4, 0.9, 0.75),
  ...[-1, 1].map((sz) => box([0, 0.45, sz * 0.78], [2.2, 0.06, 0.36], "accent")),
  ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => box([sx * 1.0, 0.22, sz * 0.78], [0.06, 0.44, 0.3], "metal"))),
  ...[-0.7, 0, 0.7].flatMap((x) => [-1, 1].map((sz) => box([x, 0.77, sz * 0.25], [0.32, 0.02, 0.24], "white"))),
  cyl([0, 0.82, 0], 0.12, 0.12, "accent"),
]);
item("serving_counter", "Serving counter", [
  box([0, 0.5, 0], [2.4, 1.0, 0.7], "accent"),
  box([0, 1.03, 0], [2.44, 0.06, 0.74], "steel"),
  ...[-0.8, -0.27, 0.27, 0.8].map((x) => box([x, 1.07, 0.05], [0.45, 0.04, 0.5], "steel")),
  ...[-0.8, -0.27, 0.27, 0.8].map((x, i) => box([x, 1.1, 0.05], [0.38, 0.03, 0.42], ["rust", "leaf", "cream", "soil"][i])),
  box([0, 1.45, -0.05], [2.3, 0.04, 0.5], "mirror"),
  ...[-1.1, 1.1].map((x) => box([x, 1.25, -0.05], [0.04, 0.4, 0.04], "steel")),
  box([0, 2.3, -0.3], [1.6, 0.5, 0.06], "dark"),
  box([0, 2.3, -0.265], [1.5, 0.42, 0.01], "glow", glow),
]);
item("water_dispenser", "Water dispenser", [box([0, 0.5, 0], [0.4, 1.0, 0.4], "white"), cyl([0, 1.2, 0], 0.32, 0.45, "water"), box([0, 0.75, 0.205], [0.2, 0.12, 0.02], "dark"), box([0, 0.85, 0.21], [0.06, 0.04, 0.02], "glow", glow)]);
// Farms: a planter bed and a hydroponic rack for every crop. The plain ids are leafy greens;
// the others (planter_bed_wheat, ...) swap in for a farm growing that crop, in the same footprint.
const CROPS = ["potatoes", "soybeans", "wheat", "barley", "leafyGreens", "mushrooms", "algae", "hemp"];
const CROP_NAMES = { potatoes: "potatoes", soybeans: "soybeans", wheat: "wheat", barley: "barley", leafyGreens: "leafy greens", mushrooms: "mushrooms", algae: "algae", hemp: "fiber hemp" };

/** A crop growing over a patch w × d whose soil is at height y: its plants, as parts. */
function cropParts(crop, w, d, y, scale = 1) {
  const cols = Math.max(2, Math.round(w / (0.5 * scale)));
  const rows = Math.max(1, Math.round(d / (0.5 * scale)));
  const at = (i, j) => [(-w / 2) + (w / cols) * (i + 0.5), -d / 2 + (d / rows) * (j + 0.5)];
  const grid = (f) => Array.from({ length: cols }, (_, i) => Array.from({ length: rows }, (_, j) => f(...at(i, j), i, j))).flat(2);
  const k = scale;
  switch (crop) {
    case "potatoes":
      // Low bushy mounds, a few white flowers.
      return grid((x, z, i, j) => [
        sph([x, y + 0.08 * k, z], 0.3 * k, "soil"),
        sph([x, y + 0.2 * k, z], 0.36 * k, "potato"),
        sph([x + 0.08 * k, y + 0.28 * k, z - 0.05 * k], 0.22 * k, "leaf"),
        ...((i + j) % 2 ? [sph([x - 0.06 * k, y + 0.38 * k, z + 0.05 * k], 0.06 * k, "flower")] : []),
      ]);
    case "soybeans":
      // Upright bushes, pods hanging.
      return grid((x, z) => [
        cyl([x, y + 0.2 * k, z], 0.03 * k, 0.4 * k, "plant"),
        sph([x, y + 0.42 * k, z], 0.3 * k, "soy"),
        sph([x + 0.06 * k, y + 0.55 * k, z], 0.2 * k, "leaf"),
        box([x + 0.1 * k, y + 0.3 * k, z + 0.08 * k], [0.03 * k, 0.1 * k, 0.03 * k], "soy"),
        box([x - 0.1 * k, y + 0.26 * k, z - 0.06 * k], [0.03 * k, 0.1 * k, 0.03 * k], "soy"),
      ]);
    case "wheat":
    case "barley": {
      // Close-set stalks, each with its ear; barley's nod and are paler.
      const ear = crop === "wheat" ? "wheat" : "barley";
      const stalks = [];
      // Spaced the same on a shelf as in a bed, so a rack doesn't need hundreds of stalks.
      const n = Math.max(3, Math.round(w / 0.2));
      const m = Math.max(2, Math.round(d / 0.25));
      for (let i = 0; i < n; i++)
        for (let j = 0; j < m; j++) {
          const x = -w / 2 + (w / n) * (i + 0.5) + ((j % 2) * w) / n / 2;
          const z = -d / 2 + (d / m) * (j + 0.5);
          const h = (0.55 + ((i * 7 + j * 3) % 5) * 0.03) * k;
          stalks.push(cyl([x, y + h / 2, z], 0.015 * k, h, "stalk"));
          stalks.push(box([x, y + h + 0.05 * k, z + (crop === "barley" ? 0.03 * k : 0)], [0.04 * k, 0.12 * k, 0.03 * k], ear, crop === "barley" ? { r: [25, 0, 0] } : {}));
        }
      return stalks;
    }
    case "hemp": {
      // Tall bare stalks, fans of narrow leaves at the top, a pointed tip.
      const plants = [];
      const n = Math.max(3, Math.round(w / 0.3));
      const m = Math.max(2, Math.round(d / 0.3));
      for (let i = 0; i < n; i++)
        for (let j = 0; j < m; j++) {
          const x = -w / 2 + (w / n) * (i + 0.5) + ((j % 2) * w) / n / 4;
          const z = -d / 2 + (d / m) * (j + 0.5);
          const h = (0.8 + ((i * 5 + j * 3) % 4) * 0.04) * k;
          const turn = ((i + j) % 3) * 20;
          plants.push(cyl([x, y + h / 2, z], 0.018 * k, h, "hemp"));
          for (const a of [0, 60, 120]) plants.push(box([x, y + h * 0.82, z], [0.34 * k, 0.015 * k, 0.05 * k], "hempLeaf", { r: [0, a + turn, 12] }));
          plants.push(box([x, y + h + 0.04 * k, z], [0.05 * k, 0.12 * k, 0.05 * k], "hempLeaf"));
        }
      return plants;
    }
    case "mushrooms":
      // Dark substrate blocks, caps on short stems.
      return grid((x, z, i, j) => [
        box([x, y + 0.06 * k, z], [0.4 * k, 0.12 * k, 0.4 * k], "substrate"),
        ...[-0.1, 0.1].flatMap((dx) => [
          cyl([x + dx * k, y + 0.16 * k, z + dx * 0.5 * k], 0.04 * k, 0.1 * k, "mushroom"),
          cyl([x + dx * k, y + 0.22 * k, z + dx * 0.5 * k], ((i + j) % 2 ? 0.14 : 0.1) * k, 0.04 * k, "cap"),
        ]),
      ]);
    case "algae":
      // Green water in a glass trough, bubbling.
      return [
        box([0, y + 0.15 * k, 0], [w * 0.96, 0.3 * k, d * 0.9], "algae"),
        ...grid((x, z) => [sph([x, y + 0.31 * k, z], 0.06 * k, "white")]),
      ];
    default:
      // Leafy greens: round heads of leaves.
      return grid((x, z) => [sph([x, y + 0.17 * k, z], 0.34 * k, "plant"), sph([x + 0.05 * k, y + 0.29 * k, z + 0.05 * k], 0.2 * k, "leaf")]);
  }
}

/** A raised bed under a grow light (none for mushrooms, which grow dark), planted with a crop. */
function planterBed(crop) {
  const glass = crop === "algae";
  return [
    box([0, 0.3, 0], [2.6, 0.6, 1.1], glass ? "mirror" : "panel"),
    box([0, 0.3, 0.556], [2.6, 0.08, 0.01], "accent"),
    ...(glass ? [] : [box([0, 0.61, 0], [2.5, 0.02, 1.0], crop === "mushrooms" ? "substrate" : "soil")]),
    ...cropParts(crop, 2.4, 0.9, 0.62),
    ...[-1, 1].map((sx) => cyl([sx * 1.25, 1.6, 0], 0.05, 2.0, "metal")),
    box([0, 2.55, 0], [2.6, 0.08, 0.3], "dark"),
    ...(crop === "mushrooms" ? [] : [box([0, 2.5, 0], [2.4, 0.02, 0.24], "grow", glow)]),
    cyl([0, 0.66, 0.5], 0.04, 2.5, "water", { r: [0, 0, 90] }),
  ];
}

/** Three shelves of a crop under their own lights. */
function hydroponicRack(crop) {
  return [
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => box([sx * 0.95, 1.25, sz * 0.3], [0.05, 2.5, 0.05], "metal"))),
    ...[0.3, 1.1, 1.9].flatMap((y) => [
      box([0, y, 0], [1.95, 0.08, 0.62], crop === "algae" ? "mirror" : "white"),
      ...cropParts(crop, 1.8, 0.5, y + 0.04, 0.55),
      ...(crop === "mushrooms" ? [] : [box([0, y + 0.6, 0], [1.8, 0.03, 0.3], "grow", glow)]),
    ]),
    cyl([0.9, 1.2, 0.3], 0.05, 2.2, "water"),
  ];
}

for (const crop of CROPS) {
  const suffix = crop === "leafyGreens" ? "" : `_${crop}`;
  const name = crop === "leafyGreens" ? "" : ` (${CROP_NAMES[crop]})`;
  item(`planter_bed${suffix}`, `Planter bed${name}`, planterBed(crop));
  item(`hydroponic_rack${suffix}`, `Hydroponic rack${name}`, hydroponicRack(crop));
}
item("seed_table", "Seedling bench", [
  ...table(2.0, 0.8, 0.85, "steel"),
  ...[-0.7, -0.23, 0.23, 0.7].map((x) => box([x, 0.9, 0], [0.4, 0.05, 0.6], "dark")),
  ...[-0.7, -0.23, 0.23, 0.7].flatMap((x) => [-0.15, 0.15].map((z) => sph([x, 0.97, z], 0.1, "leaf"))),
  box([0, 0.3, 0], [1.9, 0.03, 0.7], "metal"),
  ...[-0.5, 0.2].map((x) => box([x, 0.42, 0], [0.5, 0.2, 0.4], "soil")),
]);
item("tool_cart", "Tool cart", [
  ...legs(0.9, 0.55, 0.9, "metal", 0.03),
  ...[0.2, 0.55, 0.9].map((y) => box([0, y, 0], [0.86, 0.03, 0.5], "accent")),
  box([-0.15, 0.62, 0], [0.3, 0.12, 0.2], "hazard"),
  box([0.2, 0.96, 0], [0.3, 0.1, 0.2], "metal"),
  ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => cyl([sx * 0.4, 0.05, sz * 0.22], 0.1, 0.04, "dark", { r: [0, 0, 90] }))),
]);
item("compost_bin", "Compost bin", [
  box([0, 0.55, 0], [1.3, 1.1, 1.3], "accent"),
  box([0, 1.15, -0.1], [1.34, 0.08, 1.1], "dark", { r: [-12, 0, 0] }),
  box([0, 0.55, 0.652], [1.32, 0.04, 0.02], "dark"),
  box([0, 0.2, 0.652], [0.5, 0.3, 0.02], "soil"),
]);
item("compost_drum", "Compost drum", [
  box([0, 0.2, 0], [1.4, 0.4, 0.9], "metal"),
  cyl([0, 0.9, 0], 1.0, 1.5, "accent", { r: [0, 0, 90] }),
  ...[-0.5, 0, 0.5].map((x) => cyl([x, 0.9, 0], 1.04, 0.06, "dark", { r: [0, 0, 90] })),
  cyl([0.8, 0.9, 0], 0.4, 0.2, "steel", { r: [0, 0, 90] }),
]);
item("soil_sacks", "Soil sacks", [
  box([0, 0.05, 0], [1.3, 0.1, 0.9], "composite"),
  box([-0.3, 0.2, 0], [0.6, 0.2, 0.82], "soil"),
  box([0.33, 0.2, 0], [0.6, 0.2, 0.82], "soil"),
  box([0, 0.4, 0], [0.6, 0.2, 0.82], "soil"),
  box([0.02, 0.58, 0.05], [0.6, 0.18, 0.78], "rust"),
]);

// =====================================================================
// Water, air, power
// =====================================================================

item("big_tank", "Storage tank", [
  cyl([0, 1.6, 0], 2.8, 3.0, "steel"),
  cyl([0, 1.9, 0], 2.84, 0.3, "accent"),
  cyl([0, 3.15, 0], 2.4, 0.3, "metal"),
  cyl([0, 0.08, 0], 3.0, 0.16, "dark"),
  cyl([0.9, 3.35, 0.9], 0.2, 0.2, "dark"),
  // A ladder up its side, and a gauge.
  ...[-0.22, 0.22].map((x) => box([x, 1.6, 1.44], [0.04, 3.0, 0.04], "metal")),
  ...[0.4, 0.8, 1.2, 1.6, 2.0, 2.4, 2.8].map((y) => box([0, y, 1.44], [0.44, 0.03, 0.03], "metal")),
  box([-0.9, 1.3, 1.12], [0.3, 0.3, 0.04], "dark", { r: [0, 38, 0] }),
]);
item("pipe_run", "Pipe run", [
  cyl([0, 0.6, 0], 0.25, 3.0, "metal", { r: [0, 0, 90] }),
  cyl([0, 0.3, 0.05], 0.18, 3.0, "accent", { r: [0, 0, 90] }),
  ...[-1.2, 0, 1.2].map((x) => box([x, 0.4, 0], [0.08, 0.8, 0.4], "dark")),
  ...[-0.6, 0.6].map((x) => cyl([x, 0.6, 0], 0.32, 0.08, "steel", { r: [0, 0, 90] })),
  cyl([0.6, 0.85, 0.12], 0.18, 0.04, "hazard", { r: [90, 0, 0] }),
]);
item("valve_panel", "Valve panel", [
  box([0, 0.9, 0], [1.2, 1.8, 0.3], "dark"),
  ...[-0.3, 0.3].map((x) => cyl([x, 1.1, 0.2], 0.28, 0.04, "hazard", { r: [90, 0, 0] })),
  ...[-0.3, 0.3].map((x) => cyl([x, 0.5, 0.16], 0.12, 0.3, "metal", { r: [90, 0, 0] })),
  box([0, 1.55, 0.155], [0.8, 0.25, 0.01], "glow", glow),
]);
item("pump", "Pump", [
  box([0, 0.1, 0], [1.3, 0.2, 0.8], "dark"),
  cyl([-0.2, 0.55, 0], 0.6, 0.8, "accent", { r: [0, 0, 90] }),
  ...[-0.45, -0.2, 0.05].map((x) => cyl([x, 0.55, 0], 0.64, 0.04, "dark", { r: [0, 0, 90] })),
  cyl([0.4, 0.55, 0], 0.4, 0.3, "metal", { r: [0, 0, 90] }),
  cyl([0.4, 0.9, 0], 0.15, 0.4, "metal"),
]);
item("filter_column", "Filter column", [
  cyl([0, 1.45, 0], 1.0, 2.7, "water"),
  cyl([0, 2.85, 0], 1.1, 0.3, "metal"),
  cyl([0, 0.1, 0], 1.1, 0.2, "metal"),
  ...[0.9, 1.6, 2.3].map((y) => cyl([0, y, 0], 1.04, 0.08, "accent")),
  box([0, 1.2, 0.52], [0.25, 0.4, 0.02], "glow", glow),
]);
item("console", "Control console", [
  box([0, 0.45, 0], [1.3, 0.9, 0.7], "dark"),
  box([0, 1.0, 0.05], [1.3, 0.1, 0.8], "panel", { r: [-20, 0, 0] }),
  box([0, 1.05, 0.08], [1.1, 0.02, 0.5], "glow", { r: [-20, 0, 0], glow: true }),
  box([0, 0.45, 0.352], [1.1, 0.04, 0.01], "accent"),
  ...monitor(0, 1.45, -0.25, 0.7),
]);
item("toilet_stall", "Toilet stall", [
  ...[-1, 1].map((sx) => box([sx * 0.53, 1.05, 0], [0.04, 2.1, 1.5], "panel")),
  box([0, 1.05, -0.73], [1.1, 2.1, 0.04], "panel"),
  box([0.1, 1.0, 0.73], [0.8, 1.9, 0.04], "accent"),
  box([0.4, 1.0, 0.76], [0.04, 0.12, 0.03], "steel"),
  cyl([0, 0.22, -0.45], 0.42, 0.44, "white"),
  box([0, 0.55, -0.66], [0.4, 0.3, 0.12], "white"),
  box([0.4, 0.9, -0.5], [0.14, 0.14, 0.1], "steel"),
]);
item("sink_basin", "Washbasins", [
  box([0, 0.4, 0], [1.8, 0.8, 0.5], "panel"),
  box([0, 0.83, 0], [1.82, 0.06, 0.55], "white"),
  ...[-0.45, 0.45].map((x) => cyl([x, 0.86, 0.02], 0.4, 0.02, "water")),
  ...[-0.45, 0.45].map((x) => cyl([x, 0.98, -0.18], 0.04, 0.22, "steel")),
  ...[-0.45, 0.45].map((x) => box([x, 1.5, -0.24], [0.6, 0.8, 0.02], "mirror")),
  box([0, 1.95, -0.22], [1.6, 0.05, 0.08], "lamp", glow),
]);
item("shower_stall", "Shower", [
  box([0, 0.05, 0], [1.1, 0.1, 1.1], "white"),
  box([-0.53, 1.1, 0], [0.04, 2.2, 1.1], "panel"),
  box([0, 1.1, -0.53], [1.1, 2.2, 0.04], "panel"),
  box([0.53, 1.1, 0], [0.02, 2.0, 1.1], "mirror"),
  box([0, 1.1, 0.53], [0.6, 2.0, 0.02], "mirror"),
  cyl([0, 2.0, -0.35], 0.25, 0.05, "steel"),
  cyl([0, 1.6, -0.5], 0.04, 0.8, "steel"),
]);
item("scrubber_unit", "CO2 scrubber", [
  box([0, 1.3, 0], [2.4, 2.6, 1.3], "accent"),
  box([0, 1.0, 0.66], [2.0, 1.4, 0.02], "dark"),
  ...[-0.5, 0.5].map((x) => cyl([x, 1.0, 0.68], 0.6, 0.04, "metal", { r: [90, 0, 0] })),
  ...[-0.5, 0.5].map((x) => cyl([x, 1.0, 0.7], 0.2, 0.04, "dark", { r: [90, 0, 0] })),
  box([0, 2.3, 0.66], [1.2, 0.2, 0.01], "glow", glow),
  cyl([0.8, 3.0, -0.3], 0.35, 0.8, "metal"),
  box([0, 2.62, 0], [2.44, 0.05, 1.34], "dark"),
]);
item("gas_bottles", "Gas bottles", [
  box([0, 0.05, 0], [1.3, 0.1, 0.6], "dark"),
  ...[["white", -0.45], ["leaf", -0.15], ["white", 0.15], ["leaf", 0.45]].map(([c, x]) => cyl([x, 0.8, 0], 0.26, 1.4, c)),
  ...[-0.45, -0.15, 0.15, 0.45].map((x) => sph([x, 1.52, 0], 0.22, "metal")),
  box([0, 1.1, -0.2], [1.3, 0.05, 0.05], "metal"),
  box([0, 1.1, 0.16], [1.3, 0.03, 0.03], "hazard"),
]);
item("big_fan", "Air handler", [
  box([0, 0.15, 0], [1.4, 0.3, 0.7], "dark"),
  cyl([0, 1.1, 0], 1.6, 0.6, "metal", { r: [90, 0, 0] }),
  cyl([0, 1.1, 0.02], 1.4, 0.62, "dark", { r: [90, 0, 0] }),
  ...[0, 60, 120].map((a) => box([0, 1.1, 0.1], [1.3, 0.12, 0.04], "accent", { r: [0, 0, a] })),
  cyl([0, 1.1, 0.12], 0.24, 0.06, "steel", { r: [90, 0, 0] }),
  box([0, 1.1, 0.33], [1.6, 0.04, 0.02], "metal"),
  box([0, 1.1, 0.33], [0.04, 1.6, 0.02], "metal"),
]);
item("duct_riser", "Air duct", [
  box([0, 2.0, 0], [0.9, 4.0, 0.7], "metal"),
  ...[0.6, 1.6, 2.6, 3.6].map((y) => box([0, y, 0], [0.94, 0.06, 0.74], "dark")),
  box([0, 0.9, 0.36], [0.6, 0.4, 0.02], "dark"),
  ...[0.8, 0.9, 1.0].map((y) => box([0, y, 0.372], [0.56, 0.02, 0.01], "metal")),
]);
item("battery_rack", "Battery rack", [
  box([0, 1.1, 0], [1.4, 2.2, 0.8], "dark"),
  ...[0.4, 0.8, 1.2, 1.6, 2.0].map((y) => box([0, y, 0.405], [1.2, 0.18, 0.01], "power", glow)),
  ...[0.4, 0.8, 1.2, 1.6, 2.0].map((y) => box([0.55, y, 0.41], [0.06, 0.1, 0.01], "glow", glow)),
  box([0, 2.25, 0], [1.3, 0.1, 0.2], "hazard"),
]);
item("inverter", "Inverter cabinet", [
  box([0, 0.9, 0], [1.0, 1.8, 0.6], "panel"),
  ...[0.4, 0.5, 0.6, 0.7].map((y) => box([0, y, 0.302], [0.8, 0.03, 0.01], "dark")),
  box([0, 1.4, 0.302], [0.4, 0.2, 0.01], "glow", glow),
  box([0, 1.1, 0.302], [0.9, 0.05, 0.01], "hazard"),
  cyl([0.3, 1.9, -0.15], 0.12, 0.2, "dark"),
]);
item("well_head", "Wellhead", [
  cyl([0, 0.15, 0], 1.8, 0.3, "dark"),
  box([0, 0.32, 0], [2.0, 0.04, 2.0], "hazard"),
  cyl([0, 0.8, 0], 0.8, 1.0, "accent"),
  cyl([0, 1.6, 0], 1.0, 0.6, "metal"),
  cyl([0, 2.2, 0], 0.3, 0.8, "metal"),
  cyl([0.6, 1.0, 0], 0.25, 1.2, "metal", { r: [0, 0, 90] }),
  cyl([0, 1.9, 0.52], 0.3, 0.04, "hazard", { r: [90, 0, 0] }),
]);

// =====================================================================
// Industry
// =====================================================================

item("furnace", "Furnace", [
  box([0, 1.3, 0], [2.6, 2.6, 2.4], "dark"),
  box([0, 0.9, 1.21], [1.0, 0.7, 0.02], "fire", glow),
  box([0, 1.3, 1.22], [1.4, 1.4, 0.02], "rust"),
  box([0, 0.9, 1.23], [1.1, 0.8, 0.01], "dark"),
  box([0, 0.9, 1.235], [0.9, 0.6, 0.01], "fire", glow),
  box([0, 2.7, 0], [2.0, 0.2, 1.8], "accent"),
  cyl([0.6, 3.3, -0.4], 0.5, 1.4, "metal"),
  ...[-1, 1].map((sx) => box([sx * 1.32, 1.3, 0.3], [0.06, 2.4, 0.2], "hazard")),
]);
item("ore_bin", "Ore bin", [
  box([0, 0.5, -0.6], [1.6, 1.0, 0.1], "metal"),
  ...[-1, 1].map((sx) => box([sx * 0.75, 0.5, 0], [0.1, 1.0, 1.3], "metal")),
  box([0, 0.3, 0.6], [1.6, 0.6, 0.1], "metal"),
  box([0, 0.05, 0], [1.6, 0.1, 1.3], "dark"),
  ...[-0.4, 0, 0.4].flatMap((x) => [-0.3, 0.1].map((z) => sph([x, 0.55, z], 0.4, "rust"))),
  ...[-0.2, 0.2].map((x) => sph([x, 0.8, -0.1], 0.3, "stone")),
]);
item("ingot_rack", "Ingot rack", [
  ...legs(1.6, 0.6, 1.25, "metal", 0.05),
  ...[0.4, 0.85, 1.25].map((y) => box([0, y, 0], [1.56, 0.04, 0.56], "dark")),
  ...[0.4, 0.85].flatMap((y) => [-0.5, -0.15, 0.2, 0.55].flatMap((x) => [box([x, y + 0.06, 0], [0.3, 0.08, 0.18], "copper"), box([x, y + 0.14, 0], [0.26, 0.08, 0.16], "copper")])),
]);
item("lathe", "Lathe", [
  box([0, 0.4, 0], [2.0, 0.8, 0.6], "dark"),
  box([0, 0.9, 0], [2.2, 0.15, 0.4], "metal"),
  box([-0.8, 1.15, 0], [0.5, 0.45, 0.45], "accent"),
  cyl([0, 1.1, 0], 0.12, 1.2, "steel", { r: [0, 0, 90] }),
  box([0.8, 1.1, 0], [0.3, 0.3, 0.35], "accent"),
  box([0.1, 1.05, 0.15], [0.3, 0.12, 0.2], "metal"),
  box([-0.8, 1.2, 0.23], [0.2, 0.15, 0.01], "glow", glow),
]);
item("workbench", "Workbench", [
  ...table(2.0, 0.8, 0.92, "composite", "dark"),
  box([0, 0.3, 0], [1.9, 0.03, 0.7], "dark"),
  box([0.75, 1.0, 0.25], [0.25, 0.15, 0.2], "metal"),
  box([-0.4, 0.97, 0], [0.4, 0.06, 0.25], "hazard"),
  box([-0.1, 0.4, 0], [0.5, 0.2, 0.4], "accent"),
  box([0, 1.5, -0.36], [2.0, 1.0, 0.04], "composite"),
  ...[-0.7, -0.4, -0.1, 0.3, 0.6].map((x) => box([x, 1.55, -0.32], [0.05, 0.4, 0.04], "metal")),
  box([0, 2.05, -0.3], [1.8, 0.04, 0.1], "lamp", glow),
]);
item("tool_wall", "Tool wall", [
  box([0, 1.2, 0], [2.0, 1.4, 0.05], "composite"),
  ...[-0.7, -0.4, -0.1, 0.3, 0.6].map((x) => box([x, 1.3, 0.05], [0.06, 0.5, 0.04], "metal")),
  ...[-0.5, 0.4].map((x) => box([x, 1.7, 0.05], [0.3, 0.06, 0.04], "hazard")),
  box([0.2, 0.8, 0.06], [0.5, 0.2, 0.05], "accent"),
]);
item("drill_press", "Drill press", [
  box([0, 0.05, 0], [0.7, 0.1, 0.7], "dark"),
  cyl([0, 0.95, -0.2], 0.1, 1.8, "metal"),
  box([0, 0.8, 0.05], [0.45, 0.05, 0.45], "metal"),
  box([0, 1.6, 0.05], [0.4, 0.4, 0.55], "accent"),
  cyl([0, 1.25, 0.15], 0.05, 0.3, "steel"),
  cyl([0.25, 1.5, 0.1], 0.03, 0.3, "metal", { r: [0, 0, 90] }),
]);
item("welding_station", "Welding bay", [
  ...table(1.6, 0.9, 0.85, "dark"),
  box([0, 0.95, 0], [0.8, 0.12, 0.3], "rust"),
  box([-0.9, 1.0, 0], [0.04, 2.0, 1.0], "accent"),
  box([0.55, 0.3, -0.2], [0.5, 0.6, 0.4], "hazard"),
  cyl([0.55, 0.9, -0.2], 0.2, 0.6, "leaf"),
  sph([0.1, 1.0, 0.1], 0.08, "fire", glow),
]);
item("printer_3d", "3D printer", [
  box([0, 0.4, 0], [1.0, 0.8, 0.9], "dark"),
  ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => box([sx * 0.45, 1.25, sz * 0.4], [0.05, 0.9, 0.05], "metal"))),
  box([0, 1.72, 0], [1.0, 0.06, 0.9], "metal"),
  box([0, 0.85, 0], [0.8, 0.04, 0.7], "steel"),
  box([0.1, 0.95, 0.05], [0.3, 0.15, 0.25], "accent"),
  box([0, 1.4, 0], [0.9, 0.04, 0.06], "metal"),
  box([0.1, 1.33, 0], [0.12, 0.12, 0.12], "hazard"),
  box([0, 0.5, 0.451], [0.3, 0.15, 0.01], "glow", glow),
]);
item("reactor_vessel", "Reactor vessel", [
  cyl([0, 0.15, 0], 2.0, 0.3, "dark"),
  cyl([0, 1.5, 0], 1.6, 2.4, "steel"),
  sph([0, 2.7, 0], 1.6, "steel"),
  cyl([0, 1.5, 0], 1.64, 0.2, "accent"),
  cyl([0, 3.3, 0], 0.2, 0.6, "metal"),
  box([0, 1.2, 0.8], [0.4, 0.3, 0.02], "fire", glow),
  cyl([0.7, 2.3, 0], 0.15, 1.6, "metal", { r: [0, 0, 60] }),
]);
item("crystal_puller", "Crystal puller", [
  cyl([0, 0.4, 0], 1.2, 0.8, "dark"),
  cyl([0, 1.1, 0], 0.9, 0.6, "steel"),
  cyl([0, 2.0, 0], 0.5, 1.2, "mirror"),
  cyl([0, 2.0, 0], 0.2, 1.0, "board", { glow: true }),
  cyl([0, 3.0, 0], 0.6, 0.6, "metal"),
  cyl([0, 3.6, 0], 0.08, 0.6, "metal"),
  box([0.75, 1.0, 0], [0.3, 1.6, 0.6], "accent"),
  box([0.905, 1.3, 0], [0.01, 0.3, 0.4], "glow", glow),
]);
item("clean_hood", "Clean hood", [
  box([0, 0.45, 0], [1.8, 0.9, 0.9], "white"),
  box([0, 1.95, 0], [1.8, 0.7, 0.9], "white"),
  box([0, 1.25, 0.44], [1.7, 0.7, 0.02], "mirror"),
  box([0, 1.25, 0], [1.6, 0.6, 0.02], "glow", glow),
  box([0, 0.92, 0.1], [1.6, 0.04, 0.6], "steel"),
  box([0, 2.0, 0.451], [1.4, 0.1, 0.01], "accent"),
]);
item("fab_bench", "Fab bench", [
  ...table(2.0, 0.8, 0.92, "white", "metal"),
  box([-0.5, 1.07, -0.1], [0.5, 0.26, 0.4], "dark"),
  box([0.3, 1.0, 0.05], [0.4, 0.12, 0.3], "accent"),
  ...monitor(0.7, 1.2, -0.25, 0.45),
  box([0, 0.3, 0], [1.9, 0.03, 0.7], "metal"),
  cyl([-0.5, 1.4, 0.05], 0.03, 0.4, "metal", { r: [30, 0, 0] }),
  sph([-0.5, 1.55, 0.15], 0.12, "lamp", glow),
]);
item("component_cabinet", "Parts cabinet", [
  box([0, 0.9, 0], [1.2, 1.8, 0.5], "panel"),
  ...[0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6].flatMap((y) => [-0.3, 0.3].map((x) => box([x, y, 0.251], [0.5, 0.16, 0.01], y % 0.4 < 0.1 ? "accent" : "white"))),
]);
item("mixer_drum", "Mixer", [
  box([0, 0.3, 0], [2.2, 0.6, 1.4], "dark"),
  cyl([0, 1.4, 0], 1.3, 1.9, "accent", { r: [0, 0, 70] }),
  ...[-0.4, 0.4].map((d) => cyl([d * Math.cos(1.22), 1.4 + d * Math.sin(1.22), 0], 1.34, 0.08, "dark", { r: [0, 0, 70] })),
  cyl([0.8, 1.7, 0], 0.7, 0.3, "metal", { r: [0, 0, 70] }),
]);
item("hopper", "Hopper", [
  ...legs(1.8, 1.8, 1.2, "metal", 0.12),
  box([0, 2.0, 0], [1.8, 1.4, 1.8], "accent"),
  cyl([0, 1.1, 0], 0.5, 0.6, "metal"),
  box([0, 2.72, 0], [1.9, 0.06, 1.9], "dark"),
  box([0, 2.0, 0.905], [1.2, 0.2, 0.01], "hazard"),
]);
item("bag_stack", "Cement bags", [box([0, 0.06, 0], [1.3, 0.12, 1.0], "composite"), ...[0, 1, 2].flatMap((k) => [-0.31, 0.31].map((x) => box([x, 0.24 + 0.24 * k, 0], [0.6, 0.22, 0.9], "stone")))]);
item("mold_forms", "Mould forms", [...[-0.55, 0.55].flatMap((x) => [box([x, 0.3, 0], [0.95, 0.6, 1.2], "composite"), box([x, 0.58, 0], [0.8, 0.02, 1.05], "stone")])]);
item("conveyor", "Conveyor", [
  ...[-1.2, 0, 1.2].flatMap((x) => [-1, 1].map((sz) => box([x, 0.4, sz * 0.35], [0.06, 0.8, 0.06], "metal"))),
  box([0, 0.82, 0], [3.0, 0.08, 0.8], "dark"),
  box([0, 0.87, 0], [2.9, 0.02, 0.6], "rubber"),
  ...[-1, 1].map((sz) => box([0, 0.9, sz * 0.38], [3.0, 0.1, 0.04], "hazard")),
  ...[-0.8, 0.3].map((x) => box([x, 1.05, 0], [0.5, 0.3, 0.45], "composite")),
]);

// =====================================================================
// Logistics and storage
// =====================================================================

item("cargo_crate", "Cargo crate", [
  box([0, 0.6, 0], [1.2, 1.2, 1.2], "composite"),
  ...[0.15, 1.05].map((y) => box([0, y, 0], [1.22, 0.08, 1.22], "accent")),
  box([0, 0.6, 0.61], [0.5, 0.3, 0.01], "hazard"),
  box([0, 0.6, 0.615], [0.3, 0.12, 0.005], "dark"),
]);
item("crate_stack", "Crate stack", [
  box([-0.62, 0.6, 0], [1.2, 1.2, 1.2], "composite"),
  box([0.62, 0.5, 0], [1.2, 1.0, 1.15], "accent"),
  box([-0.55, 1.8, 0], [1.1, 1.2, 1.1], "composite"),
  box([0.6, 1.3, 0.05], [0.9, 0.6, 0.9], "composite"),
  box([-0.62, 0.6, 0.605], [0.5, 0.2, 0.01], "hazard"),
  box([0.62, 0.5, 0.58], [0.3, 0.3, 0.01], "dark"),
]);
item("pallet_rack", "Pallet rack", [
  ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => box([sx * 1.36, 1.6, sz * 0.5], [0.08, 3.2, 0.08], "hazard"))),
  ...[0.1, 1.1, 2.1, 3.1].map((y) => box([0, y, 0], [2.8, 0.08, 1.1], "metal")),
  box([-0.65, 0.55, 0], [1.1, 0.8, 0.9], "composite"),
  box([0.65, 0.5, 0], [1.1, 0.7, 0.9], "accent"),
  box([-0.6, 1.5, 0], [1.2, 0.7, 0.9], "accent"),
  box([0.7, 1.55, 0], [1.0, 0.8, 0.9], "composite"),
  box([0, 2.5, 0], [1.4, 0.7, 0.9], "composite"),
  ...[-0.9, 0.9].map((x) => cyl([x, 2.5, 0], 0.5, 0.75, "rust")),
]);
item("shelf_unit", "Shelving", [
  ...[-1, 1].map((sx) => box([sx * 0.68, 1.0, 0], [0.04, 2.0, 0.5], "metal")),
  ...[0.1, 0.6, 1.1, 1.6, 1.98].map((y) => box([0, y, 0], [1.4, 0.03, 0.5], "metal")),
  box([-0.35, 0.3, 0], [0.5, 0.36, 0.4], "composite"),
  box([0.3, 0.8, 0], [0.6, 0.36, 0.4], "accent"),
  box([-0.3, 1.3, 0], [0.4, 0.36, 0.4], "composite"),
  box([0.35, 1.25, 0], [0.4, 0.25, 0.35], "hazard"),
  box([0, 1.8, 0], [0.9, 0.3, 0.4], "composite"),
  cyl([0.4, 0.3, 0], 0.25, 0.36, "white"),
]);
item("cart", "Cargo cart", [
  box([0, 0.3, 0], [1.4, 0.1, 0.8], "accent"),
  ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => cyl([sx * 0.55, 0.12, sz * 0.32], 0.24, 0.1, "rubber", { r: [0, 0, 90] }))),
  box([-0.68, 0.8, 0], [0.05, 1.0, 0.7], "metal"),
  box([-0.68, 1.28, 0], [0.08, 0.05, 0.72], "dark"),
  box([0.2, 0.6, 0], [0.8, 0.5, 0.6], "composite"),
]);
item("pallet_jack", "Pallet jack", [
  ...[-1, 1].map((sz) => box([0.2, 0.08, sz * 0.25], [1.2, 0.08, 0.16], "hazard")),
  box([-0.5, 0.25, 0], [0.25, 0.4, 0.6], "hazard"),
  cyl([-0.55, 0.8, 0], 0.05, 1.0, "metal", { r: [0, 0, 20] }),
  box([-0.72, 1.28, 0], [0.06, 0.05, 0.4], "dark"),
  ...[-1, 1].map((sz) => cyl([0.7, 0.05, sz * 0.25], 0.1, 0.12, "rubber", { r: [90, 0, 0] })),
]);
item("barrel_group", "Barrels", [
  ...[[-0.35, -0.3, "accent"], [0.35, -0.3, "rust"], [0, 0.32, "metal"]].flatMap(([x, z, c]) => [cyl([x, 0.45, z], 0.6, 0.9, c), cyl([x, 0.3, z], 0.62, 0.04, "dark"), cyl([x, 0.62, z], 0.62, 0.04, "dark"), cyl([x, 0.91, z], 0.5, 0.02, "dark")]),
]);
item("kit_container", "Kit container", [
  box([0, 1.3, 0], [3.2, 2.6, 2.4], "accent"),
  ...[-1.2, -0.6, 0, 0.6, 1.2].map((x) => box([x, 1.3, 1.21], [0.06, 2.4, 0.02], "dark")),
  box([0, 2.62, 0], [3.2, 0.06, 2.4], "dark"),
  box([0, 2.0, 1.22], [1.0, 0.35, 0.01], "hazard"),
  ...[-0.3, 0.3].map((x) => box([x, 1.2, 1.235], [0.04, 1.4, 0.03], "steel")),
]);
item("girder_stack", "Girder stack", [
  ...[0, 1, 2].flatMap((k) => [-0.35, 0, 0.35].map((z) => box([0, 0.12 + 0.24 * k, z], [3.2, 0.2, 0.25], "rust"))),
  ...[-1.2, 1.2].map((x) => box([x, 0.02, 0], [0.12, 0.04, 1.1], "dark")),
]);
item("scaffold", "Scaffolding", [
  ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => box([sx * 1.2, 1.5, sz * 0.5], [0.06, 3.0, 0.06], "hazard"))),
  ...[1.0, 2.0].map((y) => box([0, y, 0], [2.5, 0.06, 1.05], "composite")),
  ...[-1, 1].map((sz) => box([0, 1.5, sz * 0.5], [2.5, 0.04, 0.04], "metal", { r: [0, 0, 38] })),
  box([0.4, 2.2, 0], [0.4, 0.3, 0.3], "accent"),
]);
item("blueprint_table", "Plan table", [
  ...legs(2.0, 1.3, 0.9, "metal", 0.06),
  box([0, 0.95, 0], [2.0, 0.06, 1.3], "panel", { r: [12, 0, 0] }),
  box([0, 0.99, 0], [1.8, 0.02, 1.1], "blueprint", { r: [12, 0, 0], glow: true }),
  cyl([0.7, 1.05, -0.3], 0.1, 0.25, "hazard", { r: [0, 0, 90] }),
]);
item("suit_locker", "Suit locker", [
  box([0, 1.1, -0.3], [1.0, 2.2, 0.2], "metal"),
  ...[-1, 1].map((sx) => box([sx * 0.48, 1.1, 0], [0.04, 2.2, 0.8], "metal")),
  box([0, 0.05, 0], [1.0, 0.1, 0.8], "dark"),
  box([0, 1.05, 0.0], [0.5, 0.8, 0.35], "white"),
  sph([0, 1.65, 0.0], 0.38, "white"),
  box([0, 1.65, 0.17], [0.24, 0.14, 0.04], "mirror"),
  box([0, 0.45, 0.0], [0.4, 0.5, 0.3], "white"),
  box([0, 1.2, 0.18], [0.3, 0.06, 0.01], "accent"),
  box([0, 1.05, -0.2], [0.4, 0.5, 0.15], "dark"),
]);
item("decon_arch", "Decontamination arch", [
  ...[-1, 1].map((sx) => box([sx * 1.0, 1.2, 0], [0.3, 2.4, 0.8], "white")),
  box([0, 2.5, 0], [2.3, 0.3, 0.8], "white"),
  box([0, 2.5, 0.41], [1.6, 0.1, 0.01], "glow", glow),
  ...[-1, 1].map((sx) => box([sx * 0.84, 1.2, 0], [0.02, 1.8, 0.5], "mirror")),
  box([0, 0.02, 0], [1.7, 0.04, 0.8], "hazard"),
]);

// =====================================================================
// People places
// =====================================================================

item("desk", "Desk", [
  ...table(1.6, 0.8, 0.75),
  box([0.5, 0.38, 0], [0.5, 0.7, 0.7], "panel"),
  box([0.5, 0.55, 0.351], [0.4, 0.02, 0.01], "dark"),
  box([0.5, 0.3, 0.351], [0.4, 0.02, 0.01], "dark"),
  ...monitor(-0.2, 1.0, -0.2),
  box([-0.2, 0.77, 0.15], [0.45, 0.02, 0.15], "dark"),
  cyl([0.4, 0.82, -0.2], 0.08, 0.12, "accent"),
]);
item("reception_desk", "Reception desk", [
  box([0, 0.55, 0], [2.6, 1.1, 0.5], "accent"),
  box([0, 1.12, 0.05], [2.7, 0.05, 0.62], "composite"),
  box([0, 0.72, -0.5], [2.4, 0.04, 0.5], "panel"),
  ...[-0.6, 0.6].map((x) => box([x, 0.36, -0.5], [0.05, 0.7, 0.5], "metal")),
  ...monitor(-0.5, 0.95, -0.55, 0.5),
  box([0.9, 1.16, 0.1], [0.3, 0.03, 0.2], "white"),
]);
item("student_desk", "School desk", [
  ...[-1, 1].map((sx) => box([sx * 0.45, 0.36, -0.2], [0.04, 0.72, 0.5], "metal")),
  box([0, 0.74, -0.2], [1.0, 0.04, 0.6], "panel"),
  box([0.2, 0.77, -0.25], [0.3, 0.02, 0.22], "white"),
  ...chairAt(0, 0.38, "accent", 180),
]);
item("filing_cabinet", "Filing cabinet", [
  box([0, 0.65, 0], [0.5, 1.3, 0.65], "metal"),
  ...[0.33, 0.65, 0.97].map((y) => box([0, y, 0.326], [0.44, 0.02, 0.01], "dark")),
  ...[0.5, 0.82, 1.14].map((y) => box([0, y, 0.33], [0.14, 0.04, 0.02], "steel")),
]);
item("meeting_table", "Meeting table", [
  ...table(2.4, 1.1, 0.75, "composite"),
  ...[-0.7, 0, 0.7].flatMap((x) => [...chairAt(x, 0.85, "accent", 180), ...chairAt(x, -0.85, "accent", 0)]),
  cyl([0, 0.8, 0], 0.3, 0.06, "glow", glow),
]);
item("wall_screen", "Wall screen", [box([0, 1.8, 0], [2.2, 1.3, 0.08], "dark"), box([0, 1.8, 0.045], [2.05, 1.15, 0.01], "glow", glow), box([0, 1.1, 0.03], [0.6, 0.1, 0.1], "dark")]);
item("chalkboard", "Board", [
  box([0, 1.55, 0], [3.0, 1.4, 0.06], "board"),
  box([0, 0.83, 0.05], [3.0, 0.05, 0.12], "metal"),
  ...[[-0.6, 1.8, 1.0], [0.2, 1.6, 1.4], [-0.2, 1.4, 0.9], [0.9, 1.9, 0.5]].map(([x, y, w]) => box([x, y, 0.035], [w, 0.03, 0.01], "white")),
  sph([1.1, 1.4, 0.035], 0.2, "cream"),
]);
item("bookshelf", "Bookshelf", [
  box([0, 1.0, -0.18], [1.4, 2.0, 0.04], "composite"),
  ...[-1, 1].map((sx) => box([sx * 0.68, 1.0, 0], [0.04, 2.0, 0.4], "composite")),
  ...[0.05, 0.55, 1.05, 1.55, 1.98].map((y) => box([0, y, 0], [1.4, 0.03, 0.4], "composite")),
  ...[0.05, 0.55, 1.05, 1.55].flatMap((y, i) => [["accent", -0.42, 0.3], ["rust", -0.05, 0.36], ["leaf", 0.35, 0.28], ["cream", 0.55, 0.12]].map(([c, x, w]) => box([x, y + 0.18, 0], [w, 0.3 - (i % 2) * 0.06, 0.28], c))),
]);
item("cubbies", "Cubbies", [
  box([0, 0.6, 0], [1.6, 1.2, 0.45], "composite"),
  ...[0.3, 0.9].flatMap((y) => [-0.55, 0, 0.55].map((x) => box([x, y, 0.2], [0.45, 0.45, 0.06], "dark"))),
  ...[0.3, 0.9].flatMap((y, i) => [-0.55, 0, 0.55].map((x, j) => box([x, y - 0.05, 0.18], [0.3, 0.25, 0.1], ["accent", "leaf", "rust", "hazard", "water", "cream"][i * 3 + j]))),
]);
item("medical_bed", "Medical bed", [
  ...legs(2.1, 1.0, 0.55, "steel", 0.05),
  box([0, 0.6, 0], [2.1, 0.08, 1.0], "steel"),
  box([0.2, 0.72, 0], [1.5, 0.16, 0.9], "white"),
  box([-0.8, 0.85, 0], [0.6, 0.16, 0.9], "white", { r: [0, 0, -20] }),
  box([0, 0.72, 0.51], [1.4, 0.2, 0.02], "accent"),
  box([0.3, 0.8, 0], [1.0, 0.04, 0.92], "cream"),
]);
item("med_cabinet", "Medicine cabinet", [
  box([0, 0.95, 0], [1.2, 1.9, 0.5], "white"),
  box([0, 0.95, 0.251], [0.02, 1.8, 0.01], "panel"),
  box([0, 1.5, 0.26], [0.36, 0.1, 0.02], "accent"),
  box([0, 1.5, 0.26], [0.1, 0.36, 0.02], "accent"),
  box([0, 0.5, 0.26], [1.0, 0.02, 0.01], "panel"),
]);
item("monitor_stand", "Monitor", [cyl([0, 0.03, 0], 0.55, 0.06, "dark"), cyl([0, 0.8, 0], 0.06, 1.5, "steel"), box([0, 1.5, 0.05], [0.5, 0.35, 0.06], "dark"), box([0, 1.5, 0.085], [0.44, 0.29, 0.01], "glow", glow), box([0, 1.1, 0.05], [0.3, 0.2, 0.12], "white")]);
item("scanner", "Body scanner", [
  box([0, 0.35, 0.2], [0.8, 0.7, 1.9], "white"),
  box([0, 0.75, 0.3], [0.7, 0.1, 1.7], "cream"),
  cyl([0, 1.0, -0.6], 1.9, 0.7, "white", { r: [90, 0, 0] }),
  cyl([0, 1.0, -0.6], 1.0, 0.72, "dark", { r: [90, 0, 0] }),
  cyl([0, 1.0, -0.6], 1.94, 0.08, "accent", { r: [90, 0, 0] }),
  box([0.9, 1.3, -0.6], [0.05, 0.3, 0.4], "glow", glow),
]);
item("water_cooler", "Water cooler", [box([0, 0.5, 0], [0.4, 1.0, 0.4], "white"), cyl([0, 1.25, 0], 0.32, 0.5, "water"), box([0, 0.8, 0.205], [0.2, 0.1, 0.02], "dark"), cyl([0.3, 0.9, 0], 0.08, 0.14, "white")]);
item("bench", "Bench", [...[-1, 1].map((sx) => box([sx * 0.75, 0.2, 0], [0.08, 0.4, 0.45], "metal")), box([0, 0.43, 0], [1.8, 0.06, 0.5], "composite"), box([0, 0.46, 0], [1.7, 0.02, 0.1], "accent")]);
item("planter_tree", "Tree planter", [
  box([0, 0.3, 0], [1.6, 0.6, 1.6], "panel"),
  box([0, 0.55, 0], [1.66, 0.1, 1.66], "accent"),
  box([0, 0.61, 0], [1.5, 0.02, 1.5], "soil"),
  cyl([0, 1.4, 0], 0.16, 1.6, "rust"),
  cyl([0.2, 1.9, 0], 0.08, 0.6, "rust", { r: [0, 0, -35] }),
  ...foliage(0, 2.5, 0, 1.7),
]);
item("lamp_post", "Lamp post", [cyl([0, 0.05, 0], 0.4, 0.1, "dark"), cyl([0, 1.45, 0], 0.08, 2.8, "dark"), box([0.2, 2.85, 0], [0.5, 0.05, 0.05], "dark"), sph([0.4, 2.75, 0], 0.3, "lamp", glow)]);
item("fountain", "Fountain", [
  cyl([0, 0.25, 0], 2.4, 0.5, "stone"),
  cyl([0, 0.5, 0], 2.5, 0.06, "accent"),
  cyl([0, 0.46, 0], 2.1, 0.02, "water"),
  cyl([0, 0.8, 0], 0.3, 0.7, "stone"),
  cyl([0, 1.2, 0], 0.7, 0.12, "stone"),
  cyl([0, 1.27, 0], 0.55, 0.02, "water"),
  cyl([0, 1.45, 0], 0.06, 0.35, "water"),
  sph([0, 1.65, 0], 0.18, "water"),
]);
item("vending_machine", "Vending machine", [
  box([0, 1.0, 0], [1.0, 2.0, 0.8], "accent"),
  box([-0.1, 1.2, 0.401], [0.65, 1.3, 0.01], "mirror"),
  ...[0.7, 1.0, 1.3, 1.6].flatMap((y) => [-0.3, -0.1, 0.1].map((x, i) => box([x, y, 0.38], [0.15, 0.2, 0.02], ["rust", "leaf", "hazard"][i]))),
  box([0.37, 1.3, 0.402], [0.15, 0.4, 0.01], "glow", glow),
  box([0, 0.3, 0.402], [0.7, 0.2, 0.01], "dark"),
]);
item("trash_bin", "Bin", [cyl([0, 0.4, 0], 0.5, 0.8, "dark"), cyl([0, 0.82, 0], 0.54, 0.04, "accent"), cyl([0, 0.4, 0], 0.52, 0.06, "leaf")]);
item("kiosk", "Info kiosk", [cyl([0, 0.03, 0], 0.7, 0.06, "dark"), box([0, 0.7, 0], [0.4, 1.3, 0.3], "accent"), box([0, 1.5, 0.05], [0.7, 0.5, 0.1], "dark", { r: [-15, 0, 0] }), box([0, 1.5, 0.1], [0.62, 0.42, 0.01], "glow", { r: [-15, 0, 0], glow: true })]);
item("niche_wall", "Memorial niches", [
  box([0, 1.3, -0.05], [3.0, 2.6, 0.35], "stone"),
  ...[-1.1, -0.55, 0, 0.55, 1.1].flatMap((x) => [0.6, 1.2, 1.8].map((y) => box([x, y, 0.13], [0.5, 0.4, 0.02], "dark"))),
  ...[-1.1, 0, 1.1].map((x) => box([x, 1.1, 0.15], [0.15, 0.06, 0.02], "copper")),
  ...[-0.55, 0.55].map((x) => box([x, 1.7, 0.15], [0.15, 0.06, 0.02], "copper")),
  box([0, 2.55, 0.05], [3.1, 0.1, 0.4], "accent"),
]);
item("memorial", "Memorial stone", [
  box([0, 0.1, 0], [0.9, 0.2, 0.6], "stone"),
  box([0, 0.6, 0], [0.7, 0.8, 0.25], "stone"),
  box([0, 0.75, 0.13], [0.4, 0.3, 0.01], "copper"),
  ...[-0.3, 0.3].flatMap((x) => [cyl([x, 0.3, 0.22], 0.08, 0.2, "white"), sph([x, 0.44, 0.22], 0.07, "fire", glow)]),
  ...foliage(0.2, 0.3, 0.2, 0.3, "leaf", "plant"),
]);
item("candle_stand", "Candle stand", [cyl([0, 0.45, 0], 0.08, 0.9, "copper"), cyl([0, 0.9, 0], 0.5, 0.04, "copper"), ...[-0.15, 0, 0.15].flatMap((x) => [cyl([x, 1.0, 0], 0.06, 0.16, "white"), sph([x, 1.11, 0], 0.06, "fire", glow)])]);

// =====================================================================
// Stairs and elevators
// =====================================================================

// A grand straight flight, 2.8 m wide, climbing 4 m in 16 steps of 0.4 m run and 0.25 m rise,
// from its front (+z, the foot) toward its back (−z, the head). Alternate floors mirror it, so
// the flights switch back up the stairwell; the floor above has a railed well where it arrives.
const STAIRS = { width: 2.8, run: 0.4, rise: 0.25, steps: 16 };
{
  const { width: W, run, rise, steps: n } = STAIRS;
  const L = run * n;
  const H = rise * n;
  const slope = (Math.atan2(H, L) * 180) / Math.PI;
  /** The treads' height at z, along the slope. */
  const heightAt = (z) => ((L / 2 - z) / L) * H;
  const flight = [
    // Treads, and a riser under each.
    ...Array.from({ length: n }, (_, k) => box([0, (k + 1) * rise - 0.03, L / 2 - (k + 0.5) * run], [W - 0.12, 0.06, run + 0.02], k % 2 ? "composite" : "accent")),
    ...Array.from({ length: n }, (_, k) => box([0, (k + 0.5) * rise, L / 2 - k * run - 0.01], [W - 0.14, rise, 0.02], "dark")),
    // Stringers under each side, short of the floor at the foot and the well's rim at the head.
    ...[-1, 1].map((sx) => box([sx * (W / 2 - 0.05), H / 2, 0], [0.1, 0.3, Math.hypot(L, H) - 0.9], "metal", { r: [r3(slope), 0, 0] })),
    // Handrails a metre above the treads, up the lower three quarters (the well's rail takes over above).
    ...[-1, 1].flatMap((sx) => {
      const [z0, z1] = [L / 2 - 0.2, -L / 2 + 1.8];
      const zc = (z0 + z1) / 2;
      return [
        box([sx * (W / 2 - 0.05), heightAt(zc) + 0.95, zc], [0.05, 0.05, (z0 - z1) / Math.cos((slope * Math.PI) / 180)], "steel", { r: [r3(slope), 0, 0] }),
        ...[z0, zc, z1].map((z) => box([sx * (W / 2 - 0.05), heightAt(z) + 0.5, z], [0.05, 0.9, 0.05], "steel")),
      ];
    }),
  ];
  item("stair_flight", "Stair flight", flight);
  // Walked up, not round: first person climbs it from its foot to the floor above.
  items.stair_flight.climb = true;
  // The well a flight from below arrives through: railed round its sides and foot, open at its head.
  const well = [
    ...[-1, 1].flatMap((sx) => [
      box([sx * (W / 2 - 0.03), 1.0, 0], [0.05, 0.05, L], "steel"),
      box([sx * (W / 2 - 0.03), 0.5, 0], [0.04, 0.03, L], "steel"),
      box([sx * (W / 2 - 0.03), 0.03, 0], [0.08, 0.06, L], "hazard"),
      ...[-L / 2 + 0.05, -L / 4, 0, L / 4, L / 2 - 0.05].map((z) => box([sx * (W / 2 - 0.03), 0.5, z], [0.05, 1.0, 0.05], "steel")),
    ]),
    box([0, 1.0, L / 2 - 0.03], [W, 0.05, 0.05], "steel"),
    box([0, 0.5, L / 2 - 0.03], [W, 0.03, 0.04], "steel"),
    box([0, 0.03, L / 2 - 0.03], [W, 0.06, 0.08], "hazard"),
    // The head, where you step off: a hazard edge on the floor.
    box([0, 0.012, -L / 2 + 0.04], [W - 0.1, 0.024, 0.08], "hazard"),
  ];
  item("stair_landing", "Stair well", well);
  // A hole in the floor, not something standing on it: it doesn't count toward a room's crowding.
  items.stair_landing.opening = true;
}
function shaft(car) {
  const parts = [
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => box([sx * 1.15, 2.0, sz * 1.15], [0.1, 4.0, 0.1], "metal"))),
    box([0, 2.0, -1.18], [2.4, 4.0, 0.04], "dark"),
    ...[-1, 1].map((sx) => box([sx * 0.9, 2.0, -1.12], [0.08, 4.0, 0.08], "steel")),
    ...[0.05, 3.95].map((y) => box([0, y, 1.15], [2.4, 0.08, 0.1], "accent")),
    ...[-1, 1].map((sx) => box([sx * 1.15, 2.0, 0], [0.04, 4.0, 2.2], "mirror")),
    box([0, 0.03, 0], [2.3, 0.06, 2.3], "hazard"),
  ];
  if (car) {
    parts.push(
      box([0, 1.35, -0.05], [2.0, 2.6, 2.0], "panel"),
      ...[-0.5, 0.5].map((x) => box([x, 1.2, 0.96], [0.95, 2.2, 0.02], "steel")),
      box([0, 2.52, 0.965], [1.6, 0.12, 0.01], "glow", glow),
      box([0, 2.7, -0.05], [2.04, 0.1, 2.04], "accent"),
      cyl([0, 3.3, -0.05], 0.06, 1.1, "metal"),
    );
  }
  return parts;
}
item("elevator_shaft", "Elevator shaft", shaft(false));
item("elevator_car", "Elevator (car waiting)", shaft(true));
item("call_panel", "Call panel", [
  box([0, 0.65, 0], [0.12, 1.3, 0.12], "metal"),
  box([0, 1.35, 0.02], [0.35, 0.5, 0.1], "dark"),
  box([0, 1.45, 0.075], [0.12, 0.12, 0.01], "glow", glow),
  box([0, 1.25, 0.075], [0.12, 0.12, 0.01], "fire", glow),
]);

// =====================================================================
// Leisure, dining, care and recycling (Sep 30)
// =====================================================================

item("treadmill", "Treadmill", [
  box([0, 0.12, 0.2], [0.8, 0.24, 1.9], "dark"),
  box([0, 0.25, 0.25], [0.6, 0.02, 1.6], "rubber"),
  ...[-1, 1].map((sx) => box([sx * 0.36, 0.75, -0.6], [0.06, 1.1, 0.06], "metal")),
  box([0, 1.3, -0.62], [0.78, 0.06, 0.3], "metal"),
  box([0, 1.36, -0.66], [0.4, 0.22, 0.04], "dark"),
  box([0, 1.36, -0.635], [0.34, 0.16, 0.005], "glow", glow),
]);
item("exercise_bike", "Exercise bike", [
  box([0, 0.06, 0], [0.5, 0.12, 1.2], "dark"),
  cyl([0, 0.38, 0.35], 0.5, 0.1, "accent", { r: [0, 0, 90] }),
  box([0, 0.6, -0.2], [0.08, 0.9, 0.08], "metal", { r: [-15, 0, 0] }),
  box([0, 0.98, -0.3], [0.3, 0.08, 0.34], "cushion"),
  box([0, 0.85, 0.45], [0.08, 0.8, 0.08], "metal", { r: [15, 0, 0] }),
  box([0, 1.22, 0.52], [0.55, 0.05, 0.06], "rubber"),
]);
item("weight_bench", "Weight bench", [
  ...legs(0.4, 1.3, 0.42, "metal", 0.05),
  box([0, 0.46, 0], [0.4, 0.08, 1.3], "cushion"),
  ...[-1, 1].map((sx) => box([sx * 0.55, 0.6, -0.45], [0.06, 1.2, 0.06], "metal")),
  cyl([0, 1.1, -0.45], 0.04, 1.8, "steel", { r: [0, 0, 90] }),
  ...[-1, 1].map((sx) => cyl([sx * 0.8, 1.1, -0.45], 0.42, 0.08, "dark", { r: [0, 0, 90] })),
]);
item("dumbbell_rack", "Dumbbell rack", [
  ...legs(1.6, 0.5, 0.7, "metal", 0.06),
  ...[0.35, 0.68].map((y) => box([0, y, 0], [1.6, 0.04, 0.5], "dark")),
  ...[-0.6, -0.2, 0.2, 0.6].flatMap((x, i) => [0.42, 0.75].map((y) => cyl([x, y, 0], 0.1 + i * 0.02, 0.3, i % 2 ? "accent" : "dark", { r: [0, 0, 90] }))),
]);
item("gym_mat", "Exercise mat", [box([0, 0.015, 0], [1.0, 0.03, 2.0], "accent"), box([0, 0.032, 0], [0.9, 0.004, 1.9], "cushion")]);
item("punching_bag", "Punching bag", [
  box([0, 1.1, -0.35], [0.1, 2.2, 0.1], "metal"),
  box([0, 2.15, -0.1], [0.08, 0.08, 0.5], "metal"),
  cyl([0, 1.35, 0.15], 0.4, 1.0, "rust"),
  box([0, 0.03, -0.2], [0.6, 0.06, 0.6], "dark"),
]);
item("lawn", "Lawn", [box([0, 0.02, 0], [3.0, 0.04, 2.0], "plant"), box([0, 0.045, 0], [2.8, 0.01, 1.8], "leaf")]);
item("flower_bed", "Flower bed", [
  box([0, 0.2, 0], [2.0, 0.4, 0.7], "stone"),
  box([0, 0.41, 0], [1.9, 0.02, 0.6], "soil"),
  ...[-0.75, -0.45, -0.15, 0.15, 0.45, 0.75].flatMap((x, i) => [sph([x, 0.55, 0], 0.26, i % 2 ? "plant" : "leaf"), sph([x + 0.05, 0.7, 0.05], 0.12, ["flower", "red", "power"][i % 3])]),
]);
item("shrub", "Shrub", [cyl([0, 0.08, 0], 0.7, 0.16, "soil"), ...foliage(0, 0.5, 0, 0.9)]);
item("stock_kettle", "Stock kettle", [
  ...[-1, 1].map((sx) => box([sx * 0.5, 0.45, 0], [0.08, 0.9, 0.5], "metal")),
  cyl([0, 0.75, 0], 0.85, 0.7, "steel"),
  cyl([0, 1.11, 0], 0.9, 0.04, "metal"),
  box([0.55, 0.8, 0], [0.25, 0.08, 0.08], "dark"),
]);
item("dishwasher", "Dishwasher", [
  box([0, 0.45, 0], [1.2, 0.9, 0.7], "steel"),
  box([0, 1.4, 0], [1.2, 1.0, 0.7], "steel"),
  box([0, 1.4, 0.36], [1.0, 0.8, 0.02], "metal"),
  box([0.45, 0.8, 0.36], [0.12, 0.08, 0.02], "glow", glow),
]);
item("tray_rack", "Tray rack", [
  ...legs(0.6, 0.5, 1.6, "metal", 0.04),
  ...[0.3, 0.55, 0.8, 1.05, 1.3, 1.55].map((y, i) => box([0, y, 0], [0.56, 0.03, 0.46], i % 2 ? "accent" : "panel")),
]);
item("canteen_table", "Canteen table", [
  ...table(2.6, 0.9, 0.75, "panel"),
  ...[-1, 1].map((sz) => box([0, 0.45, sz * 0.75], [2.4, 0.06, 0.34], "accent")),
  ...[-1, 1].flatMap((sz) => [-1.05, 1.05].map((x) => box([x, 0.22, sz * 0.75], [0.06, 0.44, 0.3], "metal"))),
  ...[-0.7, 0.2, 0.9].map((x) => box([x, 0.77, 0.1], [0.4, 0.02, 0.3], "white")),
]);
item("operating_table", "Operating table", [
  box([0, 0.45, 0], [0.3, 0.9, 0.3], "metal"),
  box([0, 0.95, 0], [0.7, 0.1, 2.0], "white"),
  box([0, 1.01, 0], [0.62, 0.02, 1.9], "mirror"),
  box([0, 1.5, -0.8], [0.08, 3.0, 0.08], "metal"),
  box([0, 2.9, -0.35], [0.06, 0.06, 0.9], "metal"),
  cyl([0, 2.8, 0.1], 0.7, 0.15, "white"),
  cyl([0, 2.72, 0.1], 0.5, 0.02, "lamp", glow),
]);
item("wheelchair", "Wheelchair", [
  ...[-1, 1].map((sx) => cyl([sx * 0.3, 0.3, 0], 0.6, 0.04, "dark", { r: [0, 0, 90] })),
  box([0, 0.5, 0.05], [0.5, 0.06, 0.45], "cushion"),
  box([0, 0.8, -0.2], [0.5, 0.55, 0.05], "cushion"),
  ...[-1, 1].map((sx) => box([sx * 0.27, 0.7, 0], [0.04, 0.04, 0.45], "metal")),
]);
item("kiln", "Brick kiln", [
  box([0, 1.1, 0], [2.6, 2.2, 2.2], "rust"),
  cyl([0, 2.2, 0], 2.2, 0.6, "rust", { r: [0, 0, 90] }),
  box([0, 0.75, 1.11], [1.2, 1.1, 0.02], "dark"),
  box([0, 0.7, 1.12], [1.0, 0.8, 0.01], "fire", glow),
  cyl([0.8, 3.2, -0.5], 0.45, 1.6, "stone"),
]);
item("brick_press", "Brick press", [
  box([0, 0.4, 0], [1.4, 0.8, 1.0], "accent"),
  ...[-1, 1].map((sx) => box([sx * 0.6, 1.3, 0], [0.12, 1.0, 0.12], "metal")),
  box([0, 1.85, 0], [1.4, 0.2, 0.5], "dark"),
  cyl([0, 1.45, 0], 0.25, 0.6, "steel"),
  box([0, 0.85, 0.1], [0.8, 0.1, 0.5], "rust"),
]);
item("brick_pallet", "Bricks on a pallet", [
  box([0, 0.06, 0], [1.2, 0.12, 1.0], "fibre"),
  ...[0, 1, 2, 3].flatMap((k) => [-0.3, 0.3].map((x) => box([x, 0.2 + k * 0.15, 0], [0.56, 0.14, 0.9], k % 2 ? "rust" : "red"))),
]);
item("sorting_bins", "Sorting bins", [
  ...[-1.05, -0.35, 0.35, 1.05].map((x, i) => box([x, 0.5, 0], [0.64, 1.0, 0.8], ["accent", "metal", "plant", "hazard"][i])),
  ...[-1.05, -0.35, 0.35, 1.05].map((x) => box([x, 1.02, -0.05], [0.66, 0.04, 0.8], "dark")),
]);
item("baler", "Baler", [
  box([0, 1.0, 0], [1.6, 2.0, 1.4], "accent"),
  box([0, 0.55, 0.71], [1.2, 0.8, 0.02], "dark"),
  box([0, 2.2, 0], [0.6, 0.4, 0.6], "metal"),
  box([0.6, 1.5, 0.71], [0.2, 0.3, 0.02], "glow", glow),
  box([0, 0.3, 1.3], [1.0, 0.6, 0.9], "composite"),
]);
item("scrap_pile", "Scrap pile", [
  box([0, 0.05, 0], [1.8, 0.1, 1.4], "dark"),
  box([-0.3, 0.3, 0], [0.9, 0.4, 0.8], "rust", { r: [0, 20, 8] }),
  box([0.4, 0.28, 0.2], [0.7, 0.35, 0.6], "metal", { r: [0, -30, -6] }),
  cyl([0.1, 0.55, -0.2], 0.2, 1.2, "copper", { r: [0, 0, 80] }),
  sph([-0.5, 0.55, 0.3], 0.3, "steel"),
]);
item("dumpster", "Waste container", [
  box([0, 0.6, 0], [1.8, 1.1, 1.1], "accent"),
  box([0, 1.2, -0.05], [1.84, 0.08, 1.04], "dark", { r: [-8, 0, 0] }),
  box([0, 0.6, 0.555], [1.7, 0.08, 0.02], "hazard"),
  ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => cyl([sx * 0.7, 0.05, sz * 0.4], 0.12, 0.1, "rubber", { r: [0, 0, 90] }))),
]);

item("glass_rack", "Glass sheets on a rack", [
  box([0, 0.06, 0], [1.6, 0.12, 0.7], "dark"),
  box([0, 0.75, -0.2], [1.6, 1.3, 0.06], "metal", { r: [-12, 0, 0] }),
  ...[0, 1, 2, 3].map((k) => box([0, 0.8, -0.1 + k * 0.07], [1.4, 1.25, 0.02], "mirror", { r: [-12, 0, 0] })),
]);

// =====================================================================
// What each room may hold
// =====================================================================

const rooms = {
  bunk_dorm: ["bunk_bed", "locker", "footlocker", "partition", "table", "stool", "rug", "floor_lamp", "coat_rack", "shelf_unit"],
  studio: ["bed", "side_table", "wardrobe", "partition", "kitchenette", "bathroom_pod", "table", "stool", "rug", "floor_lamp", "plant_pot", "coat_rack"],
  apartment: ["bed", "side_table", "wardrobe", "partition", "kitchenette", "bathroom_pod", "dining_table", "sofa", "tv_unit", "rug", "floor_lamp", "plant_pot", "coat_rack"],
  flat: ["double_bed", "side_table", "wardrobe", "dresser", "partition", "kitchenette", "bathroom_pod", "table", "chair", "sofa", "coffee_table", "tv_unit", "rug", "floor_lamp", "plant_pot", "bookshelf"],
  family_apartment: ["double_bed", "bed", "side_table", "wardrobe", "dresser", "partition", "kitchenette", "bathroom_pod", "dining_table", "sofa", "coffee_table", "tv_unit", "desk", "office_chair", "rug", "floor_lamp", "plant_pot", "bookshelf"],
  suite: ["double_bed", "side_table", "wardrobe", "dresser", "bathroom_pod", "bathtub", "kitchenette", "table", "chair", "sofa", "armchair", "coffee_table", "fireplace", "bookshelf", "tv_unit", "rug", "floor_lamp", "plant_pot", "planter_tree"],
  residence: ["double_bed", "bed", "side_table", "wardrobe", "dresser", "partition", "bathroom_pod", "bathtub", "kitchenette", "dining_table", "sofa", "armchair", "coffee_table", "fireplace", "piano", "bookshelf", "desk", "office_chair", "tv_unit", "rug", "floor_lamp", "plant_pot", "planter_tree"],
  galley: ["stove_counter", "prep_counter", "fridge", "serving_counter", "dining_table", "shelf_unit", "water_dispenser", "trash_bin"],
  farm: ["planter_bed", "hydroponic_rack", ...CROPS.filter((c) => c !== "leafyGreens").flatMap((c) => [`planter_bed_${c}`, `hydroponic_rack_${c}`]), "seed_table", "big_tank", "tool_cart", "shelf_unit", "pipe_run"],
  water_tank: ["big_tank", "pipe_run", "valve_panel", "pump"],
  water_recycler: ["filter_column", "big_tank", "pump", "pipe_run", "console", "valve_panel"],
  tailings_reclaimer: ["filter_column", "big_tank", "pump", "pipe_run", "console", "barrel_group"],
  restroom: ["toilet_stall", "sink_basin", "shower_stall", "laundry_machine", "bench", "trash_bin"],
  life_support: ["scrubber_unit", "big_fan", "gas_bottles", "console", "pipe_run", "duct_riser"],
  clinic: ["medical_bed", "med_cabinet", "monitor_stand", "partition", "scanner", "desk", "office_chair", "chair", "plant_pot", "water_cooler"],
  admin_office: ["reception_desk", "desk", "office_chair", "filing_cabinet", "meeting_table", "wall_screen", "plant_pot", "water_cooler", "bookshelf", "sofa"],
  battery_bank: ["battery_rack", "inverter", "console", "duct_riser"],
  deep_well_pump: ["well_head", "pump", "pipe_run", "valve_panel", "console", "big_tank"],
  smelter: ["furnace", "ore_bin", "ingot_rack", "console", "tool_cart", "conveyor", "barrel_group"],
  machine_shop: ["lathe", "workbench", "drill_press", "welding_station", "printer_3d", "tool_wall", "shelf_unit", "tool_cart"],
  silicon_refinery: ["reactor_vessel", "crystal_puller", "clean_hood", "console", "gas_bottles", "shelf_unit"],
  electronics_fab: ["fab_bench", "clean_hood", "component_cabinet", "printer_3d", "stool", "shelf_unit", "console"],
  staging_bay: ["kit_container", "crate_stack", "cargo_crate", "cart", "pallet_jack", "barrel_group", "console"],
  school: ["student_desk", "chalkboard", "desk", "office_chair", "bookshelf", "cubbies", "rug", "plant_pot"],
  elder_care: ["bed", "armchair", "side_table", "sofa", "plant_pot", "med_cabinet", "rug", "tv_unit", "floor_lamp", "partition", "dining_table", "water_cooler"],
  composter: ["compost_bin", "compost_drum", "soil_sacks", "tool_cart", "barrel_group"],
  crypt: ["niche_wall", "memorial", "bench", "plant_pot", "candle_stand"],
  concrete_plant: ["mixer_drum", "hopper", "bag_stack", "mold_forms", "conveyor", "pallet_jack"],
  tiny_plaza: ["bench", "planter_tree", "lamp_post", "plant_pot", "trash_bin"],
  small_plaza: ["fountain", "bench", "planter_tree", "lamp_post", "vending_machine", "kiosk", "trash_bin", "plant_pot"],
  entrance: ["suit_locker", "decon_arch", "bench", "console", "kiosk", "cargo_crate"],
  cargo_elevator: ["cargo_crate", "cart", "pallet_jack", "console", "barrel_group"],
  site_office: ["desk", "office_chair", "blueprint_table", "locker", "shelf_unit", "water_cooler"],
  construction_office: ["blueprint_table", "desk", "office_chair", "tool_wall", "cargo_crate", "shelf_unit", "water_cooler"],
  construction_yard: ["girder_stack", "crate_stack", "scaffold", "cart", "pallet_jack", "tool_wall", "blueprint_table", "barrel_group"],
  storeroom: ["shelf_unit", "cargo_crate", "barrel_group"],
  warehouse: ["pallet_rack", "crate_stack", "cart", "pallet_jack", "barrel_group"],
  depot: ["pallet_rack", "crate_stack", "cart", "pallet_jack", "console", "barrel_group"],
  stairwell: ["stair_flight", "stair_landing", "bench", "plant_pot"],
  maintenance: ["workbench", "repair_stand", "parts_rack", "tool_wall", "tool_cart", "console", "shelf_unit"],
  cleaning_service: ["laundry_machine", "cleaning_cart", "mop_rack", "drying_rack", "sink_basin", "shelf_unit", "locker"],
  elevator: ["elevator_shaft", "elevator_car", "call_panel", "bench", "plant_pot"],
  kitchen: ["stove_counter", "prep_counter", "fridge", "stock_kettle", "dishwasher", "shelf_unit", "trash_bin", "water_dispenser"],
  canteen: ["canteen_table", "serving_counter", "tray_rack", "water_dispenser", "plant_pot", "trash_bin", "planter_tree"],
  hospital: ["medical_bed", "monitor_stand", "partition", "med_cabinet", "scanner", "operating_table", "reception_desk", "office_chair", "chair", "wheelchair", "plant_pot", "water_cooler"],
  gym: ["treadmill", "exercise_bike", "weight_bench", "dumbbell_rack", "gym_mat", "punching_bag", "water_cooler", "bench", "locker"],
  park: ["lawn", "flower_bed", "shrub", "planter_tree", "bench", "lamp_post", "fountain", "trash_bin"],
  brickworks: ["kiln", "brick_press", "brick_pallet", "hopper", "conveyor", "pallet_jack", "console"],
  recycling_center: ["sorting_bins", "baler", "scrap_pile", "conveyor", "pallet_jack", "console", "barrel_group"],
  waste_storage: ["dumpster", "barrel_group", "trash_bin"],
  ventilation_hub: ["big_fan", "duct_riser", "filter_column", "console", "pipe_run"],
  glassworks: ["kiln", "glass_rack", "hopper", "pallet_jack", "console"],
};

// What hangs on each room's walls: pictures and lamps at home, charts, readouts and signs at work.
const hangings = {
  bunk_dorm: ["poster", "wall_lamp", "wall_shelf", "wall_clock"],
  studio: ["painting", "poster", "wall_lamp", "wall_shelf", "wall_mirror"],
  apartment: ["painting", "painting_wide", "wall_lamp", "wall_shelf", "wall_mirror", "wall_clock"],
  flat: ["painting", "painting_wide", "wall_lamp", "wall_shelf", "wall_mirror", "wall_clock", "wall_planter"],
  family_apartment: ["painting", "painting_wide", "poster", "wall_lamp", "wall_shelf", "wall_mirror", "wall_clock", "wall_planter"],
  suite: ["painting", "painting_wide", "wall_lamp", "wall_shelf", "wall_mirror", "wall_clock", "wall_planter"],
  residence: ["painting", "painting_wide", "wall_lamp", "wall_shelf", "wall_mirror", "wall_clock", "wall_planter"],
  galley: ["notice_board", "wall_clock", "wall_shelf", "safety_sign"],
  farm: ["gauge_panel", "chart_board", "wall_planter", "readout_panel"],
  water_tank: ["gauge_panel", "safety_sign"],
  water_recycler: ["gauge_panel", "readout_panel", "safety_sign", "chart_board"],
  tailings_reclaimer: ["safety_sign", "gauge_panel", "readout_panel"],
  restroom: ["wall_mirror", "poster", "wall_lamp"],
  life_support: ["gauge_panel", "readout_panel", "safety_sign"],
  clinic: ["chart_board", "poster", "wall_clock", "readout_panel", "painting"],
  admin_office: ["mars_map", "painting", "wall_clock", "notice_board", "painting_wide"],
  battery_bank: ["gauge_panel", "readout_panel", "safety_sign"],
  deep_well_pump: ["gauge_panel", "readout_panel", "safety_sign"],
  smelter: ["safety_sign", "readout_panel", "gauge_panel", "chart_board"],
  machine_shop: ["safety_sign", "chart_board", "wall_shelf", "wall_clock"],
  silicon_refinery: ["safety_sign", "readout_panel", "gauge_panel", "chart_board"],
  electronics_fab: ["readout_panel", "chart_board", "safety_sign", "wall_clock"],
  staging_bay: ["safety_sign", "notice_board", "mars_map", "readout_panel"],
  school: ["notice_board", "mars_map", "poster", "wall_clock", "painting"],
  elder_care: ["painting", "painting_wide", "wall_clock", "wall_planter", "wall_lamp"],
  composter: ["gauge_panel", "safety_sign", "chart_board"],
  crypt: ["plaque", "wall_lamp", "painting"],
  concrete_plant: ["safety_sign", "gauge_panel", "chart_board"],
  tiny_plaza: ["wall_planter", "wall_lamp", "banner"],
  small_plaza: ["banner", "wall_planter", "wall_lamp", "mars_map"],
  entrance: ["mars_map", "safety_sign", "notice_board", "wall_clock"],
  cargo_elevator: ["safety_sign", "notice_board"],
  site_office: ["chart_board", "notice_board", "wall_clock"],
  construction_office: ["chart_board", "notice_board", "wall_clock", "mars_map"],
  construction_yard: ["safety_sign", "chart_board", "notice_board"],
  storeroom: ["safety_sign", "notice_board"],
  warehouse: ["safety_sign", "notice_board", "wall_lamp"],
  depot: ["safety_sign", "notice_board", "readout_panel"],
  stairwell: ["poster", "wall_lamp", "safety_sign"],
  maintenance: ["safety_sign", "chart_board", "wall_clock", "notice_board"],
  cleaning_service: ["notice_board", "wall_clock", "wall_mirror", "poster", "wall_lamp"],
  elevator: ["poster", "wall_lamp", "safety_sign"],
  kitchen: ["notice_board", "wall_clock", "wall_shelf", "safety_sign"],
  canteen: ["painting_wide", "poster", "wall_clock", "wall_planter", "wall_lamp", "menu_board"],
  hospital: ["chart_board", "readout_panel", "wall_clock", "poster", "painting"],
  gym: ["wall_mirror", "poster", "wall_clock", "notice_board"],
  park: ["wall_planter", "wall_lamp", "banner"],
  brickworks: ["safety_sign", "gauge_panel", "chart_board"],
  recycling_center: ["safety_sign", "chart_board", "readout_panel"],
  waste_storage: ["safety_sign"],
  ventilation_hub: ["gauge_panel", "readout_panel", "safety_sign"],
  glassworks: ["safety_sign", "gauge_panel", "chart_board"],
};
// And more to fill the walls, by kind of room: a second pass that the templates spread along every wall.
const WALL_FILL = {
  home: ["family_photos", "wall_textile", "earth_photo", "coat_hooks", "intercom", "air_vent"],
  plant: ["pipe_manifold", "cable_tray", "work_light", "fire_extinguisher", "first_aid_kit", "air_vent"],
  workshop: ["tool_board", "whiteboard", "cable_tray", "work_light", "fire_extinguisher", "first_aid_kit", "air_vent"],
  office: ["whiteboard", "earth_photo", "family_photos", "intercom", "fire_extinguisher", "air_vent"],
  store: ["cable_tray", "work_light", "fire_extinguisher", "first_aid_kit", "air_vent"],
  farm: ["grow_light", "pipe_manifold", "tool_board", "fire_extinguisher", "air_vent"],
  galley: ["menu_board", "utensil_rack", "fire_extinguisher", "first_aid_kit", "air_vent"],
  wash: ["air_vent", "first_aid_kit", "intercom"],
  quiet: ["wall_textile", "air_vent"],
  public: ["earth_photo", "intercom", "fire_extinguisher", "first_aid_kit", "wall_planter", "air_vent"],
  entry: ["coat_hooks", "earth_photo", "fire_extinguisher", "first_aid_kit", "intercom", "air_vent"],
};
const FILL_KIND = {
  bunk_dorm: "home", studio: "home", apartment: "home", flat: "home", family_apartment: "home", suite: "home", residence: "home", elder_care: "home",
  water_tank: "plant", water_recycler: "plant", tailings_reclaimer: "plant", life_support: "plant", battery_bank: "plant", deep_well_pump: "plant", smelter: "plant", silicon_refinery: "plant", composter: "plant", concrete_plant: "plant",
  machine_shop: "workshop", electronics_fab: "workshop", construction_yard: "workshop",
  admin_office: "office", site_office: "office", construction_office: "office", clinic: "office", school: "office",
  storeroom: "store", warehouse: "store", depot: "store", staging_bay: "store", cargo_elevator: "store",
  farm: "farm", galley: "galley", restroom: "wash", crypt: "quiet",
  tiny_plaza: "public", small_plaza: "public", stairwell: "public", elevator: "public", entrance: "entry",
  maintenance: "workshop", cleaning_service: "wash",
  kitchen: "galley", canteen: "public", hospital: "office", gym: "public", park: "public", brickworks: "plant", recycling_center: "plant", waste_storage: "store", ventilation_hub: "plant", glassworks: "plant",
};
for (const room of Object.keys(rooms)) {
  const kind = FILL_KIND[room];
  if (!kind) throw new Error(`no wall fill for "${room}"`);
  hangings[room].push(...WALL_FILL[kind].filter((id) => !hangings[room].includes(id)));
}
for (const [room, ids] of Object.entries(hangings)) {
  if (!rooms[room]) throw new Error(`hangings for unknown room "${room}"`);
  rooms[room].push(...ids.filter((id) => !rooms[room].includes(id)));
}
for (const room of Object.keys(rooms)) if (!hangings[room]) throw new Error(`nothing hangs in "${room}"`);

const colors = {
  metal: "#8f949b", steel: "#b7bcc2", dark: "#3b3f45", rubber: "#2a2a2c", panel: "#cfc8bb", white: "#e4e0d8", cream: "#e8dcc0",
  composite: "#a88a66", cushion: "#7c6a5a", plant: "#5f9e4a", leaf: "#7cc05a", soil: "#5a3a28", water: "#4f9fc8", mirror: "#8fc7d9",
  rust: "#a0522d", copper: "#b87333", stone: "#8a7a6c", hazard: "#e0a03a", board: "#2f4a3a", glow: "#9fd2ff", grow: "#f0a8ff",
  fire: "#ff8a3d", lamp: "#ffe2b0", power: "#f4d35e", blueprint: "#3d6fb0", fibre: "#7a6352",
  potato: "#4f7a3a", soy: "#9cbf5a", stalk: "#b8a060", wheat: "#d8b35a", barley: "#cdbf86", substrate: "#4a3526",
  mushroom: "#e6dccb", cap: "#b08a64", algae: "#3f9a5a", hemp: "#6f8f3e", hempLeaf: "#5c8a34", flower: "#f2f0e0", red: "#c8423a",
};

// What gives light, and where from (in the item's own frame): lamps, fires, grow lights. The 3D view
// pools each one's light on the floor, and lights the nearest few properly. Kinds set the colour.
// [kind, at, reach (m), strength 0..1+]
const LIGHT_KINDS = { lamp: "#ffd29a", grow: "#f0a0ff", fire: "#ff8a3d", cool: "#bfe0ff" };
const LIGHTS = {
  wall_lamp: ["lamp", [0, 0.05, 0.45], 4, 1],
  work_light: ["lamp", [0, 0.02, 0.2], 5, 1],
  floor_lamp: ["lamp", [0, 1.45, 0], 4, 1],
  side_table: ["lamp", [0.08, 0.8, 0.05], 2.5, 0.6],
  lamp_post: ["lamp", [0.4, 2.7, 0], 6, 1.2],
  kitchenette: ["lamp", [0, 1.45, 0.1], 3, 0.7],
  stove_counter: ["lamp", [0, 1.8, 0.1], 3, 0.7],
  sink_basin: ["lamp", [0, 1.9, 0], 2.5, 0.5],
  bathroom_pod: ["lamp", [0.5, 2.05, 0.85], 3, 0.6],
  workbench: ["lamp", [0, 2.0, -0.2], 3.5, 0.8],
  fab_bench: ["cool", [-0.5, 1.5, 0.15], 3, 0.6],
  grow_light: ["grow", [0, 0, 0.3], 4, 0.8],
  fireplace: ["fire", [0, 0.4, 0.4], 4.5, 1.1],
  furnace: ["fire", [0, 0.9, 1.4], 7, 1.6],
  welding_station: ["fire", [0.1, 1.0, 0.2], 3.5, 0.9],
  reactor_vessel: ["fire", [0, 1.2, 0.9], 4, 0.8],
  candle_stand: ["fire", [0, 1.12, 0], 2.5, 0.6],
  memorial: ["fire", [0, 0.45, 0.3], 2.5, 0.5],
  serving_counter: ["cool", [0, 1.7, 0.5], 3, 0.4],
  decon_arch: ["cool", [0, 2.45, 0.4], 3.5, 0.7],
  elevator_car: ["cool", [0, 2.45, 0.9], 3, 0.6],
  ...Object.fromEntries(
    Object.keys(items)
      .filter((id) => id.startsWith("hydroponic_rack") || id.startsWith("planter_bed"))
      .map((id) => [id, ["grow", [0, 2.45, 0], 3.5, 0.7]]),
  ),
};
for (const [id, [kind, at, reach, strength]] of Object.entries(LIGHTS)) {
  if (!items[id]) throw new Error(`light for unknown item "${id}"`);
  items[id].light = { color: LIGHT_KINDS[kind], at, reach, strength };
}

// Where people go (in the item's own frame; the 3D view puts colonists there): a seat (sitting, facing
// +z, "at" the top of the seat), a bed (lying along x, head toward -x, "at" the top of the mattress), or a
// work post (standing on the floor at "at", facing the item). [kind, at] or [kind, at, turn in degrees].
const post = (id, out = 0.35) => [["post", [0, 0, up(items[id].size[1] / 2 + out)], 180]];
const SPOTS = {
  chair: [["seat", [0, 0.48, 0.02]]],
  office_chair: [["seat", [0, 0.55, 0.04]]],
  stool: [["seat", [0, 0.49, 0]]],
  armchair: [["seat", [0, 0.56, 0.08]]],
  sofa: [["seat", [-0.42, 0.56, 0.08]], ["seat", [0.42, 0.56, 0.08]]],
  bench: [["seat", [-0.45, 0.47, 0]], ["seat", [0.45, 0.47, 0]]],
  student_desk: [["seat", [0, 0.48, 0.4], 180]],
  bed: [["bed", [0, 0.55, 0]]],
  bunk_bed: [["bed", [0, 0.54, 0]], ["bed", [0, 1.44, 0]]],
  double_bed: [["bed", [0, 0.6, -0.4]], ["bed", [0, 0.6, 0.4]]],
  medical_bed: [["bed", [0.1, 0.82, 0]]],
  console: post("console"),
  workbench: post("workbench"),
  stove_counter: post("stove_counter"),
  prep_counter: post("prep_counter"),
  serving_counter: [["post", [0, 0, -0.75], 0]],
  lathe: post("lathe"),
  fab_bench: post("fab_bench"),
  drill_press: post("drill_press"),
  welding_station: post("welding_station"),
  blueprint_table: post("blueprint_table"),
  clean_hood: post("clean_hood"),
  seed_table: post("seed_table"),
  printer_3d: post("printer_3d"),
  furnace: post("furnace", 0.9),
  scanner: post("scanner"),
};
for (const [id, list] of Object.entries(SPOTS)) {
  if (!items[id]) throw new Error(`spots for unknown item "${id}"`);
  items[id].spots = list.map(([kind, at, turn]) => ({ kind, at, ...(turn ? { turn } : {}) }));
}

// Every item a room lists exists, and every item is used somewhere.
for (const [room, ids] of Object.entries(rooms)) for (const id of ids) if (!items[id]) throw new Error(`${room}: no item "${id}"`);
const unused = Object.keys(items).filter((id) => !Object.values(rooms).some((ids) => ids.includes(id)));
if (unused.length) console.warn("unused items:", unused.join(", "));

// Hangings fit under the ceiling: floors are 4 m, and floor 1's walls stop a little short.
for (const [id, it] of Object.entries(items)) if (it.mount && it.mount + it.size[2] > 3.6) throw new Error(`${id} hangs too high`);

// Written compactly: one line per part.
const note =
  "Furniture for the 3D rooms (docs/PLAN-M10.md), written by scripts/furniture.mjs: edit that and run it, not this. Metres. Each item's footprint (size: width x depth x height) is centred on x = 0, z = 0, with y = 0 the floor; its back is -z, against its wall, and its front +z faces into the room. Parts: s = box | cyl | sph; p = centre; z = size (box [x, y, z], cyl [diameter, height], sph [diameter]); c = a colour name, or 'accent' for the room's category colour; r = rotation in degrees [x, y, z]; glow = lights up at night. rooms lists what each room type may hold.";
const J = (o) => JSON.stringify(o).replace(/,/g, ", ").replace(/:/g, ": ");
const lines = ["{", `  "_note": ${JSON.stringify(note)},`, '  "colors": {'];
Object.entries(colors).forEach(([k, v], i, all) => lines.push(`    ${JSON.stringify(k)}: ${JSON.stringify(v)}${i < all.length - 1 ? "," : ""}`));
lines.push("  },", '  "items": {');
Object.entries(items).forEach(([id, it], i, all) => {
  lines.push(`    ${JSON.stringify(id)}: { "name": ${JSON.stringify(it.name)}, "size": ${J(it.size)},${it.mount ? ` "mount": ${it.mount},` : ""}${it.opening ? ` "opening": true,` : ""}${it.climb ? ` "climb": true,` : ""}${it.light ? ` "light": ${J(it.light)},` : ""}${it.spots ? ` "spots": ${J(it.spots)},` : ""} "parts": [`);
  it.parts.forEach((p, j) => lines.push(`      ${J(p)}${j < it.parts.length - 1 ? "," : ""}`));
  lines.push(`    ] }${i < all.length - 1 ? "," : ""}`);
});
lines.push("  },", '  "rooms": {');
Object.entries(rooms).forEach(([r, ids], i, all) => lines.push(`    ${JSON.stringify(r)}: ${J(ids)}${i < all.length - 1 ? "," : ""}`));
lines.push("  }", "}");
writeFileSync(new URL("../data/furniture.json", import.meta.url), lines.join("\n") + "\n");
console.log(`${Object.keys(items).length} items, ${Object.keys(rooms).length} rooms`);
