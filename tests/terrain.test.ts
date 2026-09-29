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
});
