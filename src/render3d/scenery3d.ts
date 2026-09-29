import * as THREE from "three";
import { softDot } from "./effects3d";
import type { Hole } from "../sim/geometry";
import type { Layout } from "../sim/placement";
import { floorSpan, openShaftRadius, TAU } from "./cylinder";

// Things that bring the 3D shaft to life but don't depend on rooms: lamps
// along each gallery railing that light up at night, and the Earth lander
// coming down onto the pad before a supply drop.

const LAMPS_PER_FLOOR = 16;
const LAMP = { height: 1.3, radius: 0.09, color: 0xffb870 };
const LANDER = { startHeight: 60, body: 0xd9d4cc, trim: 0x6b6660, flame: 0xffb35c };
const SURFACE_RING_M = 16;

/** Small lamps on every gallery railing, one instanced mesh for the whole hole. */
export function galleryLamps(hole: Hole): THREE.InstancedMesh {
  const count = hole.floors * LAMPS_PER_FLOOR;
  const mesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(LAMP.radius, 8, 6),
    new THREE.MeshStandardMaterial({ color: LAMP.color, emissive: LAMP.color, emissiveIntensity: 0 }),
    Math.max(1, count),
  );
  const m = new THREE.Matrix4();
  const r = openShaftRadius(hole) + 0.1;
  let i = 0;
  for (let floor = 1; floor <= hole.floors; floor++) {
    const y = floorSpan(floor)[0] + LAMP.height + 0.4;
    for (let k = 0; k < LAMPS_PER_FLOOR; k++) {
      const a = ((k + 0.5) / LAMPS_PER_FLOOR) * TAU;
      m.makeTranslation(r * Math.cos(a), y, r * Math.sin(a));
      mesh.setMatrixAt(i++, m);
    }
  }
  mesh.count = count;
  return mesh;
}

export function setLampGlow(lamps: THREE.InstancedMesh, night: number): void {
  (lamps.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.2 + night * 1.2;
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

// ---- walkers and dust: purely cosmetic, never part of the simulation ----

const WALKER = { max: 60, perColonists: 3, height: 1.6, radius: 0.22, speed: 0.35, colors: [0xd8c0ae, 0x6f93bd, 0x86ad58, 0xc9a456, 0xd48092] };
const DUST = { count: 260, fall: 0.25, size: 0.12 };

interface Walker {
  floor: number;
  angle: number;
  /** Radians per second, signed: which way round they're walking. */
  speed: number;
  /** A little in or out on the ledge, so they don't walk single file. */
  offset: number;
}

/** A deterministic scatter for cosmetics, so the same colony looks the same each load. */
function scatter(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class Walkers {
  readonly mesh: THREE.InstancedMesh;
  private walkers: Walker[] = [];
  private hole: Hole | null = null;
  private readonly m = new THREE.Matrix4();

  constructor() {
    const body = new THREE.CapsuleGeometry(WALKER.radius, WALKER.height - 2 * WALKER.radius, 3, 6);
    body.translate(0, WALKER.height / 2, 0);
    this.mesh = new THREE.InstancedMesh(body, new THREE.MeshStandardMaterial({ roughness: 0.8 }), WALKER.max);
    this.mesh.count = 0;
    const c = new THREE.Color();
    for (let i = 0; i < WALKER.max; i++) this.mesh.setColorAt(i, c.setHex(WALKER.colors[i % WALKER.colors.length]!));
  }

  /** Match the crowd to the colony: more people, more walkers, spread over the dug floors. */
  sync(hole: Hole, population: number): void {
    const want = Math.min(WALKER.max, Math.ceil(population / WALKER.perColonists));
    if (this.hole === hole && this.walkers.length === want) return;
    this.hole = hole;
    const rand = scatter(population * 131 + hole.floors);
    this.walkers = Array.from({ length: want }, () => ({
      floor: 1 + Math.floor(rand() * hole.floors),
      angle: rand() * TAU,
      speed: (rand() < 0.5 ? -1 : 1) * WALKER.speed * (0.6 + rand() * 0.8),
      offset: rand() * 1.2,
    }));
    this.mesh.count = want;
    this.place();
  }

  /** Advance by dt real seconds and update the instances. */
  step(dt: number): void {
    for (const w of this.walkers) w.angle += (w.speed * dt) / Math.max(1, this.radiusFor(w));
    this.place();
  }

  private radiusFor(w: Walker): number {
    return this.hole ? openShaftRadius(this.hole) + 0.5 + w.offset : 1;
  }

  private place(): void {
    if (!this.hole) return;
    this.walkers.forEach((w, i) => {
      const r = this.radiusFor(w);
      const y = floorSpan(w.floor)[0] + 0.4;
      this.m.makeTranslation(r * Math.cos(w.angle), y, r * Math.sin(w.angle));
      this.mesh.setMatrixAt(i, this.m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
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
