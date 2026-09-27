import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { createHole } from "../src/sim/geometry";
import { FLOOR_H, polar, ringRadii, slotAngles } from "../src/render3d/cylinder";
import { inCarvedRegion, pickPast, rayCylinder, rayPlane, surfacePickAt } from "../src/render3d/pick3d";

const hole = createHole(10, 3, 3, config.geometry);
const ray = (from: [number, number, number], to: [number, number, number]) => {
  const o = new THREE.Vector3(...from);
  return new THREE.Ray(o, new THREE.Vector3(...to).sub(o).normalize());
};

describe("3D picking", () => {
  it("a ray from the axis meets the wall at the shaft radius", () => {
    const r = ray([0, -2, 0], [1, -2, 0]);
    expect(rayCylinder(r, 10)).toBeCloseTo(10);
  });

  it("from outside, the first hit is the near side of the cylinder", () => {
    const r = ray([50, -2, 0], [0, -2, 0]);
    expect(rayCylinder(r, 10)).toBeCloseTo(40);
  });

  it("misses when the ray passes by, or runs parallel to the axis", () => {
    expect(rayCylinder(ray([50, -2, 20], [0, -2, 20]), 10)).toBeNull();
    expect(rayCylinder(ray([5, 10, 0], [5, -10, 0]), 10)).toBeNull();
  });

  it("stepping just past the wall lands in the ring-1 slot you're looking at", () => {
    const n = hole.ringSlots[0]!;
    const [a0, a1] = slotAngles(3, n);
    const target = polar(ringRadii(hole, 1)[0], (a0 + a1) / 2, -FLOOR_H * 1.5);
    const r = ray([0, -FLOOR_H * 1.5, 0], target);
    expect(pickPast(hole, r, rayCylinder(r, 10)!)).toMatchObject({ kind: "slot", floor: 2, ring: 1, slot: 3 });
  });

  it("the cutaway plane gives cells on the section, in any ring", () => {
    const plane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0); // the section through the axis, x = 0
    const r = ray([60, -FLOOR_H * 2.5, 35], [0, -FLOOR_H * 2.5, 35]);
    const t = rayPlane(r, plane)!;
    const p = r.at(t, new THREE.Vector3());
    expect(inCarvedRegion(hole, p)).toBe(true);
    expect(pickPast(hole, r, t)).toMatchObject({ kind: "slot", floor: 3, ring: 3 });
  });

  it("the surface pick uses the angle around the shaft", () => {
    expect(surfacePickAt(new THREE.Vector3(0, 0, 30))).toMatchObject({ kind: "surface", angle: 90 });
  });
});
