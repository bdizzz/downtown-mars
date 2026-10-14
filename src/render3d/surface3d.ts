import * as THREE from "three";
import type { Layout, RoomInstance } from "../sim/placement";
import { bevelBox, KIT_COLOR } from "./collar3d";
import { hazardTexture } from "./drillRig";
import { COLLAR_REACH, TAU } from "./cylinder";
import { finishMaterial } from "./surfaces";

// The buildings on the surface, in the collar's look (T-144, T-165): poured
// marscrete on a bevelled plinth, a cap overhanging each block, a band painted
// in the room's category colour, the rig's orange steel for frames and doors
// under hazard paint, yellow railings round anything you could walk off, warm
// lamps and slit windows, and a beacon on top. ART.md, "The surface", has the
// palette. Each building is built in local space with +x pointing out from the
// shaft, and placed by the caller.

/** How far from the rim surface buildings stand (metres out from the shaft's edge). */
export const SURFACE_RING_M = 16;

/** A material made once per key (rooms3d's cache, so they're freed with the rest). */
export type MaterialCache = (key: string, make: () => THREE.Material) => THREE.Material;

/** Solar panels: dark glass, dulled by dust in a storm (see `setPanelDust`). */
const PANEL = { clean: 0x1d2a4a, dusty: 0x8a6048, roughness: [0.3, 0.9] as const, metalness: [0.5, 0.1] as const };
let panels: THREE.MeshStandardMaterial | null = null;
function panelMaterial(): THREE.MeshStandardMaterial {
  panels ??= new THREE.MeshStandardMaterial({ color: PANEL.clean, metalness: PANEL.metalness[0], roughness: PANEL.roughness[0] });
  return panels;
}

/** Dust on the solar panels: 0 clean to 1 caked. */
export function setPanelDust(level: number): void {
  const m = panelMaterial();
  m.color.set(PANEL.clean).lerp(new THREE.Color(PANEL.dusty), level);
  m.roughness = PANEL.roughness[0] + (PANEL.roughness[1] - PANEL.roughness[0]) * level;
  m.metalness = PANEL.metalness[0] + (PANEL.metalness[1] - PANEL.metalness[0]) * level;
}

/** The kit's sizes: the plinth's height and the margin it leaves round what stands on it, the caps, the painted band, railings and posts. */
const KIT = { plinthH: 0.35, plinthBevel: 0.12, cap: 0.22, overhang: 0.2, band: 0.25, railH: [0.55, 1] as const, postEvery: 2.5 };

