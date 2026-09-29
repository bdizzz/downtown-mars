import * as THREE from "three";
import { softDot } from "./effects3d";

// Grit on the wind in a dust storm: motes streaming past the camera,
// thicker as the storm builds. They live in a box round the camera, above
// the ground, and wrap round it as they blow through, so there are always
// some in view without filling the planet.

const GRIT = {
  count: 1400,
  /** The box round the camera (metres): how far out, and how high above the ground. */
  reach: 28,
  height: 14,
  /** Wind speeds, metres a second, and how much each mote wanders up and down. */
  speed: [9, 18] as const,
  lift: 1.2,
  size: 0.14,
  color: 0xc49468,
  opacity: 0.75,
};

export class Grit {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private vel: Float32Array;
  private material: THREE.PointsMaterial;
  private level = 0;
  /** The wind's direction, radians about y. */
  private wind = 0.6;

  constructor() {
    this.pos = new Float32Array(GRIT.count * 3);
    this.vel = new Float32Array(GRIT.count * 3);
    let s = 12345;
    const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);
    for (let i = 0; i < GRIT.count; i++) {
      this.pos.set([(rand() * 2 - 1) * GRIT.reach, rand() * GRIT.height, (rand() * 2 - 1) * GRIT.reach], i * 3);
      const v = GRIT.speed[0] + (GRIT.speed[1] - GRIT.speed[0]) * rand();
      this.vel.set([v, (rand() * 2 - 1) * GRIT.lift, v * (rand() * 0.3 - 0.15)], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.material = new THREE.PointsMaterial({ color: GRIT.color, size: GRIT.size, map: softDot(), transparent: true, opacity: 0, depthWrite: false });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.visible = false;
  }

  /** How hard it's blowing, 0 to 1. */
  setLevel(level: number): void {
    this.level = level;
    this.material.opacity = GRIT.opacity * level;
    this.points.visible = level > 0.01;
  }

  /**
   * Blow on by dt seconds round the camera. Motes stay above the ground
   * (y = 0); the whole box follows the camera across the land.
   */
  step(dt: number, camera: THREE.Vector3): void {
    if (this.level <= 0.01) return;
    const c = Math.cos(this.wind);
    const s = Math.sin(this.wind);
    const r = GRIT.reach;
    for (let i = 0; i < GRIT.count; i++) {
      const k = i * 3;
      const vx = this.vel[k]!;
      const vz = this.vel[k + 2]!;
      // Along the wind, turned to its direction.
      let x = this.pos[k]! + (vx * c - vz * s) * dt;
      let y = this.pos[k + 1]! + this.vel[k + 1]! * dt;
      let z = this.pos[k + 2]! + (vx * s + vz * c) * dt;
      // Wrap round the camera's box.
      const dx = x - camera.x;
      const dz = z - camera.z;
      if (dx > r) x -= 2 * r;
      else if (dx < -r) x += 2 * r;
      if (dz > r) z -= 2 * r;
      else if (dz < -r) z += 2 * r;
      if (y < 0.2) y += GRIT.height;
      else if (y > GRIT.height) y -= GRIT.height;
      this.pos[k] = x;
      this.pos[k + 1] = y;
      this.pos[k + 2] = z;
    }
    this.points.geometry.attributes.position!.needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}
