import * as THREE from "three";
import { softDot } from "./effects3d";
import type { Hole } from "../sim/geometry";
import type { Layout } from "../sim/placement";
import { floorSpan, openShaftRadius, TAU } from "./cylinder";

// Things that bring the 3D shaft to life but don't depend on rooms: the
// Earth lander coming down onto the pad before a supply drop, and dust.

const LANDER = { startHeight: 60, body: 0xd9d4cc, trim: 0x6b6660, flame: 0xffb35c };
const SURFACE_RING_M = 16;

/** The shaft dome: a low glass dome over the shaft at the rim, on ribs, with a ring at its foot. */
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
  g.position.y = 0.05;
  return g;
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

/** Colours of the drill rig: safety-orange body, steel cutterhead, dark grippers. */
const RIG = { body: 0xd9862f, band: 0x3a3330, steel: 0x8a8f94, dark: 0x4a4744, cutter: 0x2e2c2b, lamp: 0xffb35c };

export interface DrillRig {
  group: THREE.Group;
  /**
   * Set where the dig front is (y of the cutter face), how much fresh bore there is above it (metres, up to the
   * deepest floor), and whether it's boring. The hoist cable runs up to the rim; the grippers brace on the bore
   * once there's room, and fold in clear of the gallery ledges above until then.
   */
  place(y: number, bore: number, active: boolean): void;
  /** Turn the cutterhead and blink the lamps, while the game runs. */
  step(dt: number): void;
}

/**
 * The shaft-boring machine at the bottom of the hole: a cutterhead the width
 * of the shaft, a body braced against the bore by four gripper pads, a deck
 * with a cab and a mast on top, and a hoist cable up to the surface. Its
 * origin is the cutter face, so it rides down with the dig front. About 6.5 m
 * tall, so it stays below ground even while floor 2 is dug.
 */
