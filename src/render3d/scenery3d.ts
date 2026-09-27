import * as THREE from "three";
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