/** The parts every surface building is made from, adding to one group. */
function kit(g: THREE.Group, material: MaterialCache, color: number) {
  const mat = (c: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
    material(`prop:${c}:${JSON.stringify(extra)}`, () => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...extra }));
  const m = {
    // Named as a finish, so the Godot viewer gives it its marscrete look too.
    concrete: material("finish:marscrete:0:surface", () => finishMaterial("marscrete")),
    steel: mat(KIT_COLOR.steel, { metalness: 0.25, roughness: 0.55 }),
    steelDark: mat(KIT_COLOR.steelDark, { metalness: 0.25, roughness: 0.6 }),
    dark: mat(KIT_COLOR.dark, { metalness: 0.4 }),
    rail: mat(KIT_COLOR.rail, { metalness: 0.2 }),
    hull: mat(KIT_COLOR.hull, { metalness: 0.3, roughness: 0.5 }),
    band: mat(color),
    glow: mat(0xffd9a0, { emissive: KIT_COLOR.lamp, emissiveIntensity: 0.8, metalness: 0 }),
    lamp: mat(KIT_COLOR.lamp, { emissive: KIT_COLOR.lamp, emissiveIntensity: 2, metalness: 0 }),
    port: mat(0x9fd2ff, { emissive: 0x3a6f99, emissiveIntensity: 0.7, metalness: 0.2, roughness: 0.1 }),
    beacon: mat(KIT_COLOR.beacon, { emissive: KIT_COLOR.beacon, emissiveIntensity: 1.5, metalness: 0 }),
    hazard: material("prop:hazard", () => {
      const map = hazardTexture();
      map?.repeat.set(2, 1);
      return new THREE.MeshStandardMaterial({ map, color: map ? 0xffffff : KIT_COLOR.rail, roughness: 0.7 });
    }),
  };
  const add = (geo: THREE.BufferGeometry, mt: THREE.Material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, mt);
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };
  /** A straight member (a cylinder) between two points. */
  const strut = (a: THREE.Vector3, b: THREE.Vector3, radius: number, mt: THREE.Material) => {
    const mesh = add(new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 6), mt);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    return mesh;
  };
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  return {
    m,
    add,
    strut,
    v,
    /** A bevelled slab of concrete on the ground, its top at `h`, centred on (x, z). */
    plinth(w: number, d: number, x = 0, z = 0, h = KIT.plinthH) {
      add(bevelBox(w, h + 0.3, d, KIT.plinthBevel), m.concrete, x, (h - 0.3) / 2, z);
      return h;
    },
    /**
     * A poured block standing on `y`: bevelled, a band in the room's colour near the top, an overhanging cap,
     * and joints down its long sides. Returns the roof's height.
     */
    block(w: number, h: number, d: number, x = 0, y = 0, z = 0) {
      add(bevelBox(w, h, d, 0.15), m.concrete, x, y + h / 2, z);
      add(new THREE.BoxGeometry(w + 0.04, KIT.band, d + 0.04), m.band, x, y + h - KIT.band / 2 - 0.12, z);
      add(bevelBox(w + KIT.overhang * 2, KIT.cap, d + KIT.overhang * 2, 0.08), m.concrete, x, y + h + KIT.cap / 2, z);
      const joints = Math.max(1, Math.round(w / 3));
      for (const s of [-1, 1]) {
        for (let k = 1; k < joints; k++) add(new THREE.BoxGeometry(0.06, h - 0.5, 0.06), m.dark, x - w / 2 + (k / joints) * w, y + (h - 0.5) / 2 + 0.1, z + s * (d / 2 + 0.01));
      }
      return y + h + KIT.cap;
    },
    /** A door on a face at `x` looking along +x (or −x, `facing` −1): a recess in an orange steel frame, a hatch, hazard paint over it. */
    door(x: number, y: number, z: number, facing = 1, wide = 1.9, high = 2.1) {
      add(new THREE.BoxGeometry(0.1, high, wide), m.steel, x + facing * 0.04, y + high / 2, z);
      add(new THREE.BoxGeometry(0.1, high - 0.25, wide - 0.4), m.dark, x + facing * 0.06, y + (high - 0.25) / 2, z);
      add(new THREE.BoxGeometry(0.06, 0.22, wide), m.hazard, x + facing * 0.04, y + high + 0.15, z);
    },
    /** A railing along the given corners, posts at each and along the way, two bars, standing on `y`. */
    railing(corners: [number, number][], y: number, closed = true) {
      const n = closed ? corners.length : corners.length - 1;
      for (let k = 0; k < n; k++) {
        const [x0, z0] = corners[k]!;
        const [x1, z1] = corners[(k + 1) % corners.length]!;
        const steps = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / KIT.postEvery));
        for (let s = 0; s < steps; s++) add(new THREE.CylinderGeometry(0.04, 0.04, 1, 6), m.rail, x0 + ((x1 - x0) * s) / steps, y + 0.5, z0 + ((z1 - z0) * s) / steps);
        for (const h of KIT.railH) strut(v(x0, y + h, z0), v(x1, y + h, z1), 0.03, m.rail);
      }
      if (!closed) {
        const [x, z] = corners[corners.length - 1]!;
        add(new THREE.CylinderGeometry(0.04, 0.04, 1, 6), m.rail, x, y + 0.5, z);
      }
    },
    /** A beacon on a short base, standing on `y`. */
    beacon(x: number, y: number, z: number) {
      add(new THREE.CylinderGeometry(0.14, 0.16, 0.15, 10), m.dark, x, y + 0.08, z);
      add(new THREE.SphereGeometry(0.2, 10, 6), m.beacon, x, y + 0.3, z);
    },
    /** A lamp on a bracket over a door or along a wall (a face looking along +x at `x`). */
    lamp(x: number, y: number, z: number) {
      add(new THREE.BoxGeometry(0.3, 0.12, 0.4), m.dark, x + 0.15, y, z);
      add(new THREE.BoxGeometry(0.26, 0.03, 0.34), m.lamp, x + 0.15, y - 0.07, z);
    },
    /** A rooftop vent unit, standing on `y`. */
    vent(x: number, y: number, z: number) {
      add(bevelBox(1.4, 0.6, 1.1, 0.06), mat(0xbdb8ae, { metalness: 0.3 }), x, y + 0.3, z);
      for (let s = 0; s < 4; s++) add(new THREE.BoxGeometry(0.03, 0.4, 0.9), m.dark, x + 0.72, y + 0.3, z - 0.33 + s * 0.22);
    },
  };
}

