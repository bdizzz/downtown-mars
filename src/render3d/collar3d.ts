import * as THREE from "three";
import type { Hole } from "../sim/geometry";
import { cableTop, hazardTexture, rigCables } from "./drillRig";
import { COLLAR_REACH, COLLAR_TOP, TAU } from "./cylinder";
import { finishMaterial } from "./surfaces";

// The collar (T-144): a ring of marscrete lining the top of the shaft, so the
// rock doesn't crumble in, lipping out onto the surface. On it stands the
// headgear: a gantry over the shaft on A-frame legs, with a sheave over each
// of the drill's two cables, and a winch on the lip at either end that the
// cables run down to. The cables come up the shaft from the rig wherever it
// is (drillRig.ts stretches them to the sheaves). Purely for looks: not
// pickable, no cost, no effects. It all fits under the shaft dome.

const COLLAR = {
  /** How far down the lining reaches below the ground (the crust is 3 m), and how thick it is inside the shaft's edge. */
  depth: 2.6,
  thick: 0.3,
  /** The rim (its top is COLLAR_TOP): how far out its wall stands from the shaft's edge, the cap overhanging it, and the bevels on its edges. */
  reach: COLLAR_REACH,
  cap: 0.2,
  capH: 0.22,
  bevel: 0.15,
  /** The sloping apron at the rim's foot, out onto the ground, and how high up the wall it starts. */
  apron: 0.9,
  apronH: 0.35,
  /** Joints down the outside of the wall, about this far apart (metres). */
  jointEvery: 3,
  /** The sheaves' radius, and the gantry's beams: their half-gap across the shaft and how far out along it the legs meet them. */
  sheave: 0.5,
  beamGap: 1,
  legsAt: 0.75,
  /** The towers' feet: out on the rim, and spread either side of the winch. */
  footOut: 1,
  footSpread: 2.4,
  /** The winches: how far out on the rim (from the shaft's edge), and their drum. */
  winchOut: 0.55,
  drum: 0.45,
  /** Railing posts round both edges of the rim's walkway, about this far apart (metres). */
  postEvery: 2.5,
};

const COLOR = {
  steel: 0xd9862f, // the rig's orange, so it reads as the same outfit's kit
  steelDark: 0xa8641f,
  dark: 0x3e3b38,
  bolt: 0x8f8a84,
  cable: 0x2a2827,
  rail: 0xe0b030,
  lamp: 0xffb35c,
  beacon: 0xff4a30,
  cabinet: 0x6b7a5a,
};

/**
 * A box with chamfered edges, centred on the origin: the collar's poured-concrete look, for buildings that
 * stand with it (the entrance's gatehouse, rooms3d.ts). Width along x, height along y, depth along z.
 */
export function bevelBox(w: number, h: number, d: number, bevel = 0.12): THREE.BufferGeometry {
  const b = Math.min(bevel, w / 3, h / 3, d / 3);
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 + b, -h / 2 + b);
  shape.lineTo(w / 2 - b, -h / 2 + b);
  shape.lineTo(w / 2 - b, h / 2 - b);
  shape.lineTo(-w / 2 + b, h / 2 - b);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d - 2 * b, bevelEnabled: true, bevelSize: b, bevelThickness: b, bevelSegments: 1 });
  geo.translate(0, 0, -(d - 2 * b) / 2);
  return geo;
}

