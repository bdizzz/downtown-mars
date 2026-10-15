import * as THREE from "three";
import { softDot } from "./effects3d";
import type { Hole } from "../sim/geometry";
import type { Layout } from "../sim/placement";
import { COLLAR_TOP, floorSpan, openShaftRadius, TAU } from "./cylinder";
import { SURFACE_RING_M } from "./surface3d";
import { KIT_COLOR } from "./collar3d";
import { hazardTexture } from "./drillRig";

// Things that bring the 3D shaft to life but don't depend on rooms: the
// Earth lander coming down onto the pad before a supply drop, and dust.

const LANDER = { startHeight: 60, core: 0xfff1c8, flame: 0xffb35c };

/** The shaft dome: a low glass dome over the shaft on the collar's rim, on ribs, with a ring at its foot. */
export function makeDome(hole: Hole): THREE.Group {
  const g = new THREE.Group();
  const r = hole.shaftRadiusM + 1.5;
  const rise = r * 0.45;
  // A flattened half-sphere: a sphere scaled down in height.
  const glass = new THREE.Mesh(
    new THREE.SphereGeometry(r, 48, 16, 0, TAU, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xa8d4f0, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }),
  );
  glass.scale.set(1, rise / r, 1);
  const metal = new THREE.MeshStandardMaterial({ color: 0x9aa4ab, roughness: 0.4, metalness: 0.6 });
  // Ribs: meridians from the foot to the crown.
  for (let k = 0; k < 12; k++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(r, 0.12, 6, 32, Math.PI), metal);
    rib.scale.set(1, rise / r, 1);
    rib.rotation.y = (k / 12) * Math.PI;
    g.add(rib);
  }
  const foot = new THREE.Mesh(new THREE.TorusGeometry(r, 0.35, 8, 64), metal);
  foot.rotation.x = Math.PI / 2;
  foot.position.y = 0.2;
  g.add(glass, foot);
  // Standing on the collar's rim, its foot resting on the walkway.
  g.position.y = COLLAR_TOP - 0.15;
  return g;
}

/** The band of ground surface buildings stand on, either side of where they're placed (metres out from the rim). */
const SPOT = { from: SURFACE_RING_M - 10, to: SURFACE_RING_M + 10, gap: 0.6, lift: 0.1 };

/**
 * Surface slots as patches of ground (T-107): one flat sector of the band per slot, a little apart so the
 * slots read, just above the ground. `total` is how many surface slots there are round the hole.
 */
export function surfaceSpotGeometry(hole: Hole, total: number, slots: number[]): THREE.BufferGeometry {
  const r0 = hole.shaftRadiusM + SPOT.from;
  const r1 = hole.shaftRadiusM + SPOT.to;
  const parts = slots.map((s) => {
    const gap = SPOT.gap / r0;
    const a0 = (s / total) * TAU + gap / 2;
    const a1 = ((s + 1) / total) * TAU - gap / 2;
    // A ring lies in the xy plane; laid flat (x turned -90°), its angle θ lands at -θ round the shaft.
    const g = new THREE.RingGeometry(r0, r1, 16, 1, -a1, a1 - a0);
    g.rotateX(-Math.PI / 2);
    g.translate(0, SPOT.lift, 0);
    return g.toNonIndexed();
  });
  const pos = parts.flatMap((g) => Array.from(g.getAttribute("position").array));
  parts.forEach((g) => g.dispose());
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return out;
}

/**
 * The supply lander from Earth, in the surface kit's colours (ART.md, "The surface"; Godot's Scenery.cs
 * builds the same parts): a white octagonal descent stage under a band of hazard paint, an engine bell
 * and four thruster quads, orange landing legs out to footpads, four cargo pods round a central core,
 * and a beacon and dish on top. The flame (named, for placeLander) is an amber cone round a bright core.
 * Positioned by the caller, its feet at y = 0.
 */
