import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { LightShaft } from "../src/render3d/shafts3d";

describe("light shafts", () => {
  it("fall down the shaft around midday, not at dawn, dusk or night, nor in a storm", () => {
    const s = new LightShaft();
    s.fit(8, 30);
    const box = new THREE.Box3().setFromObject(s.mesh);
    expect(box.max.y).toBeCloseTo(0, 1);
    expect(box.min.y).toBeLessThan(-29);
    s.update(new THREE.Vector3(0.2, 0.97, 0.1).normalize(), 0, true);
    expect(s.mesh.visible).toBe(true);
    s.update(new THREE.Vector3(0.9, 0.2, 0.3).normalize(), 0, true);
    expect(s.mesh.visible).toBe(false);
    s.update(new THREE.Vector3(0, -1, 0), 0, true);
    expect(s.mesh.visible).toBe(false);
    s.update(new THREE.Vector3(0.2, 0.97, 0.1).normalize(), 1, true);
    expect(s.mesh.visible).toBe(false);
    // Not shown (a floor picked): hidden however bright.
    s.update(new THREE.Vector3(0, 1, 0), 0, false);
    expect(s.mesh.visible).toBe(false);
  });
});
