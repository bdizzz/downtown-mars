import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildTerrain, horizonStyle, siteSeed } from "../src/render3d/terrain3d";

describe("the land round a hole", () => {
  const mat = new THREE.MeshStandardMaterial();

  it("is flat by the rim, where surface buildings stand, and rolls beyond", () => {
    const t = buildTerrain(10, 42, mat);
    for (const a of [0, 1, 2, 3, 4, 5]) {
      expect(t.heightAt(30 * Math.cos(a), 30 * Math.sin(a))).toBe(0);
    }
    const far = Array.from({ length: 60 }, (_, i) => t.heightAt(400 * Math.cos(i / 10), 400 * Math.sin(i / 10)));
    expect(Math.max(...far) - Math.min(...far)).toBeGreaterThan(1);
  });

  it("is the same for the same site, and varies between sites", () => {
    const a = buildTerrain(10, siteSeed({ lat: 12.3, lon: -45.6 }, "A"), mat);
    const b = buildTerrain(10, siteSeed({ lat: 12.3, lon: -45.6 }, "B"), mat);
    expect(a.style).toBe(b.style);
    expect(a.heightAt(300, 200)).toBe(b.heightAt(300, 200));
    const styles = new Set(Array.from({ length: 40 }, (_, i) => horizonStyle(siteSeed({ lat: i * 3, lon: i * 7 }, ""))));
    expect(styles).toEqual(new Set(["mountains", "mesas", "hills"]));
  });

  const landforms = (t: ReturnType<typeof buildTerrain>) => t.group.children.filter((o): o is THREE.Mesh => o.name === "landform");
  const seeds = Array.from({ length: 30 }, (_, i) => siteSeed({ lat: i * 5 - 70, lon: i * 11 - 160 }, ""));

  it("has landforms of its own toward the horizon, several of them, at different distances", () => {
    for (const seed of seeds) {
      const t = buildTerrain(10, seed, mat);
      const forms = landforms(t);
      // Every style has a plateau and a crater or more besides its own kind (3+ mesas, 4+ massifs, 3+ hills).
      expect(forms.length).toBeGreaterThanOrEqual(5);
      const far = forms.map((m) => {
        m.geometry.computeBoundingBox();
        const c = m.geometry.boundingBox!.getCenter(new THREE.Vector3());
        return Math.hypot(c.x, c.z);
      });
      for (const d of far) expect(d).toBeGreaterThan(400);
      expect(Math.max(...far) - Math.min(...far)).toBeGreaterThan(150);
    }
  });

  it("builds its landforms as solids facing outward, standing on the ground", () => {
    const t = buildTerrain(10, seeds[3]!, mat);
    for (const m of landforms(t)) {
      const g = m.geometry;
      g.computeBoundingBox();
      const box = g.boundingBox!;
      const mid = box.getCenter(new THREE.Vector3());
      const p = g.getAttribute("position");
      const n = g.getAttribute("normal");
      let out = 0;
      let faces = 0;
      for (let i = 0; i < p.count; i += 3) {
        const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3;
        const cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
        const toward = (cx - mid.x) * n.getX(i) + (cz - mid.z) * n.getZ(i);
        if (Math.abs(toward) < 1e-6 && n.getY(i) === 0) continue;
        faces++;
        if (toward > 0 || n.getY(i) > 0.9) out++;
      }
      // The sides face away from the middle and the tops up (a crater's inner wall faces in, so not all).
      expect(out / faces).toBeGreaterThan(0.6);
      // Its foot is at or below the ground beneath it.
      expect(box.min.y).toBeLessThanOrEqual(t.heightAt(mid.x, mid.z));
    }
  });
});