export function makeLander(): THREE.Group {
  const g = new THREE.Group();
  const mat = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.3, ...extra });
  const hull = mat(KIT_COLOR.hull, { roughness: 0.5 });
  const dark = mat(KIT_COLOR.dark, { metalness: 0.4 });
  const steel = mat(KIT_COLOR.steel, { metalness: 0.25, roughness: 0.55 });
  const steelDark = mat(KIT_COLOR.steelDark, { metalness: 0.25 });
  const hazardMap = hazardTexture();
  hazardMap?.repeat.set(10, 1);
  const hazard = mat(hazardMap ? 0xffffff : KIT_COLOR.rail, { map: hazardMap, metalness: 0, roughness: 0.7, side: THREE.DoubleSide });
  const beacon = mat(KIT_COLOR.beacon, { emissive: KIT_COLOR.beacon, emissiveIntensity: 1.5, metalness: 0 });
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };
  const strut = (a: THREE.Vector3, b: THREE.Vector3, radius: number, m: THREE.Material) => {
    const mesh = add(new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 6), m, 0, 0, 0);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  };
  const around = (r: number, y: number, a: number) => new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a));
  const L = LANDER_PARTS;

  // The descent stage: an octagon, dark rims, hazard paint round its middle.
  add(new THREE.CylinderGeometry(L.stageR, L.stageR, L.stageH, 8), hull, 0, L.stageY, 0).rotation.y = TAU / 16;
  for (const dy of [-1, 1]) add(new THREE.CylinderGeometry(L.stageR + 0.05, L.stageR + 0.05, 0.16, 8), dark, 0, L.stageY + (dy * L.stageH) / 2, 0).rotation.y = TAU / 16;
  add(new THREE.CylinderGeometry(L.stageR + 0.03, L.stageR + 0.03, 0.3, 8, 1, true), hazard, 0, L.stageY, 0).rotation.y = TAU / 16;
  // The engine bell, and a thruster quad at four corners.
  add(new THREE.CylinderGeometry(0.45, 1.1, 1.3, 16, 1, true), dark, 0, L.stageY - L.stageH / 2 - 0.6, 0);
  for (let k = 0; k < 4; k++) add(new THREE.BoxGeometry(0.4, 0.4, 0.4), dark, ...around(L.stageR + 0.15, L.stageY + 0.2, (k / 4) * TAU).toArray());
  // Landing legs: a main leg and a brace down to each footpad.
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + Math.PI / 4;
    const foot = around(L.footR, 0.25, a);
    strut(around(L.stageR - 0.2, L.stageY + 0.5, a), foot, 0.13, steel);
    strut(around(L.stageR - 0.3, L.stageY - L.stageH / 2, a), foot, 0.08, steelDark);
    add(new THREE.CylinderGeometry(0.5, 0.6, 0.18, 12), dark, foot.x, 0.09, foot.z);
  }
  // The cargo: four pods strapped round a central core, each with orange straps.
  const deck = L.stageY + L.stageH / 2;
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + Math.PI / 4;
    const [x, , z] = around(1.25, 0, a).toArray();
    add(new THREE.BoxGeometry(1.3, L.podH, 1.3), hull, x, deck + L.podH / 2, z).rotation.y = -a;
    for (const dy of [0.35, L.podH - 0.35]) add(new THREE.BoxGeometry(1.34, 0.12, 1.34), steel, x, deck + dy, z).rotation.y = -a;
  }
  add(new THREE.CylinderGeometry(0.7, 0.8, L.podH + 0.6, 12), hull, 0, deck + (L.podH + 0.6) / 2, 0);
  const crown = deck + L.podH + 0.6;
  add(new THREE.CylinderGeometry(0.2, 0.7, 0.7, 12), hull, 0, crown + 0.35, 0);
  add(new THREE.SphereGeometry(0.18, 10, 6), beacon, 0, crown + 0.85, 0);
  const dish = add(new THREE.CylinderGeometry(0.5, 0.08, 0.2, 14, 1, true), steelDark, 0.9, crown - 0.1, 0.9);
  dish.rotation.set(0.5, 0, -0.5);
  // The flame: an amber cone round a white-hot core.
  const flame = new THREE.Group();
  flame.name = "flame";
  flame.position.y = L.stageY - L.stageH / 2 - 1.25;
  const outer = new THREE.Mesh(new THREE.ConeGeometry(1.2, 4.5, 14, 1, true), new THREE.MeshStandardMaterial({ color: LANDER.flame, emissive: LANDER.flame, emissiveIntensity: 2, transparent: true, opacity: 0.7, depthWrite: false }));
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.6, 2.6, 12), new THREE.MeshStandardMaterial({ color: LANDER.core, emissive: LANDER.core, emissiveIntensity: 3 }));
  outer.rotation.x = core.rotation.x = Math.PI;
  outer.position.y = -2.25;
  core.position.y = -1.3;
  flame.add(outer, core);
  g.add(flame);
  g.visible = false;
  return g;
}