type Kit = ReturnType<typeof kit>;

/** A surface room, on its slots round the rim: centred on them, `SURFACE_RING_M` out. */
export function surfaceBuilding(room: RoomInstance, layout: Layout, color: number, material: MaterialCache): THREE.Object3D {
  const total = layout.surface.length;
  const span = (room.surfaceCells.length / total) * TAU;
  const start = (Math.min(...room.surfaceCells) / total) * TAU;
  const mid = start + span / 2;
  const r = layout.hole.shaftRadiusM + SURFACE_RING_M;
  const g = new THREE.Group();
  g.position.set(r * Math.cos(mid), 0, r * Math.sin(mid));
  g.rotation.y = -mid;
  const k = kit(g, material, color);
  if (room.type === "landing_pod") landingPod(k);
  else if (room.type === "landing_pad") landingPad(k);
  else if (room.type === "solar_array") solarArray(k);
  else if (room.type === "rover_depot") roverDepot(k);
  else {
    k.plinth(8, 8);
    k.door(3, k.block(6, 3, 6, 0, KIT.plinthH), 0);
  }
  return g;
}

/**
 * The landing pod: the capsule the first colonists came down in, set on a concrete plinth and lived in:
 * a white hull with a band in its colour, a domed roof, round ports lit from inside, its legs grouted into
 * footings, and a concrete porch with the airlock door facing the shaft.
 */
function landingPod({ m, add, strut, v, plinth, railing, beacon, door, lamp }: Kit): void {
  const top = plinth(13, 13);
  const R = 4.2;
  const H = 3.2;
  add(new THREE.CylinderGeometry(R, R + 0.15, H, 32), m.hull, 0, top + H / 2, 0);
  // Grouted in: a concrete skirt round its foot.
  add(new THREE.CylinderGeometry(R + 0.35, R + 0.55, 0.45, 32), m.concrete, 0, top + 0.2, 0);
  add(new THREE.CylinderGeometry(R + 0.03, R + 0.03, 0.35, 32, 1, true), m.band, 0, top + H - 0.5, 0);
  // Panel seams up the hull.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    add(new THREE.BoxGeometry(0.05, H - 0.2, 0.05), m.dark, (R + 0.09) * Math.cos(a), top + H / 2, (R + 0.09) * Math.sin(a));
  }
  add(new THREE.SphereGeometry(R, 32, 10, 0, TAU, 0, Math.PI / 2), m.hull, 0, top + H, 0).scale.set(1, 0.45, 1);
  // Round ports all round, lit from inside (none behind the porch).
  for (let i = 0; i < 10; i++) {
    const a = ((i + 0.5) / 10) * TAU;
    if (Math.cos(a) < -0.85) continue;
    const port = add(new THREE.CircleGeometry(0.36, 14), m.glow, (R + 0.17) * Math.cos(a), top + 1.9, (R + 0.17) * Math.sin(a));
    port.rotation.y = Math.PI / 2 - a;
    const rim = add(new THREE.TorusGeometry(0.4, 0.06, 6, 16), m.dark, (R + 0.16) * Math.cos(a), top + 1.9, (R + 0.16) * Math.sin(a));
    rim.rotation.y = Math.PI / 2 - a;
  }
  // Legs out to footings: it came down on them, and stays on them.
  for (let i = 0; i < 4; i++) {
    const a = ((i + 0.5) / 4) * TAU;
    const foot = v(5.6 * Math.cos(a), top, 5.6 * Math.sin(a));
    strut(v((R + 0.1) * Math.cos(a), top + 2.2, (R + 0.1) * Math.sin(a)), foot, 0.17, m.steel);
    add(new THREE.CylinderGeometry(0.32, 0.4, 0.18, 10), m.dark, foot.x, top + 0.09, foot.z);
  }
  // The porch: a concrete airlock on the side facing the shaft, its door looking in.
  const px = -R - 1.1;
  add(bevelBox(2.6, 2.6, 2.8, 0.12), m.concrete, px, top + 1.3, 0);
  add(bevelBox(2.9, 0.2, 3.1, 0.06), m.concrete, px, top + 2.7, 0);
  door(px - 1.3, top, 0, -1, 1.7);
  lamp(px - 1.6, top + 2.45, 1.1);
  // A railing round the plinth's edge, open in front of the porch.
  const e = 6.3;
  railing([[-e, -1.6], [-e, -e], [e, -e], [e, e], [-e, e], [-e, 1.6]], top, false);
  // An antenna mast and the beacon on the roof.
  const crown = top + H + R * 0.45;
  add(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6), m.dark, 0.9, crown + 0.4, 0.6);
  add(new THREE.CylinderGeometry(0.35, 0.05, 0.25, 10, 1, true), m.steelDark, 0.9, crown + 1.2, 0.6);
  beacon(0, crown - 0.08, 0);
}

