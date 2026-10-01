import * as THREE from "three";
import type { Hole } from "../sim/geometry";
import { openShaftRadius, TAU } from "./cylinder";

// The shaft-boring machine at the bottom of the hole. Its origin is the
// cutter face, at the dig front, so it rides down as the drill works.
//
//   cutterhead   a steel wheel the width of the shaft: disc cutters on its
//                face, gauge cutters and muck buckets round its rim, spokes
//                and a bolted hub on top, a pilot bit below. It turns.
//   drive        the main bearing, ringed with drive motors.
//   body         a painted drum in bolted panels, with a hazard band, vents,
//                a hatch, a ladder and hoses; four gripper arms on rams brace
//                pads on the bore.
//   muck         a conveyor carries spoil up the side, lumps riding it, into
//                a skip on the deck; the skip hangs from the hoist cable,
//                which runs from the mast's boom up to the rim.
//   deck         railed, with the cab (windows, a beacon, an aerial), a power
//                pack (radiator, exhausts), tanks on saddles, a cable reel
//                paying out the power line, gas bottles, crates and floodlights.
//
// About 6.5 m tall (to the mast), so it stays below ground while floor 2 is dug.

const RIG = {
  body: 0xd9862f,
  bodyDark: 0xa8641f,
  band: 0x3a3330,
  steel: 0xa4a9ad,
  dark: 0x4a4744,
  cutter: 0x2e2c2b,
  rubber: 0x1e1c1b,
  lamp: 0xffb35c,
  beacon: 0xffa020,
  glass: 0x9fd2ff,
  rock: 0x7a4a36,
  hoseRed: 0x9a3328,
  hoseYellow: 0xd8b03a,
  tank: 0xc9c4ba,
  bottle: 0x3f6f4a,
  crate: 0x7c6247,
};

export interface DrillRig {
  group: THREE.Group;
  /**
   * Set where the dig front is (y of the cutter face), how much fresh bore there is above it (metres, up to the
   * deepest floor), and whether it's boring. The hoist cable runs up to the rim; the grippers brace on the bore
   * once there's room, and fold in clear of the gallery ledges above until then.
   */
  place(y: number, bore: number, active: boolean): void;
  /** Turn the cutterhead and the beacon, run the conveyor and blink the lamps, while the game runs. */
  step(dt: number): void;
  /** Free its geometry, materials and textures. */
  dispose(): void;
}

/** Diagonal black-and-yellow hazard stripes, as a repeating texture (none outside a browser). */
function hazardTexture(): THREE.Texture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 16;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#e0b030";
  ctx.fillRect(0, 0, 64, 16);
  ctx.fillStyle = "#24201e";
  for (let x = -16; x < 64; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, 16);
    ctx.lineTo(x + 8, 16);
    ctx.lineTo(x + 16, 0);
    ctx.lineTo(x + 8, 0);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A floor grating: a dark plate with a lighter mesh, repeating. */