/** Build the collar and its headgear for a hole, centred on the shaft at the surface. */
export function makeCollar(hole: Hole): THREE.Group {
  const R = hole.shaftRadiusM;
  const C = COLLAR;
  const inner = R - C.thick;
  const outer = R + C.reach;
  const g = new THREE.Group();
  g.name = "collar";
  const concrete = finishMaterial("marscrete");
  const mat = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.4, ...extra });
  const steel = mat(COLOR.steel, { metalness: 0.25, roughness: 0.55 });
  const steelDark = mat(COLOR.steelDark, { metalness: 0.25 });
  const dark = mat(COLOR.dark);
  const cableMat = mat(COLOR.cable, { metalness: 0.2, roughness: 0.8 });
  const railMat = mat(COLOR.rail, { metalness: 0.2 });
  const lampMat = mat(COLOR.lamp, { emissive: COLOR.lamp, emissiveIntensity: 2, metalness: 0 });
  const beaconMat = mat(COLOR.beacon, { emissive: COLOR.beacon, emissiveIntensity: 1.5, metalness: 0 });

  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, parent: THREE.Object3D = g) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  /** A straight member (a cylinder) between two points. */
  const strut = (a: THREE.Vector3, b: THREE.Vector3, radius: number, m: THREE.Material) => {
    const len = a.distanceTo(b);
    const mesh = add(new THREE.CylinderGeometry(radius, radius, len, 6), m);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    return mesh;
  };
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  // ---- the concrete: a rim standing round the shaft, its profile turned round the axis ----
  // Each face of the profile is a band of its own, so the edges between them stay crisp (one lathe would round them off).
  const top = COLLAR_TOP;
  const capOut = outer + C.cap;
  const capBottom = top - C.capH;
  const profile: [number, number][] = [
    [inner, -C.depth], // the lining, down the shaft's top
    [inner, top - C.bevel],
    [inner + C.bevel, top], // bevelled onto the walkway
    [capOut - C.bevel, top],
    [capOut, top - C.bevel], // bevelled over the cap's edge
    [capOut, capBottom],
    [outer, capBottom], // the cap's underside, back to the wall
    [outer, C.apronH],
    [outer + C.apron, 0], // the apron, sloping out onto the ground
    [outer + C.apron, -0.3],
  ];
  for (let i = 0; i + 1 < profile.length; i++) {
    const [r0, y0] = profile[i]!;
    const [r1, y1] = profile[i + 1]!;
    add(new THREE.LatheGeometry([new THREE.Vector2(r0, y0), new THREE.Vector2(r1, y1)], 96), concrete);
  }
  // Hazard stripes painted round the walkway's inner edge, just under the bevel.
  const hazard = hazardTexture();
  if (hazard) {
    hazard.repeat.set(Math.round((TAU * inner) / 1.2), 1);
    add(new THREE.CylinderGeometry(inner - 0.01, inner - 0.01, 0.28, 96, 1, true), new THREE.MeshStandardMaterial({ map: hazard, roughness: 0.7, side: THREE.DoubleSide }), 0, top - C.bevel - 0.16, 0);
  }
  // Joints down the outside of the wall, where its pours meet.
  const nJoints = Math.round((TAU * outer) / C.jointEvery);
  const joint = new THREE.BoxGeometry(0.06, capBottom - C.apronH, 0.1);
  for (let k = 0; k < nJoints; k++) {
    const a = (k / nJoints) * TAU;
    add(joint, dark, (outer + 0.01) * Math.cos(a), (capBottom + C.apronH) / 2, (outer + 0.01) * Math.sin(a)).rotation.y = -a;
  }
  // Anchor bolts along the walkway.
  const boltGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.1, 6);
  const boltMat = mat(COLOR.bolt, { metalness: 0.6, roughness: 0.4 });
  const boltR = (inner + capOut) / 2;
  const nBolts = Math.round((TAU * boltR) / 1.5);
  for (let k = 0; k < nBolts; k++) {
    const a = (k / nBolts) * TAU;
    add(boltGeo, boltMat, boltR * Math.cos(a), top + 0.06, boltR * Math.sin(a));
  }

  // ---- the headgear: two beams across the shaft, on an A-frame at each end, sheaves over the cables ----
  const sheaveY = cableTop(hole);
  const beamY = sheaveY - C.sheave - 0.25;
  const reach = R * C.legsAt;
  for (const x of [-C.beamGap, C.beamGap]) add(new THREE.BoxGeometry(0.22, 0.32, reach * 2 + 0.4), steel, x, beamY, 0);
  // Cross ties between the beams.
  for (let k = -2; k <= 2; k++) add(new THREE.BoxGeometry(C.beamGap * 2, 0.14, 0.14), steelDark, 0, beamY, (k / 2) * reach);
  const footY = top;
  const footR = R + C.footOut;
  for (const s of [-1, 1]) {
    // The end of the gantry, and its legs out to the rim, latticed like a tower.
    add(new THREE.BoxGeometry(C.beamGap * 2 + 0.3, 0.3, 0.3), steel, 0, beamY, s * reach);
    const feet: THREE.Vector3[] = [];
    for (const side of [-1, 1]) {
      const head = v(side * C.beamGap, beamY, s * reach);
      const foot = v(side * C.footSpread, footY, s * footR);
      strut(head, foot, 0.12, steel);
      // A raking back-stay down to the shaft's edge, so it stands as a frame.
      strut(v(side * C.beamGap, beamY, s * (reach - 1.2)), v(side * C.footSpread, footY, s * (inner + 0.2)), 0.08, steelDark);
      add(new THREE.BoxGeometry(0.6, 0.12, 0.6), dark, foot.x, footY + 0.06, foot.z);
      feet.push(head, foot);
    }
    // Lattice between the two legs: ties across at intervals, with a diagonal in each bay.
    const at = (side: number, t: number) => feet[side * 2 + 1]!.clone().lerp(feet[side * 2]!, t);
    const bays = [0.12, 0.4, 0.68, 0.94];
    for (let k = 0; k < bays.length; k++) {
      strut(at(0, bays[k]!), at(1, bays[k]!), 0.05, steelDark);
      if (k + 1 < bays.length) strut(at(k % 2, bays[k]!), at(1 - (k % 2), bays[k + 1]!), 0.04, steelDark);
    }
  }
  // A beacon atop the middle of the gantry, and floodlights looking down the shaft.
  add(new THREE.CylinderGeometry(0.12, 0.14, 0.15, 10), dark, 0, beamY + 0.24, 0);
  const beacon = add(new THREE.SphereGeometry(0.13, 10, 6), beaconMat, 0, beamY + 0.4, 0);
  beacon.name = "collar:beacon";
  for (const s of [-1, 1]) {
    const f = new THREE.Group();
    add(new THREE.BoxGeometry(0.4, 0.25, 0.3), dark, 0, 0, 0, f);
    add(new THREE.BoxGeometry(0.34, 0.02, 0.24), lampMat, 0, -0.13, 0, f);
    f.position.set(s * (C.beamGap + 0.25), beamY - 0.25, s * reach * 0.4);
    f.rotation.x = s * 0.3;
    g.add(f);
  }

  // ---- each cable: a sheave over it on the gantry, then down to its winch on the rim ----
  const cables = rigCables(hole);
  for (const [cx, cz] of [cables.hoist, cables.power]) {
    const s = Math.sign(cz) || 1;
    // The cable rises against the sheave's inner side, so its centre is a radius further out.
    const sz = cz + s * C.sheave;
    const wheel = add(new THREE.TorusGeometry(C.sheave - 0.06, 0.07, 6, 24), steelDark, cx, sheaveY, sz);
    wheel.rotation.y = Math.PI / 2;
    for (let k = 0; k < 4; k++) {
      const spoke = add(new THREE.BoxGeometry(0.04, (C.sheave - 0.06) * 2, 0.04), steelDark, cx, sheaveY, sz);
      spoke.rotation.x = (k / 4) * Math.PI;
    }
    // Its axle across the beams, on a pillow block on each.
    const axle = add(new THREE.CylinderGeometry(0.06, 0.06, C.beamGap * 2, 8), dark, 0, sheaveY, sz);
    axle.rotation.z = Math.PI / 2;
    for (const x of [-C.beamGap, C.beamGap]) add(new THREE.BoxGeometry(0.26, sheaveY - beamY, 0.3), dark, x, (sheaveY + beamY) / 2, sz);
    // The winch: a drum on a skid, its motor, a control cabinet with a lamp.
    const wz = s * (R + C.winchOut);
    const drumY = top + 0.2 + C.drum + 0.1;
    add(new THREE.BoxGeometry(2.4, 0.2, 1.3), dark, cx + 0.3, top + 0.1, wz);
    const drum = add(new THREE.CylinderGeometry(C.drum, C.drum, 1.1, 18), mat(COLOR.cable, { metalness: 0.1, roughness: 0.9 }), cx, drumY, wz);
    drum.rotation.z = Math.PI / 2;
    for (const dx of [-0.6, 0.6]) {
      const flange = add(new THREE.CylinderGeometry(C.drum + 0.18, C.drum + 0.18, 0.06, 20), steel, cx + dx, drumY, wz);
      flange.rotation.z = Math.PI / 2;
      add(new THREE.BoxGeometry(0.1, drumY - top - 0.2, 0.4), steelDark, cx + dx + Math.sign(dx) * 0.1, (drumY + top + 0.2) / 2, wz);
    }
    const motor = add(new THREE.CylinderGeometry(0.3, 0.3, 0.6, 14), steel, cx + 1.05, drumY, wz);
    motor.rotation.z = Math.PI / 2;
    add(new THREE.BoxGeometry(0.4, 0.9, 0.3), mat(COLOR.cabinet, { metalness: 0.3 }), cx - 1.1, top + 0.65, wz + s * 0.35);
    add(new THREE.BoxGeometry(0.12, 0.08, 0.08), lampMat, cx - 1.1, top + 1.14, wz + s * 0.35);
    // The cable from the top of the sheave down onto the top of the drum.
    strut(v(cx, sheaveY + C.sheave - 0.06, sz), v(cx, drumY + C.drum, wz), 0.05, cableMat);
  }

  // ---- railings round both edges of the walkway (the outer one clear of the dome's foot), open where the winches and towers stand ----
  const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 1, 6);
  const gaps = [cables.hoist, cables.power].map(([, z]) => (Math.sign(z) || 1) * (Math.PI / 2));
  for (const railR of [inner + C.bevel + 0.1, capOut - 0.08]) {
    const gapHalf = (C.footSpread + 0.4) / railR;
    const open = (a: number) => gaps.some((ga) => Math.abs(((a - ga + TAU * 1.5) % TAU) - Math.PI) < gapHalf);
    const nPosts = Math.round((TAU * railR) / C.postEvery);
    for (let k = 0; k < nPosts; k++) {
      const a0 = (k / nPosts) * TAU;
      const a1 = ((k + 1) / nPosts) * TAU;
      if (open(a0)) continue;
      add(postGeo, railMat, railR * Math.cos(a0), top + 0.5, railR * Math.sin(a0));
      if (open(a1)) continue;
      for (const y of [0.55, 1]) strut(v(railR * Math.cos(a0), top + y, railR * Math.sin(a0)), v(railR * Math.cos(a1), top + y, railR * Math.sin(a1)), 0.03, railMat);
    }
  }

  return g;
}