describe("the land by the kind of place (#497)", () => {
  const mat = new THREE.MeshStandardMaterial();
  const at = (site: { lat: number; lon: number }) => buildTerrain(10, siteSeed(site, ""), mat, null, site);
  /** The skyline's height in 36 directions: the highest point of the horizon ridge (or the canyon's walls) in each 10°. */
  const skyline = (t: ReturnType<typeof buildTerrain>, part = "horizon") => {
    const p = (t.group.children.find((o) => o.name === part) as THREE.Mesh).geometry.getAttribute("position");
    const top = new Array<number>(36).fill(0);
    for (let i = 0; i < p.count; i++) {
      const k = Math.floor(((Math.atan2(p.getZ(i), p.getX(i)) + Math.PI) / (Math.PI * 2)) * 36) % 36;
      top[k] = Math.max(top[k]!, p.getY(i));
    }
    return top;
  };
  const landforms = (t: ReturnType<typeof buildTerrain>) => t.group.children.filter((o) => o.name === "landform").length;

  it("follows the place: Gale a crater, Valles a canyon, Hellas a basin, Sirenum highland, Olympus a volcano", () => {
    expect(at({ lat: -5.4, lon: 137.8 }).style).toBe("crater");
    expect(at({ lat: -12, lon: 295 }).style).toBe("canyon");
    expect(at({ lat: -42, lon: 70 }).style).toBe("basin");
    expect(at({ lat: -40, lon: 210 }).style).toBe("highland");
    expect(at({ lat: 18.6, lon: 226.2 }).style).toBe("volcano");
    // Elsewhere (ice, equatorial, ordinary), as before: by the site's seed alone.
    for (const site of [{ lat: 65, lon: 30 }, { lat: -5, lon: 170 }, { lat: 35, lon: 0 }]) {
      expect(at(site).style).toBe(horizonStyle(siteSeed(site, "")));
    }
  });

  it("a crater's rim stands all round; a basin's edge is low all round", () => {
    const rim = skyline(at({ lat: -5.4, lon: 137.8 }), "walls");
    expect(Math.min(...rim)).toBeGreaterThan(80);
    const basin = skyline(at({ lat: -42, lon: 70 }));
    expect(Math.max(...basin)).toBeLessThan(15);
  });

  it("a canyon has high walls on two sides and opens at the ends; a volcano rises on one side only", () => {
    const canyon = skyline(at({ lat: -12, lon: 295 }), "walls");
    expect(Math.max(...canyon)).toBeGreaterThan(120);
    expect(Math.min(...canyon)).toBeLessThan(30);
    // Walls opposite each other: the highest direction's far side is high too.
    const hi = canyon.indexOf(Math.max(...canyon));
    expect(Math.max(...[-2, -1, 0, 1, 2].map((d) => canyon[(hi + 18 + d + 36) % 36]!))).toBeGreaterThan(100);
    const volcano = skyline(at({ lat: 18.6, lon: 226.2 }));
    const peak = volcano.indexOf(Math.max(...volcano));
    expect(volcano[peak]!).toBeGreaterThan(200);
    expect(volcano[(peak + 18) % 36]!).toBeLessThan(40);
  });

  it("a canyon's walls face the hole, and say how far up them each point stands, for the beds", () => {
    const walls = at({ lat: -12, lon: 295 }).group.children.find((o) => o.name === "walls") as THREE.Mesh;
    const g = walls.geometry;
    const p = g.getAttribute("position");
    const h = g.getAttribute("landH");
    let inward = 0;
    let faces = 0;
    for (let i = 0; i < p.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(p, i);
      const u = new THREE.Vector3().fromBufferAttribute(p, i + 1).sub(a);
      const v = new THREE.Vector3().fromBufferAttribute(p, i + 2).sub(a);
      const n = u.cross(v);
      if (n.lengthSq() < 1e-9) continue;
      faces++;
      if (n.x * a.x + n.z * a.z < 0 || n.y > 0) inward++;
    }
    expect(inward / faces).toBeGreaterThan(0.97);
    const hs = Array.from(h.array as Float32Array);
    expect(Math.min(...hs)).toBeLessThan(0);
    expect(Math.max(...hs)).toBeCloseTo(1, 2);
  });

  it("a canyon has a landslide below one wall and dunes on its floor; a crater dunes too; a volcano lava flows", () => {
    const canyon = at({ lat: -12, lon: 295 });
    // The landslide's lobe and the dunes lift the floor well above the plain's rolls somewhere.
    let most = 0;
    for (let r = 400; r < 1100; r += 10) for (let a = 0; a < Math.PI * 2; a += 0.01) most = Math.max(most, canyon.heightAt(r * Math.cos(a), r * Math.sin(a)));
    expect(most).toBeGreaterThan(25);
    const flows = (t: ReturnType<typeof buildTerrain>) => t.group.children.filter((o) => o.name === "landform").length;
    const volcano = at({ lat: 18.6, lon: 226.2 });
    // Lava domes and a crater (4–5), plus 3–4 flows.
    expect(flows(volcano)).toBeGreaterThanOrEqual(7);
  });

  it("casts far shadows: walls where they stand, the horizon elsewhere, and the biggest landforms", () => {
    const t = at({ lat: -12, lon: 295 });
    const starts = Array.from({ length: 512 }, (_, j) => t.shadows.occluder[j * 2]!);
    // Walls about a kilometre out on two sides; the horizon at 1.5 km down the canyon's line.
    expect(Math.min(...starts)).toBeLessThan(1300);
    expect(Math.max(...starts)).toBeGreaterThan(1400);
    expect(t.shadows.forms.length).toBeGreaterThan(0);
    for (const [, , r, top] of t.shadows.forms) {
      expect(r).toBeGreaterThan(0);
      expect(top).toBeGreaterThan(20);
    }
  });

  it("highlands are crowded with crater rims and plateaus; a canyon floor with mesas", () => {
    expect(landforms(at({ lat: -40, lon: 210 }))).toBeGreaterThanOrEqual(6);
    expect(landforms(at({ lat: -12, lon: 295 }))).toBeGreaterThanOrEqual(5);
  });
});