/**
 * The landing pad: an octagonal concrete apron with joints across it, a yellow ring and cross painted on it,
 * hazard paint round its edge, landing lights all round, and a mast with a floodlight and a beacon.
 */
function landingPad({ m, add, beacon }: Kit): void {
  const R = 7.6;
  const H = 0.45;
  const slab = add(new THREE.CylinderGeometry(R, R + 0.3, H, 8), m.concrete, 0, H / 2 - 0.05, 0);
  slab.rotation.y = TAU / 16;
  // Hazard paint round the slab's side.
  const edge = add(new THREE.CylinderGeometry(R + 0.17, R + 0.17, 0.18, 8, 1, true), m.hazard, 0, H - 0.2, 0);
  edge.rotation.y = TAU / 16;
  // Joints across the top, every 3 m each way.
  const y = H - 0.05 + 0.005;
  for (const at of [-4.5, -1.5, 1.5, 4.5]) {
    const len = 2 * Math.sqrt(Math.max(0, (R - 0.4) ** 2 - at * at)) * 0.92;
    add(new THREE.BoxGeometry(0.06, 0.01, len), m.dark, at, y, 0);
    add(new THREE.BoxGeometry(len, 0.01, 0.06), m.dark, 0, y, at);
  }
  // The painted target: a ring and a cross.
  const ring = add(new THREE.RingGeometry(4.6, 5.1, 48), m.rail, 0, y + 0.005, 0);
  ring.rotation.x = -Math.PI / 2;
  for (const turn of [0, Math.PI / 2]) add(new THREE.BoxGeometry(5, 0.012, 0.5), m.rail, 0, y + 0.006, 0).rotation.y = turn;
  // Landing lights round the edge.
  for (let i = 0; i < 16; i++) {
    const a = ((i + 0.5) / 16) * TAU;
    add(new THREE.CylinderGeometry(0.12, 0.14, 0.14, 8), m.lamp, (R - 0.35) * Math.cos(a), H + 0.02, (R - 0.35) * Math.sin(a));
  }
  // The mast at one corner, on a footing: a floodlight looking over the pad and the beacon on top.
  const mx = R - 0.2;
  const mz = -R + 0.9;
  add(new THREE.BoxGeometry(0.9, 0.3, 0.9), m.concrete, mx, H + 0.1, mz);
  add(new THREE.CylinderGeometry(0.1, 0.12, 4, 8), m.steel, mx, H + 2.2, mz);
  const flood = add(new THREE.BoxGeometry(0.5, 0.3, 0.4), m.dark, mx - 0.3, H + 3.8, mz + 0.3);
  flood.rotation.set(0.4, Math.PI / 4, 0);
  beacon(mx, H + 4.2, mz);
  // A painted band in the room's colour round the mast's foot.
  add(new THREE.CylinderGeometry(0.15, 0.15, 0.3, 8), m.band, mx, H + 0.55, mz);
}

/**
 * The solar array: rows of panels on orange steel trestles, each row on a concrete footing, a cable run
 * along their feet, and an inverter cabinet on a plinth at the end, in the room's colour.
 */