/** The lander's sizes (Godot's Scenery.cs has the same): the descent stage, the cargo pods' height, and how far out the feet stand. */
const LANDER_PARTS = { stageR: 2.4, stageH: 1.5, stageY: 2.3, podH: 1.6, footR: 3.7 };

/**
 * Place the lander: t runs 0 (high up) to 1 (touching down), easing in to
 * land on the pad. Hidden when there's no pad or no drop coming.
 */
export function placeLander(lander: THREE.Group, layout: Layout, t: number | null): void {
  const pad = layout.rooms.find((r) => r.type === "landing_pad");
  if (!pad || t === null) {
    lander.visible = false;
    return;
  }
  const total = layout.surface.length;
  const mid = ((Math.min(...pad.surfaceCells) + pad.surfaceCells.length / 2) / total) * TAU;
  const r = layout.hole.shaftRadiusM + SURFACE_RING_M;
  const ease = 1 - (1 - t) * (1 - t);
  lander.visible = true;
  lander.position.set(r * Math.cos(mid), 0.5 + LANDER.startHeight * (1 - ease), r * Math.sin(mid));
  const flame = lander.getObjectByName("flame");
  if (flame) flame.visible = t < 0.97;
}

// ---- dust: purely cosmetic, never part of the simulation (colonists are in people3d.ts) ----

const DUST = { count: 260, fall: 0.25, size: 0.12 };

/** A deterministic scatter for cosmetics, so the same colony looks the same each load. */
function scatter(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Motes drifting down the open shaft, caught in the lamplight. */
export class Dust {
  readonly points: THREE.Points;
  private readonly positions: Float32Array;
  private depth = 1;
  private radius = 1;

  constructor() {
    this.positions = new Float32Array(DUST.count * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    this.points = new THREE.Points(
      geo,
      // Round and soft-edged, not the square a bare point draws as.
      new THREE.PointsMaterial({ color: 0xffe2c0, size: DUST.size, map: softDot(), transparent: true, opacity: 0.55, depthWrite: false }),
    );
  }

  sync(hole: Hole): void {
    const depth = -floorSpan(hole.floors + 1)[0];
    const radius = openShaftRadius(hole) - 0.3;
    if (depth === this.depth && radius === this.radius) return;
    this.depth = depth;
    this.radius = radius;
    const rand = scatter(hole.floors * 7919);
    for (let i = 0; i < DUST.count; i++) {
      const a = rand() * TAU;
      const r = Math.sqrt(rand()) * radius;
      this.positions.set([r * Math.cos(a), -rand() * depth, r * Math.sin(a)], i * 3);
    }
    this.points.geometry.attributes.position!.needsUpdate = true;
  }

  step(dt: number): void {
    for (let i = 0; i < DUST.count; i++) {
      let y = this.positions[i * 3 + 1]! - DUST.fall * dt;
      if (y < -this.depth) y += this.depth; // back to the top
      this.positions[i * 3 + 1] = y;
    }
    this.points.geometry.attributes.position!.needsUpdate = true;
  }
}