describe("a canyon in the Godot viewer, through the bridge (#497)", () => {
  it("sends the walls with their colours among the landforms, and the horizon on its own", async () => {
    const { terrainMessage } = await import("../src/bridge/terrain");
    const { createInitialState } = await import("../src/sim/state");
    const { config } = await import("../src/sim/config");
    const s = createInitialState(config, { holeId: 2, name: "Valles", site: { lat: -12, lon: 295 }, deposits: [], seed: 5 });
    const m = terrainMessage(s);
    expect(m.style).toBe("canyon");
    expect(m.horizon.mesh.colors).toBeUndefined();
    // The walls (coloured by the rock and hazed), the buttresses and the sculpted mesas (their baked shade);
    // every landform says how far up it each vertex stands.
    const colored = m.landforms.filter((f) => f.mesh.colors);
    expect(colored.length).toBeGreaterThanOrEqual(3);
    for (const f of colored) expect(Buffer.from(f.mesh.colors!, "base64").length).toBe(Buffer.from(f.mesh.positions, "base64").length);
    for (const f of m.landforms) expect(Buffer.from(f.mesh.heights!, "base64").length * 3).toBe(Buffer.from(f.mesh.positions, "base64").length);
  });
});

describe("the pieces sculpted in Blender (#497)", () => {
  it("decode from public/models/land.bin to unit-frame shapes with their baked shade", async () => {
    const { piece, setPieces } = await import("../src/render3d/landPieces");
    const { readFileSync } = await import("node:fs");
    setPieces(readFileSync("public/models/land.bin"));
    for (const name of ["mesa_a", "butte_b", "mound", "buttress_c"] as const) {
      const p = piece(name);
      expect(p.indices.length % 3).toBe(0);
      expect(Math.max(...p.indices)).toBeLessThan(p.positions.length / 3);
      const ys = p.positions.filter((_, i) => i % 3 === 1);
      expect(Math.max(...ys)).toBeGreaterThan(0.95);
      expect(Math.max(...ys)).toBeLessThan(1.12);
      expect(Math.min(...p.shade)).toBeGreaterThan(0);
      expect(Math.min(...p.shade)).toBeLessThan(0.9);
    }
  });

  it("stand in for mesas and the crater's mound, and line a canyon's walls", () => {
    const mat = new THREE.MeshStandardMaterial();
    const canyon = buildTerrain(10, siteSeed({ lat: -12, lon: 295 }, ""), mat, null, { lat: -12, lon: 295 });
    const shaded = canyon.group.children.filter((o) => o.name === "landform" && (o as THREE.Mesh).geometry.getAttribute("color"));
    // The mesas on its floor, and the buttresses (one mesh).
    expect(shaded.length).toBeGreaterThanOrEqual(3);
  });
});
