import * as THREE from "three";
import type { Hole } from "../sim/geometry";
import { floorSpan, openShaftRadius, TAU } from "./cylinder";
import { softDot } from "./effects3d";

// A festival in the shaft (PLAN-M14): strings of coloured lights looped along
// every floor's gallery, sagging between hangers, and paper lanterns drifting
// up the middle of the shaft to the rim. Shown only while a festival is on.

const LIGHTS = { perMetre: 1.2, size: 0.09, sag: 0.35, span: 3, below: 0.7, colors: [0xffb35c, 0xf2c84b, 0xff7a5c, 0x8fd0ff, 0xb8f28f] };
const LANTERNS = { count: 90, rise: 0.9, size: 0.55, sway: 0.4 };

export class Festival {
  readonly group = new THREE.Group();
  private lights: THREE.InstancedMesh | null = null;
  private string: THREE.LineSegments | null = null;
  private readonly lanterns: THREE.Points;
  private readonly lanternPos = new Float32Array(LANTERNS.count * 3);
  private readonly phase = new Float32Array(LANTERNS.count);
  private depth = 1;
  private radius = 1;
  private key = "";
  private t = 0;

  constructor() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.lanternPos, 3));
    this.lanterns = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xffa64d, size: LANTERNS.size, map: softDot(), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.group.add(this.lanterns);
    this.group.visible = false;
  }

  /** Build the lights for this hole, from `topFloor` down (all floors with none picked). */
  sync(hole: Hole, topFloor: number | null): void {
    const key = `${hole.shaftRadiusM}:${hole.floors}:${topFloor}`;
    if (key === this.key) return;
    this.key = key;
    if (this.lights) {
      this.group.remove(this.lights, this.string!);
      this.lights.geometry.dispose();
      (this.lights.material as THREE.Material).dispose();
      this.string!.geometry.dispose();
      (this.string!.material as THREE.Material).dispose();
    }
    const r = openShaftRadius(hole) - 0.15;
    const floors: number[] = [];
    for (let f = topFloor ?? 1; f <= hole.floors; f++) floors.push(f);
    const count = Math.max(1, Math.round(TAU * r * LIGHTS.perMetre));
    const spans = Math.max(3, Math.round((TAU * r) / LIGHTS.span));
    const lights = new THREE.InstancedMesh(
      new THREE.SphereGeometry(LIGHTS.size, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      count * floors.length,
    );
    const linePos: number[] = [];
    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    let i = 0;
    for (const floor of floors) {
      const top = floorSpan(floor)[1] - LIGHTS.below;
      // Height along the loop: hung at each hanger, sagging between.
      const y = (a: number) => {
        const u = ((a / TAU) * spans) % 1;
        return top - LIGHTS.sag * Math.sin(Math.PI * u);
      };
      for (let k = 0; k < count; k++) {
        const a = (k / count) * TAU;
        m.makeTranslation(r * Math.cos(a), y(a) - 0.06, r * Math.sin(a));
        lights.setMatrixAt(i, m);
        lights.setColorAt(i, color.setHex(LIGHTS.colors[k % LIGHTS.colors.length]!));
        i++;
      }
      const steps = spans * 8;
      for (let k = 0; k < steps; k++) {
        const a0 = (k / steps) * TAU;
        const a1 = ((k + 1) / steps) * TAU;
        linePos.push(r * Math.cos(a0), y(a0), r * Math.sin(a0), r * Math.cos(a1), y(a1), r * Math.sin(a1));
      }
    }
    lights.instanceMatrix.needsUpdate = true;
    if (lights.instanceColor) lights.instanceColor.needsUpdate = true;
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePos, 3));
    this.string = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0x3a2a22 }));
    this.lights = lights;
    this.group.add(lights, this.string);

    // Lanterns: scattered up the shaft from the bottom of the dug floors to the rim.
    this.depth = -floorSpan(Math.max(1, hole.floors))[0];
    this.radius = openShaftRadius(hole) - 1;
    for (let k = 0; k < LANTERNS.count; k++) {
      const a = (k * 2.399963) % TAU;
      const rr = Math.sqrt(((k * 0.618034) % 1) * 0.9 + 0.05) * this.radius;
      this.lanternPos.set([rr * Math.cos(a), -((k * 0.37) % 1) * this.depth, rr * Math.sin(a)], k * 3);
      this.phase[k] = (k * 1.7) % TAU;
    }
    this.lanterns.geometry.attributes.position!.needsUpdate = true;
  }

  /** Lanterns rise and sway; at the rim they start again at the bottom. Lights twinkle. */
  step(dt: number): void {
    this.t += dt;
    for (let k = 0; k < LANTERNS.count; k++) {
      let y = this.lanternPos[k * 3 + 1]! + LANTERNS.rise * dt * (0.7 + 0.6 * ((k * 0.31) % 1));
      if (y > 2) y -= this.depth + 2;
      this.lanternPos[k * 3 + 1] = y;
      this.lanternPos[k * 3] = this.lanternPos[k * 3]! + Math.sin(this.t * 0.6 + this.phase[k]!) * LANTERNS.sway * dt;
    }
    this.lanterns.geometry.attributes.position!.needsUpdate = true;
    (this.lanterns.material as THREE.PointsMaterial).opacity = 0.75 + 0.15 * Math.sin(this.t * 3);
  }

  dispose(): void {
    (this.lanterns.material as THREE.PointsMaterial).map?.dispose();
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
  }
}
