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
