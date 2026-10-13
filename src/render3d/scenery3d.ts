import * as THREE from "three";
import { softDot } from "./effects3d";
import type { Hole } from "../sim/geometry";
import type { Layout } from "../sim/placement";
import { COLLAR_TOP, floorSpan, openShaftRadius, TAU } from "./cylinder";

// Things that bring the 3D shaft to life but don't depend on rooms: the
// Earth lander coming down onto the pad before a supply drop, and dust.

const LANDER = { startHeight: 60, body: 0xd9d4cc, trim: 0x6b6660, flame: 0xffb35c };
const SURFACE_RING_M = 16;

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

/** The lander: a capsule with legs and a flame, positioned by the caller. */
export function makeLander(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: LANDER.body, roughness: 0.5, metalness: 0.3 });
  const trim = new THREE.MeshStandardMaterial({ color: LANDER.trim, roughness: 0.7 });
  const capsule = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.6, 4, 16), body);
  capsule.position.y = 3;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.8, 2, 16), body);
  nose.position.y = 6;
  g.add(capsule, nose);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + Math.PI / 4;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.6), trim);
    leg.position.set(Math.cos(a) * 2.6, 0.9, Math.sin(a) * 2.6);
    leg.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    g.add(leg);
  }
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(1.4, 4, 12),
    new THREE.MeshStandardMaterial({ color: LANDER.flame, emissive: LANDER.flame, emissiveIntensity: 2, transparent: true, opacity: 0.85 }),
  );
  flame.rotation.x = Math.PI;
  flame.position.y = -1;
  flame.name = "flame";
  g.add(flame);
  g.visible = false;
  return g;
}

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
