import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createHatches, HATCH_MOTION, hatchGroup, type HatchMaterials } from "../src/render3d/bulkhead3d";

// #614: a bulkhead's hatch stands open in Free view; in first person it's shut until you come near.

const mat = new THREE.MeshBasicMaterial();
const mats: HatchMaterials = { wall: mat, rim: mat, door: mat, wheel: mat, stripe: mat };

function scene() {
  const root = new THREE.Group();
  const { group, rig } = hatchGroup(3, mats);
  group.userData = { hatch: { id: "R1.1.2", floor: 1, x: 10, z: 0 } };
  root.add(group);
  const sounds: boolean[] = [];
  const hatches = createHatches((opening) => sounds.push(opening));
  hatches.collect(root);
  return { rig, hatches, sounds };
}

/** Run the hatches for a while, a frame at a time. */
const run = (h: ReturnType<typeof scene>["hatches"], seconds: number, walker: { floor: number; x: number; z: number } | null) => {
  for (let t = 0; t < seconds; t += 0.05) h.step(0.05, walker);
};

describe("bulkhead hatches", () => {
  it("stand open in Free view, and are found by id", () => {
    const { rig, hatches } = scene();
    expect(hatches.spots.map((s) => s.id)).toEqual(["R1.1.2"]);
    run(hatches, 1, null);
    expect(rig.hinge.rotation.y).toBeCloseTo(-HATCH_MOTION.swing);
  });

  it("shut in first person, open as you come near (wheel first), and shut once you've gone, with a sound each way", () => {
    const { rig, hatches, sounds } = scene();
    const far = { floor: 1, x: 20, z: 0 };
    run(hatches, 0.1, far);
    expect(rig.hinge.rotation.y).toBeCloseTo(0);
    expect(sounds).toEqual([]); // going into first person is silent
    const near = { floor: 1, x: 12, z: 0 };
    hatches.step(0.05, near);
    hatches.step(HATCH_MOTION.seconds * HATCH_MOTION.spinShare * 0.5, near);
    expect(rig.wheel.rotation.z).toBeGreaterThan(0); // the wheel turns...
    expect(rig.hinge.rotation.y).toBeCloseTo(0); // ...before the door moves
    run(hatches, HATCH_MOTION.seconds + 0.2, near);
    expect(rig.hinge.rotation.y).toBeCloseTo(-HATCH_MOTION.swing);
    // Stepping just past where it opened keeps it open (it shuts further out).
    run(hatches, 0.5, { floor: 1, x: 10 + (HATCH_MOTION.openM + HATCH_MOTION.closeM) / 2, z: 0 });
    expect(rig.hinge.rotation.y).toBeCloseTo(-HATCH_MOTION.swing);
    run(hatches, HATCH_MOTION.seconds + 0.2, far);
    expect(rig.hinge.rotation.y).toBeCloseTo(0);
    expect(sounds).toEqual([true, false]);
  });

  it("stay shut for a walker on another floor", () => {
    const { rig, hatches } = scene();
    run(hatches, 2, { floor: 2, x: 10, z: 0 });
    expect(rig.hinge.rotation.y).toBeCloseTo(0);
  });
});