function gratingTexture(): THREE.Texture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#3d3a38";
  ctx.fillRect(0, 0, 32, 32);
  ctx.strokeStyle = "#77736e";
  ctx.lineWidth = 2;
  for (let k = 0; k <= 32; k += 8) {
    ctx.beginPath();
    ctx.moveTo(k, 0);
    ctx.lineTo(k, 32);
    ctx.moveTo(0, k);
    ctx.lineTo(32, k);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeDrillRig(hole: Hole): DrillRig {
  const R = hole.shaftRadiusM;
  const inner = openShaftRadius(hole);
  const g = new THREE.Group();
  const textures: THREE.Texture[] = [];
  // Double-sided: the cutaway slices it in half, and the far half's insides should still show.
  const mat = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.4, side: THREE.DoubleSide, ...extra });
  const steel = mat(RIG.steel, { metalness: 0.5, roughness: 0.45 });
  const body = mat(RIG.body, { metalness: 0.2, roughness: 0.55 });
  const bodyDark = mat(RIG.bodyDark, { metalness: 0.2 });
  const dark = mat(RIG.dark);
  const band = mat(RIG.band);
  const rubber = mat(RIG.rubber, { metalness: 0, roughness: 0.9 });
  const cutterMat = mat(RIG.cutter, { metalness: 0.85, roughness: 0.3 });
  const rockMat = mat(RIG.rock, { metalness: 0, roughness: 1, flatShading: true });
  const glassMat = mat(RIG.glass, { emissive: 0x3a6f99, emissiveIntensity: 0.7, metalness: 0.2, roughness: 0.1 });
  const lampMat = mat(RIG.lamp, { emissive: RIG.lamp, emissiveIntensity: 2, metalness: 0 });
  const beaconMat = mat(RIG.beacon, { emissive: RIG.beacon, emissiveIntensity: 1.5, metalness: 0, transparent: true, opacity: 0.9 });
  const hazardTex = hazardTexture();
  const gratingTex = gratingTexture();
  if (hazardTex) textures.push(hazardTex);
  if (gratingTex) textures.push(gratingTex);

  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  /** A bent pipe or hose through points, as a tube. */
  const tube = (parent: THREE.Object3D, pts: [number, number, number][], radius: number, m: THREE.Material) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    return add(parent, new THREE.TubeGeometry(curve, 24, radius, 6, false), m);
  };
  /** A ring of bolt heads (short cylinders) at radius r, height y. */
  const bolts = (parent: THREE.Object3D, r: number, y: number, n: number, size = 0.07) => {
    const geo = new THREE.CylinderGeometry(size, size, 0.08, 6);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU;
      add(parent, geo, steel, r * Math.cos(a), y, r * Math.sin(a));
    }
  };

  // ---- the cutterhead (turns) ----
  const head = new THREE.Group();
  const headR = R - 0.3;
  add(head, new THREE.CylinderGeometry(headR, headR - 0.25, 1.1, 64), steel, 0, 0.55, 0);
  // A dark recessed face ring and the hub on top.
  add(head, new THREE.CylinderGeometry(headR - 0.4, headR - 0.4, 0.06, 64), dark, 0, 1.12, 0);
  add(head, new THREE.CylinderGeometry(1.1, 1.3, 0.5, 24), steel, 0, 1.35, 0);
  add(head, new THREE.CylinderGeometry(0.6, 0.6, 0.2, 16), dark, 0, 1.65, 0);
  bolts(head, 0.95, 1.62, 16);
  // The pilot bit: a cone below the middle of the face.
  const pilot = add(head, new THREE.ConeGeometry(0.6, 0.7, 12), cutterMat, 0, -0.25, 0);
  pilot.rotation.x = Math.PI;
  // Face cutters, spiralling out across the underside.
  const faceCutter = new THREE.CylinderGeometry(0.28, 0.28, 0.18, 12);
  for (let k = 0; k < 48; k++) {
    const r = 0.9 + (k / 48) * (headR - 1.4);
    const a = k * 2.4;
    const c = add(head, faceCutter, cutterMat, r * Math.cos(a), 0.05, r * Math.sin(a));
    c.rotation.set(0, -a, Math.PI / 2);
  }
  // Gauge cutters round the rim, tilted out to cut the bore's edge.
  const gauge = new THREE.CylinderGeometry(0.22, 0.22, 0.16, 10);
  for (let k = 0; k < 36; k++) {
    const a = (k / 36) * TAU;
    const c = add(head, gauge, cutterMat, (headR - 0.05) * Math.cos(a), 0.25, (headR - 0.05) * Math.sin(a));
    c.rotation.set(0, -a, Math.PI / 3);
  }
  // Spokes: deep box girders with a stiffening flange, and a hose run along each.
  for (let k = 0; k < 6; k++) {
    const spoke = new THREE.Group();
    add(spoke, new THREE.BoxGeometry(headR - 1.2, 0.4, 0.55), dark, (headR + 1.2) / 2, 1.3, 0);
    add(spoke, new THREE.BoxGeometry(headR - 1.3, 0.06, 0.8), steel, (headR + 1.2) / 2, 1.53, 0);
    const line = add(spoke, new THREE.CylinderGeometry(0.06, 0.06, headR - 1.4, 6), rubber, (headR + 1.2) / 2, 1.62, 0.25);
    line.rotation.z = Math.PI / 2;
    spoke.rotation.y = (k / 6) * TAU;
    head.add(spoke);
  }
  // Muck buckets: scoops in the rim between the spokes, each with a row of teeth.
  const tooth = new THREE.ConeGeometry(0.08, 0.25, 5);
  for (let k = 0; k < 6; k++) {
    const a = ((k + 0.5) / 6) * TAU;
    const bucket = new THREE.Group();
    add(bucket, new THREE.BoxGeometry(0.7, 0.9, 1.4), band, headR - 0.45, 0.6, 0);
    add(bucket, new THREE.BoxGeometry(0.1, 0.95, 1.5), steel, headR - 0.08, 0.6, 0);
    for (let t = -2; t <= 2; t++) {
      const th = add(bucket, tooth, cutterMat, headR - 0.1, 0.05, t * 0.28);
      th.rotation.z = Math.PI;
    }
    bucket.rotation.y = -a;
    head.add(bucket);
  }
  g.add(head);

  // ---- the drive: main bearing and its motors ----
  const bodyR = Math.min(inner - 0.8, R * 0.5);
  add(g, new THREE.CylinderGeometry(bodyR * 1.15, bodyR * 1.2, 0.35, 48), steel, 0, 1.6, 0);
  bolts(g, bodyR * 1.12, 1.8, 32, 0.06);
  const motor = new THREE.CylinderGeometry(0.28, 0.28, 0.75, 14);
  const motorCap = new THREE.CylinderGeometry(0.31, 0.31, 0.12, 14);
  for (let k = 0; k < 8; k++) {
    const a = ((k + 0.5) / 8) * TAU;
    const [x, z] = [(bodyR + 0.25) * Math.cos(a), (bodyR + 0.25) * Math.sin(a)];
    add(g, motor, dark, x, 2.15, z);
    add(g, motorCap, steel, x, 2.55, z);
    // A cooling fin ring and the power lead into each motor.
    add(g, new THREE.TorusGeometry(0.3, 0.03, 4, 14), steel, x, 2.1, z).rotation.x = Math.PI / 2;
    tube(g, [[x, 2.55, z], [x * 0.96, 2.85, z * 0.96], [x * 0.9, 3.0, z * 0.9]], 0.04, rubber);
  }

  // ---- the body ----
  const BODY_Y = 1.4;
  const BODY_H = 2.6;
  const deckY = BODY_Y + BODY_H;
  add(g, new THREE.CylinderGeometry(bodyR, bodyR * 1.05, BODY_H, 48), body, 0, BODY_Y + BODY_H / 2, 0);
  // Panel seams: rings and ribs, bolted.
  for (const y of [BODY_Y + 0.9, BODY_Y + 1.8]) add(g, new THREE.TorusGeometry(bodyR + 0.02, 0.035, 4, 48), bodyDark, 0, y, 0).rotation.x = Math.PI / 2;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU;
    const rib = add(g, new THREE.BoxGeometry(0.08, BODY_H - 0.1, 0.12), bodyDark, (bodyR + 0.03) * Math.cos(a), BODY_Y + BODY_H / 2, (bodyR + 0.03) * Math.sin(a));
    rib.rotation.y = -a;
  }
  // The hazard band round its foot.
  const stripe = add(
    g,
    new THREE.CylinderGeometry(bodyR * 1.05 + 0.04, bodyR * 1.05 + 0.04, 0.35, 48, 1, true),
    hazardTex ? new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.6, side: THREE.DoubleSide }) : band,
    0,
    BODY_Y + 0.35,
    0,
  );
  if (hazardTex) hazardTex.repeat.set(Math.round((TAU * bodyR) / 1.2), 1);
  void stripe;
  // Vents (slatted grilles), a hatch with its wheel, and a stencilled number plate, round the drum.
  const onDrum = (a: number, y: number, w: number, h: number, m: THREE.Material, out = 0.05) => {
    const mesh = add(g, new THREE.BoxGeometry(0.06, h, w), m, (bodyR + out) * Math.cos(a), y, (bodyR + out) * Math.sin(a));
    mesh.rotation.y = -a;
    return mesh;
  };
  for (const a of [0.4, 2.0, 3.6, 5.2]) {
    onDrum(a, BODY_Y + 1.5, 0.9, 0.6, dark);
    for (let s = 0; s < 5; s++) onDrum(a, BODY_Y + 1.27 + s * 0.11, 0.86, 0.03, steel, 0.09);
  }
  const hatchA = 1.2;
  onDrum(hatchA, BODY_Y + 1.25, 1, 1.5, bodyDark, 0.06);
  const wheel = add(g, new THREE.TorusGeometry(0.22, 0.04, 6, 16), steel, (bodyR + 0.14) * Math.cos(hatchA), BODY_Y + 1.3, (bodyR + 0.14) * Math.sin(hatchA));
  wheel.rotation.y = -hatchA + Math.PI / 2;
  onDrum(4.4, BODY_Y + 2.1, 0.8, 0.35, mat(0xe8e2d6, { metalness: 0.1 }), 0.06);
  // A ladder up the drum to the deck.
  const ladderA = 2.75;
  const lx = Math.cos(ladderA);
  const lz = Math.sin(ladderA);
  const side = [-Math.sin(ladderA), Math.cos(ladderA)];
  for (const s of [-0.25, 0.25]) {
    add(g, new THREE.CylinderGeometry(0.03, 0.03, BODY_H + 1, 6), steel, (bodyR + 0.25) * lx + side[0]! * s, BODY_Y + (BODY_H + 1) / 2, (bodyR + 0.25) * lz + side[1]! * s);
  }
  const across = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(side[0], 0, side[1]));
  const rungGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 5);
  for (let k = 0; k < 10; k++) add(g, rungGeo, steel, (bodyR + 0.25) * lx, BODY_Y + 0.3 + k * 0.33, (bodyR + 0.25) * lz).quaternion.copy(across);
  // Hose bundles down the drum, from the deck to the motors.
  for (const [a, m] of [[0.9, mat(RIG.hoseRed, { metalness: 0 })], [0.97, mat(RIG.hoseYellow, { metalness: 0 })], [1.04, rubber], [3.3, rubber], [3.37, mat(RIG.hoseYellow, { metalness: 0 })]] as const) {
    const [c, s] = [Math.cos(a), Math.sin(a)];
    tube(g, [[(bodyR + 0.1) * c, deckY + 0.1, (bodyR + 0.1) * s], [(bodyR + 0.22) * c, deckY - 0.8, (bodyR + 0.22) * s], [(bodyR + 0.15) * c, BODY_Y + 1, (bodyR + 0.15) * s], [(bodyR + 0.35) * c, BODY_Y + 0.6, (bodyR + 0.35) * s]], 0.045, m);
  }

  // ---- grippers: arms on rams, out to ribbed pads on the bore ----
  const GRIP_Y = 1.7 + 0.6;
  const PAD_H = 1.4;
  const arms: { beam: THREE.Mesh; ram: THREE.Mesh; rod: THREE.Mesh; pad: THREE.Group; hose: THREE.Mesh }[] = [];
  const hoseMat = mat(RIG.hoseRed, { metalness: 0 });
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + Math.PI / 4;
    const arm = new THREE.Group();
    const beam = add(arm, new THREE.BoxGeometry(1, 0.45, 0.6), dark);
    const ram = add(arm, new THREE.CylinderGeometry(0.17, 0.17, 1, 12), steel);
    ram.rotation.z = Math.PI / 2;
    const rod = add(arm, new THREE.CylinderGeometry(0.09, 0.09, 1, 8), mat(0xd8dde0, { metalness: 0.9, roughness: 0.15 }));
    rod.rotation.z = Math.PI / 2;
    const pad = new THREE.Group();
    add(pad, new THREE.BoxGeometry(0.35, PAD_H, 2.6), body);
    for (let r = -1; r <= 1; r++) add(pad, new THREE.BoxGeometry(0.1, PAD_H - 0.1, 0.12), rubber, 0.2, 0, r * 0.8);
    add(pad, new THREE.BoxGeometry(0.3, 0.3, 0.5), dark, -0.3, 0, 0);
    arm.add(pad);
    const hose = add(arm, new THREE.CylinderGeometry(0.04, 0.04, 1, 6), hoseMat);
    hose.rotation.z = Math.PI / 2;
    arm.position.y = GRIP_Y;
    arm.rotation.y = -a;
    arms.push({ beam, ram, rod, pad, hose });
    g.add(arm);
  }
  const reachTo = (wall: number) => {
    const len = Math.max(0.3, wall - 0.55 - bodyR);
    for (const { beam, ram, rod, pad, hose } of arms) {
      beam.scale.x = len;
      beam.position.x = bodyR + len / 2;
      ram.scale.y = len * 0.55;
      ram.position.set(bodyR + len * 0.3, 0.42, 0);
      rod.scale.y = len * 0.45;
      rod.position.set(bodyR + len * 0.75, 0.42, 0);
      hose.scale.y = len * 0.5;
      hose.position.set(bodyR + len * 0.28, 0.65, 0.12);
      pad.position.x = bodyR + len + 0.15;
    }
  };

  // ---- the muck conveyor: up the side from the head to the skip on the deck ----
  // Up the side under the skip, so the spoil tips in.
  const skipX = -bodyR * 0.15;
  const skipZ = -bodyR * 0.7;
  const convA = Math.atan2(skipZ, skipX);
  const [cc, cs] = [Math.cos(convA), Math.sin(convA)];
  const conveyor = new THREE.Group();
  const convLen = 3.4;
  const convTilt = Math.atan2(deckY + 0.6 - 1.3, 0.6);
  // Built along +x then stood up the drum, facing out.
  const frame = new THREE.Group();
  add(frame, new THREE.BoxGeometry(convLen, 0.08, 0.7), rubber, convLen / 2, 0.12, 0);
  for (const s of [-0.38, 0.38]) add(frame, new THREE.BoxGeometry(convLen, 0.22, 0.06), dark, convLen / 2, 0.15, s);
  for (let k = 0; k < 8; k++) {
    const roller = add(frame, new THREE.CylinderGeometry(0.06, 0.06, 0.72, 8), steel, 0.2 + k * (convLen / 8), 0.04, 0);
    roller.rotation.x = Math.PI / 2;
  }
  frame.rotation.z = convTilt;
  conveyor.add(frame);
  conveyor.position.set((bodyR + 0.55) * cc, 1.3, (bodyR + 0.55) * cs);
  // Its +x (up the belt) leans in toward the shaft's axis, so the top end tips over the deck.
  conveyor.rotation.y = Math.PI - convA;
  g.add(conveyor);
  // Rock lumps riding the belt (moved in step()).
  const lumps: THREE.Mesh[] = [];
  const lumpGeo = new THREE.DodecahedronGeometry(0.16, 0);
  for (let k = 0; k < 7; k++) {
    const lump = add(frame, lumpGeo, rockMat, (k / 7) * convLen, 0.28, (k % 3 - 1) * 0.15);
    lump.rotation.set(k, k * 2, k * 3);
    lumps.push(lump);
  }

  // ---- the deck ----
  const deckR = bodyR + 0.45;
  const deckTop = mat(0x5a5652, { map: gratingTex, metalness: 0.5, roughness: 0.7 });
  if (gratingTex) gratingTex.repeat.set(deckR * 2, deckR * 2);
  add(g, new THREE.CylinderGeometry(deckR, deckR, 0.3, 48), [steel, deckTop, steel] as unknown as THREE.Material, 0, deckY, 0);
  add(g, new THREE.TorusGeometry(deckR - 0.02, 0.06, 4, 48), bodyDark, 0, deckY + 0.15, 0).rotation.x = Math.PI / 2;
  // Railing: posts, a top rail and a knee rail, with a gap for the ladder.
  const post = new THREE.CylinderGeometry(0.035, 0.035, 1.05, 6);
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * TAU;
    if (Math.abs(((a - ladderA + TAU + Math.PI) % TAU) - Math.PI) < 0.12) continue;
    add(g, post, body, (deckR - 0.08) * Math.cos(a), deckY + 0.67, (deckR - 0.08) * Math.sin(a));
  }
  for (const y of [0.6, 1.17]) add(g, new THREE.TorusGeometry(deckR - 0.08, 0.035, 5, 64), body, 0, deckY + y, 0).rotation.x = Math.PI / 2;
  const deck = new THREE.Group();
  deck.position.y = deckY + 0.15;
  g.add(deck);

  // The cab: walls, a roof with an overhang, windows on three sides, a door, an air unit, a beacon and an aerial.
  const cab = new THREE.Group();
  add(cab, new THREE.BoxGeometry(2.1, 1.45, 1.7), body, 0, 0.73, 0);
  add(cab, new THREE.BoxGeometry(2.35, 0.1, 1.95), bodyDark, 0, 1.5, 0);
  add(cab, new THREE.BoxGeometry(0.04, 0.6, 1.4), glassMat, -1.06, 0.95, 0);
  for (const z of [-0.86, 0.86]) add(cab, new THREE.BoxGeometry(1.5, 0.55, 0.04), glassMat, -0.1, 0.95, z);
  add(cab, new THREE.BoxGeometry(0.04, 1.2, 0.7), bodyDark, 1.06, 0.62, 0.3);
  add(cab, new THREE.BoxGeometry(0.7, 0.35, 0.6), mat(0xbdb8ae, { metalness: 0.3 }), 0.5, 1.72, 0);
  for (let s = 0; s < 4; s++) add(cab, new THREE.BoxGeometry(0.02, 0.25, 0.5), dark, 0.16 + s * 0.04, 1.72, 0);
  const beacon = new THREE.Group();
  add(beacon, new THREE.CylinderGeometry(0.12, 0.14, 0.12, 10), dark, 0, 0, 0);
  add(beacon, new THREE.CylinderGeometry(0.1, 0.1, 0.18, 10), beaconMat, 0, 0.15, 0);
  const flash = add(beacon, new THREE.BoxGeometry(0.03, 0.12, 0.16), lampMat, 0.07, 0.15, 0);
  void flash;
  beacon.position.set(-0.6, 1.62, 0.5);
  cab.add(beacon);
  add(cab, new THREE.CylinderGeometry(0.015, 0.015, 1.2, 4), steel, -0.8, 2.15, -0.6);
  cab.position.set(bodyR * 0.4, 0, -bodyR * 0.2);
  cab.rotation.y = 0.3;
  deck.add(cab);

  // The power pack: a box with radiator slats and two exhaust stacks.
  const pack = new THREE.Group();
  add(pack, new THREE.BoxGeometry(1.6, 1, 1.1), mat(0x6b7a5a, { metalness: 0.3 }), 0, 0.5, 0);
  for (let s = 0; s < 8; s++) add(pack, new THREE.BoxGeometry(0.04, 0.75, 0.04), dark, -0.82, 0.5, -0.4 + s * 0.115);
  for (const z of [-0.3, 0.3]) {
    add(pack, new THREE.CylinderGeometry(0.07, 0.07, 0.9, 8), steel, 0.5, 1.4, z);
    add(pack, new THREE.CylinderGeometry(0.1, 0.07, 0.12, 8), dark, 0.5, 1.88, z);
  }
  pack.position.set(-bodyR * 0.35, 0, bodyR * 0.45);
  pack.rotation.y = -0.5;
  deck.add(pack);

  // Tanks on saddles: hydraulic oil and coolant.
  for (const [x, z] of [[-bodyR * 0.55, -bodyR * 0.3], [-bodyR * 0.55, -bodyR * 0.3 - 0.7]] as const) {
    const t = add(deck, new THREE.CylinderGeometry(0.3, 0.3, 1.6, 16), mat(RIG.tank, { metalness: 0.5 }), x, 0.45, z);
    t.rotation.z = Math.PI / 2;
    for (const dx of [-0.5, 0.5]) add(deck, new THREE.BoxGeometry(0.1, 0.3, 0.5), dark, x + dx, 0.15, z);
    for (const dx of [-0.81, 0.81]) add(deck, new THREE.SphereGeometry(0.3, 12, 8, 0, TAU, 0, Math.PI / 2), mat(RIG.tank, { metalness: 0.5 }), x + dx, 0.45, z).rotation.z = dx > 0 ? -Math.PI / 2 : Math.PI / 2;
  }

  // The cable reel, paying out the power line that runs up the shaft beside the hoist cable.
  const reel = new THREE.Group();
  const drum = add(reel, new THREE.CylinderGeometry(0.35, 0.35, 0.8, 16), mat(0x2a2827, { metalness: 0.1, roughness: 0.9 }));
  drum.rotation.x = Math.PI / 2;
  for (const z of [-0.42, 0.42]) {
    const flange = add(reel, new THREE.CylinderGeometry(0.62, 0.62, 0.05, 20), body, 0, 0, z);
    flange.rotation.x = Math.PI / 2;
  }
  for (const z of [-0.5, 0.5]) add(reel, new THREE.BoxGeometry(0.15, 0.8, 0.08), dark, 0, -0.3, z);
  reel.position.set(bodyR * 0.05, 0.72, bodyR * 0.62);
  deck.add(reel);

  // Gas bottles in a rack, crates, and a toolbox.
  for (let k = 0; k < 4; k++) add(deck, new THREE.CylinderGeometry(0.11, 0.11, 0.9, 10), mat(RIG.bottle, { metalness: 0.4 }), bodyR * 0.55 + k * 0.25, 0.45, bodyR * 0.55);
  add(deck, new THREE.BoxGeometry(1.1, 0.06, 0.3), steel, bodyR * 0.55 + 0.37, 0.7, bodyR * 0.55);
  for (const [x, z, s] of [[bodyR * 0.75, -bodyR * 0.7, 0.6], [bodyR * 0.75 + 0.1, -bodyR * 0.7 + 0.65, 0.5], [bodyR * 0.75, -bodyR * 0.7, 0.45]] as const) {
    add(deck, new THREE.BoxGeometry(s, s, s), mat(RIG.crate, { metalness: 0, roughness: 0.9 }), x, s === 0.45 ? 0.6 + 0.225 : s / 2, z);
  }
  add(deck, new THREE.BoxGeometry(0.6, 0.3, 0.3), mat(0xb03a2e, { metalness: 0.3 }), -bodyR * 0.2, 0.15, bodyR * 0.1);

  // The skip: a tapered bucket of spoil on the deck, where the conveyor tips; the hoist cable hangs it.
  const skip = new THREE.Group();
  const bucket = add(skip, new THREE.CylinderGeometry(0.75, 0.55, 1, 4, 1, true), bodyDark);
  bucket.rotation.y = Math.PI / 4;
  (bucket.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  add(skip, new THREE.BoxGeometry(0.78, 0.05, 0.78), dark, 0, -0.5, 0);
  for (let k = 0; k < 6; k++) {
    const lump = add(skip, lumpGeo, rockMat, Math.cos(k * 1.7) * 0.25, 0.42 + (k % 2) * 0.1, Math.sin(k * 1.7) * 0.25);
    lump.scale.setScalar(1.3);
  }
  // The bail it hangs by.
  const bail = add(skip, new THREE.TorusGeometry(0.55, 0.04, 6, 16, Math.PI), steel, 0, 0.5, 0);
  bail.rotation.y = Math.PI / 2;
  skip.position.set(skipX, 0.55, skipZ);
  deck.add(skip);

  // The mast and its boom over the skip; floodlights on the mast.
  const mastH = 2.4;
  const mastX = -bodyR * 0.55;
  const mastZ = -bodyR * 0.75 + 0.2;
  const mast = new THREE.Group();
  // A lattice: four chords and cross braces.
  for (const [dx, dz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]] as const) add(mast, new THREE.BoxGeometry(0.07, mastH, 0.07), body, dx, mastH / 2, dz);
  for (let k = 0; k < 5; k++) {
    const y = 0.25 + k * 0.45;
    for (const s of [-0.2, 0.2]) {
      add(mast, new THREE.BoxGeometry(0.42, 0.04, 0.04), body, 0, y, s);
      add(mast, new THREE.BoxGeometry(0.04, 0.04, 0.42), body, s, y, 0);
    }
    // A diagonal brace on each face, alternating.
    const brace = add(mast, new THREE.BoxGeometry(0.03, 0.6, 0.03), body, k % 2 ? 0.2 : -0.2, y + 0.22, 0);
    brace.rotation.x = k % 2 ? 0.75 : -0.75;
  }
  mast.position.set(mastX, 0, mastZ);
  deck.add(mast);
  const boomLen = Math.hypot(skipX - mastX, skipZ - mastZ) + 0.2;
  const boom = add(deck, new THREE.BoxGeometry(boomLen, 0.25, 0.25), dark, (mastX + skipX) / 2, mastH, (mastZ + skipZ) / 2);
  boom.rotation.y = -Math.atan2(skipZ - mastZ, skipX - mastX);
  const sheave = add(deck, new THREE.CylinderGeometry(0.22, 0.22, 0.1, 14), steel, skipX, mastH + 0.05, skipZ);
  sheave.rotation.x = Math.PI / 2;
  // The skip's sling up to the sheave.
  add(deck, new THREE.CylinderGeometry(0.03, 0.03, mastH - 1.1, 5), dark, skipX, 1.05 + (mastH - 1.1) / 2, skipZ);
  // Floodlights: housings with glowing lenses, on the mast and round the rail.
  const lamps: THREE.Mesh[] = [];
  const flood = (x: number, y: number, z: number, aim: number) => {
    const f = new THREE.Group();
    add(f, new THREE.BoxGeometry(0.3, 0.22, 0.25), dark);
    lamps.push(add(f, new THREE.BoxGeometry(0.02, 0.17, 0.2), lampMat, 0.16, 0, 0));
    f.position.set(x, y, z);
    f.rotation.y = -aim;
    f.rotation.z = -0.4;
    deck.add(f);
  };
  flood(mastX, mastH + 0.2, mastZ + 0.2, Math.atan2(mastZ, mastX));
  flood(mastX, mastH - 0.3, mastZ - 0.25, Math.atan2(mastZ, mastX) + 1);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + 0.3;
    flood((deckR - 0.15) * Math.cos(a), 1.2, (deckR - 0.15) * Math.sin(a), a);
  }

  // ---- cables up the shaft: the hoist from the sheave, the power line from the reel. Stretched in place(). ----
  const hoistTop = deckY + 0.15 + mastH + 0.05;
  const hoist = add(g, new THREE.CylinderGeometry(0.06, 0.06, 1, 6), dark, skipX, 0, skipZ);
  const powerTop = deckY + 0.15 + 1.3;
  const power = add(g, new THREE.CylinderGeometry(0.05, 0.05, 1, 6), rubber, bodyR * 0.05, 0, bodyR * 0.62);

  let active = false;
  let t = 0;
  return {
    group: g,
    place(y, bore, on) {
      g.position.y = y;
      active = on;
      reachTo(bore >= GRIP_Y + PAD_H / 2 ? R : inner - 0.2);
      for (const [cable, top] of [[hoist, hoistTop], [power, powerTop]] as const) {
        const len = Math.max(0.1, -y - top);
        cable.scale.y = len;
        cable.position.y = top + len / 2;
      }
      lampMat.emissiveIntensity = on ? 2 : 0.5;
      beaconMat.emissiveIntensity = on ? 1.5 : 0.2;
    },
    step(dt) {
      if (!active) return;
      t += dt;
      head.rotation.y += dt * 0.35;
      beacon.rotation.y += dt * 5;
      reel.rotation.z += dt * 0.05;
      // Spoil rides up the belt and tips into the skip; new lumps come on at the bottom.
      for (const lump of lumps) {
        lump.position.x += dt * 0.6;
        lump.rotation.y += dt;
        if (lump.position.x > convLen) lump.position.x -= convLen;
      }
      lampMat.emissiveIntensity = Math.sin(t * 4) > 0 ? 2.4 : 1.2;
    },
    dispose() {
      g.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose();
        const m = mesh.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m?.dispose();
      });
      textures.forEach((x) => x.dispose());
    },
  };
}
