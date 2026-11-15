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
  /** The skyline's height in 36 directions: the highest point of the horizon ridge in each 10°. */
  const skyline = (t: ReturnType<typeof buildTerrain>) => {
    const p = (t.group.children.find((o) => o.name === "horizon") as THREE.Mesh).geometry.getAttribute("position");
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
    const rim = skyline(at({ lat: -5.4, lon: 137.8 }));
    expect(Math.min(...rim)).toBeGreaterThan(50);
    const basin = skyline(at({ lat: -42, lon: 70 }));
    expect(Math.max(...basin)).toBeLessThan(15);
  });

  it("a canyon has high walls on two sides and opens at the ends; a volcano rises on one side only", () => {
    const canyon = skyline(at({ lat: -12, lon: 295 }));
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

  it("highlands are crowded with crater rims and plateaus; a canyon floor with mesas", () => {
    expect(landforms(at({ lat: -40, lon: 210 }))).toBeGreaterThanOrEqual(6);
    expect(landforms(at({ lat: -12, lon: 295 }))).toBeGreaterThanOrEqual(5);
  });
});