export function makeDrillRig(hole: Hole): DrillRig {
  const R = hole.shaftRadiusM;
  const inner = openShaftRadius(hole);
  const g = new THREE.Group();
  const mat = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.4, ...extra });
  const steel = mat(RIG.steel, { metalness: 0.7, roughness: 0.35 });
  const body = mat(RIG.body, { metalness: 0.2 });
  const dark = mat(RIG.dark);
  const band = mat(RIG.band);

  // The cutterhead: a thick steel disc with disc cutters on its face and spokes across it. It turns.
  const head = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.3, R - 0.5, 1.1, 48), steel);
  disc.position.y = 0.55;
  head.add(disc);
  const cutterGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.18, 12);
  const cutterMat = mat(RIG.cutter, { metalness: 0.8 });
  for (let k = 0; k < 40; k++) {
    const r = 0.8 + (k / 40) * (R - 1.4);
    const a = k * 2.4;
    const c = new THREE.Mesh(cutterGeo, cutterMat);
    c.rotation.z = Math.PI / 2;
    c.rotation.y = -a;
    c.position.set(r * Math.cos(a), 0.05, r * Math.sin(a));
    head.add(c);
  }
  for (let k = 0; k < 6; k++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry((R - 0.6) * 2, 0.35, 0.5), dark);
    spoke.position.y = 1.25;
    spoke.rotation.y = (k / 6) * Math.PI;
    head.add(spoke);
  }
  g.add(head);

  // The body: a drum over the head, painted, with a dark band.
  const bodyR = Math.min(inner - 0.8, R * 0.5);
  const BODY_H = 2.6;
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(bodyR, bodyR * 1.05, BODY_H, 32), body);
  drum.position.y = 1.4 + BODY_H / 2;
  g.add(drum);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(bodyR + 0.03, bodyR + 0.03, 0.5, 32), band);
  stripe.position.y = 1.4 + BODY_H * 0.4;
  g.add(stripe);

  // Grippers: four arms out to pads braced on the bore wall (unit-length beams, stretched in place()).
  const GRIP_Y = 1.7;
  const PAD_H = 1.4;
  const arms: { beam: THREE.Mesh; ram: THREE.Mesh; pad: THREE.Mesh }[] = [];
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + Math.PI / 4;
    const arm = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 0.7), dark);
    const ram = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1, 10), steel);
    ram.rotation.z = Math.PI / 2;
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.4, PAD_H, 2.6), body);
    arm.add(beam, ram, pad);
    arm.position.y = GRIP_Y;
    arm.rotation.y = -a;
    arms.push({ beam, ram, pad });
    g.add(arm);
  }
  const reachTo = (wall: number) => {
    const len = Math.max(0.3, wall - 0.65 - bodyR);
    for (const { beam, ram, pad } of arms) {
      beam.scale.x = len;
      beam.position.x = bodyR + len / 2;
      ram.scale.y = len * 0.8;
      ram.position.set(bodyR + len / 2, 0.45, 0);
      pad.position.x = bodyR + len + 0.2;
    }
  };

  // The deck on top: a platform with a rail, a cab, and the mast the hoist cable hangs from.
  const deckY = 1.4 + BODY_H;
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(bodyR + 0.4, bodyR + 0.4, 0.3, 32), steel);
  deck.position.y = deckY;
  const rail = new THREE.Mesh(new THREE.TorusGeometry(bodyR + 0.35, 0.05, 6, 48), body);
  rail.rotation.x = Math.PI / 2;
  rail.position.y = deckY + 1;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2, 1.4, 1.6), body);
  cab.position.set(bodyR * 0.45, deckY + 0.85, 0);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.8, 1.3), mat(0x9fd2ff, { emissive: 0x3a6f99, emissiveIntensity: 0.6, metalness: 0.2 }));
  glass.position.set(bodyR * 0.45 - 1.02, deckY + 1.05, 0);
  const mastH = 2.4;
  const mast = new THREE.Mesh(new THREE.BoxGeometry(0.5, mastH, 0.5), dark);
  mast.position.set(-bodyR * 0.3, deckY + mastH / 2, 0);
  const boom = new THREE.Mesh(new THREE.BoxGeometry(bodyR * 0.3 + 0.3, 0.35, 0.35), dark);
  boom.position.set(-bodyR * 0.15, deckY + mastH, 0);
  g.add(deck, rail, cab, glass, mast, boom);

  // Lamps on the deck and the mast, blinking while it bores.
  const lampMat = mat(RIG.lamp, { emissive: RIG.lamp, emissiveIntensity: 2, metalness: 0 });
  const lamps: THREE.Mesh[] = [];
  for (const [x, y, z] of [
    [-bodyR * 0.3, deckY + mastH + 0.3, 0],
    [bodyR + 0.3, deckY + 0.4, 0],
    [-bodyR - 0.3, deckY + 0.4, 0],
    [0, deckY + 0.4, bodyR + 0.3],
    [0, deckY + 0.4, -bodyR - 0.3],
  ] as const) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), lampMat);
    lamp.position.set(x, y, z);
    lamps.push(lamp);
    g.add(lamp);
  }

  // The hoist cable, from the top of the mast's boom up the middle of the shaft to the rim. Stretched in place().
  const cableTop = deckY + mastH;
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 6), dark);
  cable.position.x = 0;
  g.add(cable);

  let active = false;
  let t = 0;
  return {
    group: g,
    place(y, bore, on) {
      g.position.y = y;
      // Braced on the fresh bore once the pads fit below the deepest floor; folded in clear of its ledge till then.
      reachTo(bore >= GRIP_Y + PAD_H / 2 ? R : inner - 0.2);
      active = on;
      const len = Math.max(0.1, -y - cableTop);
      cable.scale.y = len;
      cable.position.y = cableTop + len / 2;
      lampMat.emissiveIntensity = on ? 2 : 0.4;
    },
    step(dt) {
      if (!active) return;
      t += dt;
      head.rotation.y += dt * 0.35;
      lampMat.emissiveIntensity = Math.sin(t * 4) > 0 ? 2.4 : 0.6;
    },
  };
}