function solarArray({ m, add, plinth, lamp }: Kit): void {
  const tilt = 0.5;
  for (const dz of [-4.2, -1.4, 1.4, 4.2]) {
    add(bevelBox(4.4, 0.3, 0.8, 0.08), m.concrete, 0, 0.1, dz);
    for (const x of [-1.5, 1.5]) {
      // A trestle: a leg up to the panel's frame, shorter on the low side.
      const h = 1.35 + Math.tan(tilt) * x * 0.6;
      add(new THREE.BoxGeometry(0.12, h, 0.12), m.steel, x * 0.7, 0.25 + h / 2, dz);
    }
    const frame = add(new THREE.BoxGeometry(3.7, 0.08, 2.4), m.steelDark, 0, 1.6, dz);
    frame.rotation.z = tilt;
    const panel = add(new THREE.BoxGeometry(3.5, 0.08, 2.2), panelMaterial(), 0, 1.66, dz);
    panel.rotation.z = tilt;
    // Cell lines across each panel.
    for (const s of [-0.75, 0, 0.75]) {
      const line = add(new THREE.BoxGeometry(3.5, 0.09, 0.03), m.dark, 0, 1.66, dz + s);
      line.rotation.z = tilt;
    }
  }
  // The cable run along the rows' feet, to the inverter.
  add(new THREE.BoxGeometry(0.3, 0.15, 11.6), m.dark, -2.6, 0.08, 0.6);
  const top = plinth(2.2, 1.8, -2.6, 6.4, 0.3);
  add(bevelBox(1, 1.4, 1.3, 0.06), m.hull, -2.6, top + 0.7, 6.4);
  add(new THREE.BoxGeometry(1.04, 0.22, 1.34), m.band, -2.6, top + 1.2, 6.4);
  lamp(-2.1, top + 1.55, 6.4);
}

/**
 * The rover depot: a concrete garage with a ribbed roller door in an orange steel frame, an apron out
 * front, and two rovers parked on it (orange chassis, white cabins, dark wheels).
 */
function roverDepot({ m, add, plinth, block, lamp, vent, beacon, railing }: Kit): void {
  // The garage stands at the shaft's end, its door facing out (+x) onto the apron.
  const gx = -3.5;
  const top = plinth(18, 13);
  const roof = block(6, 3.4, 10, gx, top, 0);
  const front = gx + 3;
  add(new THREE.BoxGeometry(0.12, 2.9, 7), m.steel, front + 0.04, top + 1.45, 0);
  add(new THREE.BoxGeometry(0.1, 2.7, 6.6), m.dark, front + 0.06, top + 1.35, 0);
  for (let i = 1; i < 9; i++) add(new THREE.BoxGeometry(0.04, 0.05, 6.6), m.steelDark, front + 0.12, top + i * 0.3, 0);
  add(new THREE.BoxGeometry(0.06, 0.22, 7), m.hazard, front + 0.04, top + 3.0, 0);
  lamp(front, top + 3.25, -2.2);
  lamp(front, top + 3.25, 2.2);
  vent(gx - 1, roof, -2.5);
  beacon(gx + 2, roof, 3.5);
  railing([[gx - 3.05, -5.05], [gx + 3.05, -5.05], [gx + 3.05, 5.05], [gx - 3.05, 5.05]], roof);
  // Two rovers on the apron, side by side.
  for (const dz of [-2.4, 2.4]) {
    const x = 4.2;
    add(new THREE.BoxGeometry(3.4, 0.5, 2.1), m.steel, x, top + 0.75, dz);
    add(bevelBox(2.1, 1.0, 1.9, 0.12), m.hull, x - 0.4, top + 1.5, dz);
    const glass = add(new THREE.BoxGeometry(0.05, 0.5, 1.6), m.port, x + 0.66, top + 1.65, dz);
    glass.rotation.z = -0.25;
    add(new THREE.BoxGeometry(2.14, 0.15, 1.94), m.band, x - 0.4, top + 1.15, dz);
    for (const [wx, wz] of [[-1.1, -1.05], [1.1, -1.05], [-1.1, 1.05], [1.1, 1.05]] as const) {
      const wheel = add(new THREE.CylinderGeometry(0.45, 0.45, 0.35, 14), m.dark, x + wx, top + 0.45, dz + wz);
      wheel.rotation.x = Math.PI / 2;
    }
  }
}

/** The entrance's gatehouse (T-144): its size, and how far into the collar's rim its back is set so it reads as built onto it. */
const GATEHOUSE = { deep: 5.4, high: 2.6, wide: 6, setIn: 0.4 };

/**
 * The entrance's airlock on the surface, at angle `a` round the shaft: a gatehouse poured against the
 * collar's rim, with the door looking out, a ramp down to the ground, slit windows, and a railed roof
 * with a vent and the beacon.
 */
export function airlock(layout: Layout, a: number, color: number, material: MaterialCache): THREE.Object3D {
  const G = GATEHOUSE;
  // Local +x points out from the shaft; its back face sits just inside the rim's outer wall.
  const back = layout.hole.shaftRadiusM + COLLAR_REACH - G.setIn;
  const g = new THREE.Group();
  const r = back + G.deep / 2;
  g.position.set(r * Math.cos(a), 0, r * Math.sin(a));
  g.rotation.y = -a;
  const { m, add, block, door, railing, vent, beacon } = kit(g, material, color);
  const front = G.deep / 2;
  const roof = block(G.deep, G.high, G.wide);
  door(front, 0, 0);
  const port = add(new THREE.CircleGeometry(0.25, 16), m.port, front + 0.12, 1.35, 0);
  port.rotation.y = Math.PI / 2;
  // The ramp down to the ground, with a kerb each side.
  const rampLen = 2.6;
  const ramp = add(new THREE.BoxGeometry(rampLen, 0.25, 2.2), m.concrete, front + rampLen / 2, 0.05, 0);
  ramp.rotation.z = -0.06;
  for (const z of [-1.15, 1.15]) add(new THREE.BoxGeometry(rampLen, 0.3, 0.12), m.dark, front + rampLen / 2, 0.15, z);
  // Slit windows down each side, lit from inside, either side of the wall's middle joint.
  for (const z of [-G.wide / 2 - 0.02, G.wide / 2 + 0.02]) for (const x of [-1.5, -0.55, 0.55, 1.5]) add(new THREE.BoxGeometry(0.6, 0.18, 0.04), m.glow, x, 1.75, z);
  vent(-front / 2, roof, 0);
  const rx = front + KIT.overhang - 0.12;
  const rz = G.wide / 2 + KIT.overhang - 0.12;
  railing([[-rx, -rz], [rx, -rz], [rx, rz], [-rx, rz]], roof);
  beacon(front - 0.5, roof, 0);
  return g;
}

/**
 * A cargo elevator's headframe at angle `a`, `r` out: a concrete collar over its shaft with a hatch, two
 * latticed orange legs up to a sheave, a railing round the collar, and a beacon on top.
 */
export function headframe(a: number, r: number, color: number, material: MaterialCache): THREE.Object3D {
  const g = new THREE.Group();
  g.position.set(r * Math.cos(a), 0, r * Math.sin(a));
  g.rotation.y = -a;
  const { m, add, strut, v, plinth, railing, beacon } = kit(g, material, color);
  const top = plinth(5.6, 5.6, 0, 0, 0.6);
  add(new THREE.BoxGeometry(3, 0.04, 3), m.dark, 0, top + 0.02, 0);
  add(new THREE.BoxGeometry(3.2, 0.06, 0.2), m.hazard, 0, top + 0.03, -1.6);
  add(new THREE.BoxGeometry(5.64, 0.2, 5.64), m.band, 0, top - 0.15, 0);
  const H = 8.6;
  for (const s of [-1, 1]) {
    const head = v(0, H - 0.4, s * 0.5);
    const feet = [v(-1.8, top, s * 2.3), v(1.8, top, s * 2.3)];
    for (const f of feet) {
      strut(f, head, 0.12, m.steel);
      add(new THREE.BoxGeometry(0.45, 0.1, 0.45), m.dark, f.x, top + 0.05, f.z);
    }
    // Lattice across the two legs.
    const at = (i: number, t: number) => feet[i]!.clone().lerp(head, t);
    const bays = [0.15, 0.45, 0.75];
    for (let k = 0; k < bays.length; k++) {
      strut(at(0, bays[k]!), at(1, bays[k]!), 0.05, m.steelDark);
      if (k + 1 < bays.length) strut(at(k % 2, bays[k]!), at(1 - (k % 2), bays[k + 1]!), 0.04, m.steelDark);
    }
  }
  // The sheave between the legs' heads, turning on an axle across them.
  add(new THREE.TorusGeometry(1.1, 0.12, 6, 24), m.steelDark, 0, H, 0);
  for (let k = 0; k < 4; k++) add(new THREE.BoxGeometry(0.04, 2.2, 0.04), m.steelDark, 0, H, 0).rotation.z = (k / 4) * Math.PI;
  const axle = add(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 8), m.dark, 0, H, 0);
  axle.rotation.x = Math.PI / 2;
  beacon(0, H + 1.2, 0);
  railing([[-2.6, -2.6], [2.6, -2.6], [2.6, 2.6], [-2.6, 2.6]], top);
  return g;
}
