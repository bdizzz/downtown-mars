import * as THREE from "three";

// A bulkhead's hatch (#614): a steel wall across the corridor with a rounded doorway in a raised
// frame, and a submarine-style door hung in it, a wheel in its middle. In Free view and the
// cutaway it stands open; in first person it's shut until you come near, when the wheel spins and
// the door swings open, and shuts again once you've gone (with a clank and a hiss).
// Walking isn't stopped by it either way: the swing is for the look.

/** The hatch's sizes (metres) and colours. The wall fills the corridor's width up to `height`. */
export const HATCH = {
  height: 2.9,
  /** The steel wall across the corridor: its thickness. */
  wall: 0.12,
  /** The doorway: its width, height, the radius of its corners, and its sill above the floor. */
  open: { width: 1.15, height: 1.95, corner: 0.32, sill: 0.18 },
  /** The raised frame round the doorway: how wide, and how far it stands out of the wall each side. */
  rim: { width: 0.13, proud: 0.07 },
  /** The door: how far it laps over the doorway, and its thickness. */
  door: { lap: 0.05, thick: 0.08 },
  /** The wheel: its radius, the rim's thickness, and how far it stands off the door. */
  wheel: { radius: 0.24, tube: 0.026, off: 0.09 },
  colors: { wall: 0x5d646b, rim: 0x3b3f45, door: 0xc9a456, wheel: 0x9a3b2c, stripe: 0xe0a03a },
};

/** How the hatch moves (first person): how near opens it, how long it takes, how far it swings and the wheel turns. */
export const HATCH_MOTION = {
  /** Opens when you're this close (metres, on its floor), and shuts once you're further than `closeM`. */
  openM: 4.5,
  closeM: 5.5,
  /** Seconds from shut to open (the wheel's spin, then the swing); shutting takes the same. */
  seconds: 1.2,
  /** The part of that spent spinning the wheel before the door moves. */
  spinShare: 0.35,
  /** How far the door swings (radians), and how far the wheel turns (radians). */
  swing: (Math.PI * 100) / 180,
  spin: Math.PI * 2.5,
};

export interface HatchMaterials {
  wall: THREE.Material;
  rim: THREE.Material;
  door: THREE.Material;
  wheel: THREE.Material;
  stripe: THREE.Material;
}

/** A rounded rectangle, centred on x, from y0 up (a path, so it can be a shape or a hole). */
function roundedRect<T extends THREE.Path>(p: T, w: number, h: number, r: number, y0: number): T {
  const [x0, x1, y1] = [-w / 2, w / 2, y0 + h];
  p.moveTo(x0 + r, y0);
  p.lineTo(x1 - r, y0);
  p.quadraticCurveTo(x1, y0, x1, y0 + r);
  p.lineTo(x1, y1 - r);
  p.quadraticCurveTo(x1, y1, x1 - r, y1);
  p.lineTo(x0 + r, y1);
  p.quadraticCurveTo(x0, y1, x0, y1 - r);
  p.lineTo(x0, y0 + r);
  p.quadraticCurveTo(x0, y0, x0 + r, y0);
  return p;
}

/** A shape extruded `depth` through z, centred on z = 0. */
function slab(shape: THREE.Shape, depth: number): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 6 });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** The shared shapes, made once (they're the same for every hatch, and never disposed). */
let parts: ReturnType<typeof makeParts> | null = null;
function makeParts() {
  const { open, rim, door, wheel } = HATCH;
  const hole = () => roundedRect(new THREE.Path(), open.width, open.height, open.corner, open.sill);
  // The wall itself is shaped per corridor width (see hatchGroup); the rest is the same for all.
  const rimShape = roundedRect(new THREE.Shape(), open.width + 2 * rim.width, open.height + 2 * rim.width, open.corner + rim.width, open.sill - rim.width);
  rimShape.holes.push(hole());
  const leafShape = roundedRect(new THREE.Shape(), open.width + 2 * door.lap, open.height + 2 * door.lap, open.corner + door.lap, open.sill - door.lap);
  // The leaf's own middle at x = 0: it hangs from a hinge at its left edge (see hatchGroup).
  const leaf = slab(leafShape, door.thick);
  // A painted band across the door, inset from its edges.
  const band = new THREE.BoxGeometry(open.width - 0.1, 0.12, door.thick + 0.012);
  band.translate(0, open.sill + open.height * 0.22, 0);
  // The wheel: a ring, a hub and three spokes, facing along z, centred on its axle.
  const ring = new THREE.TorusGeometry(wheel.radius, wheel.tube, 6, 20);
  const hub = new THREE.CylinderGeometry(0.05, 0.05, 0.06, 10).rotateX(Math.PI / 2);
  const spoke = new THREE.CylinderGeometry(0.014, 0.014, wheel.radius * 2, 5);
  const axle = new THREE.CylinderGeometry(0.02, 0.02, wheel.off, 6).rotateX(Math.PI / 2);
  const hinge = new THREE.CylinderGeometry(0.035, 0.035, 0.22, 8);
  return { rim: slab(rimShape, HATCH.wall + 2 * rim.proud), leaf, band, ring, hub, spoke, axle, hinge, hole };
}

const cached = (m: THREE.Mesh) => ((m.userData.cached = true), m);

/** Each hatch's moving parts, by its group (kept out of userData, which a clone copies as JSON). */
const rigs = new WeakMap<THREE.Object3D, HatchRig>();

/** The parts of a hatch that move. */
export interface HatchRig {
  /** Turns about y at the hinge: 0 shut, HATCH_MOTION.swing open. */
  hinge: THREE.Object3D;
  /** Turns about the door's z: the wheel. */
  wheel: THREE.Object3D;
}

/**
 * A hatch across a corridor `width` wide, in its own frame: x across the corridor, y up from the
 * floor, z along the corridor. Built open (as Free view shows it); `setHatch` moves it.
 */
export function hatchGroup(width: number, mats: HatchMaterials): { group: THREE.Group; rig: HatchRig } {
  parts ??= makeParts();
  const { open, door, wheel, rim } = HATCH;
  const g = new THREE.Group();
  // The steel wall, the corridor's width, with the doorway cut through it (shaped per width: not cached).
  const wallShape = new THREE.Shape();
  wallShape.moveTo(-width / 2, 0).lineTo(width / 2, 0).lineTo(width / 2, HATCH.height).lineTo(-width / 2, HATCH.height).lineTo(-width / 2, 0);
  wallShape.holes.push(parts.hole());
  g.add(new THREE.Mesh(slab(wallShape, HATCH.wall), mats.wall));
  g.add(cached(new THREE.Mesh(parts.rim, mats.rim)));
  // The door hangs on the +z face of the rim, from a hinge at the doorway's left edge.
  const face = HATCH.wall / 2 + rim.proud + door.thick / 2;
  const hingeX = -open.width / 2 - door.lap;
  const hinge = new THREE.Group();
  hinge.position.set(hingeX, 0, face);
  const leaf = new THREE.Group();
  leaf.position.x = -hingeX; // the leaf's middle, from the hinge
  leaf.add(cached(new THREE.Mesh(parts.leaf, mats.door)), cached(new THREE.Mesh(parts.band, mats.stripe)));
  // The wheel, on both faces of the door, on one axle through it.
  const spin = new THREE.Group();
  spin.position.y = open.sill + open.height / 2;
  for (const side of [-1, 1]) {
    const at = side * (door.thick / 2 + wheel.off);
    const axle = cached(new THREE.Mesh(parts.axle, mats.rim));
    axle.position.z = side * (door.thick / 2 + wheel.off / 2);
    const ring = cached(new THREE.Mesh(parts.ring, mats.wheel));
    const hub = cached(new THREE.Mesh(parts.hub, mats.wheel));
    ring.position.z = hub.position.z = at;
    spin.add(axle, ring, hub);
    for (let k = 0; k < 3; k++) {
      const s = cached(new THREE.Mesh(parts.spoke, mats.wheel));
      s.position.z = at;
      s.rotation.z = (k * Math.PI) / 3;
      spin.add(s);
    }
  }
  leaf.add(spin);
  hinge.add(leaf);
  // Two hinge knuckles on the frame, at the door's edge.
  for (const y of [open.sill + 0.35, open.sill + open.height - 0.35]) {
    const k = cached(new THREE.Mesh(parts.hinge, mats.rim));
    k.position.set(hingeX - 0.02, y, face);
    g.add(k);
  }
  g.add(hinge);
  const rig = { hinge, wheel: spin };
  rigs.set(g, rig);
  setHatch(rig, 1);
  return { group: g, rig };
}

/** Put a hatch at `p` of the way open (0 shut, 1 open): the wheel turns first, then the door swings. */
export function setHatch(rig: HatchRig, p: number): void {
  const { spinShare, swing, spin } = HATCH_MOTION;
  const turn = Math.min(1, p / spinShare);
  const s = Math.max(0, Math.min(1, (p - spinShare) / (1 - spinShare)));
  const eased = s * s * (3 - 2 * s);
  rig.wheel.rotation.z = turn * spin;
  rig.hinge.rotation.y = -eased * swing;
}

/** A hatch in the scene: which bulkhead, where it stands, and its moving parts. */
export interface HatchSpot {
  id: string;
  floor: number;
  x: number;
  z: number;
  rig: HatchRig;
}

/**
 * The hatches as you walk among them. Each frame, `step` opens the ones near the walker (on their
 * floor) and shuts the rest; with no walker (Free view, the cutaway) they all stand open. How far
 * open each is lives on across rebuilds of the scene, by bulkhead id.
 */
export function createHatches(sound: (opening: boolean) => void) {
  let spots: HatchSpot[] = [];
  /** How far open (0 to 1), and whether it's opening, by bulkhead id. */
  const state = new Map<string, { p: number; opening: boolean }>();
  let walking = false;
  return {
    /** The hatches in a newly built scene: everything under `root` that's one. */
    collect(root: THREE.Object3D): void {
      spots = [];
      root.traverse((o) => {
        const h = o.userData.hatch as Omit<HatchSpot, "rig"> | undefined;
        const rig = rigs.get(o);
        if (h && rig) spots.push({ ...h, rig });
      });
      for (const s of spots) {
        const st = state.get(s.id);
        setHatch(s.rig, st ? st.p : walking ? 0 : 1);
      }
    },
    /** Move them on by `dt` seconds; true if any moved (so the frame wants redrawing). */
    step(dt: number, walker: { floor: number; x: number; z: number } | null): boolean {
      const was = walking;
      walking = !!walker;
      let moved = false;
      for (const s of spots) {
        let st = state.get(s.id);
        const near = walker && walker.floor === s.floor ? Math.hypot(walker.x - s.x, walker.z - s.z) : Infinity;
        if (!st) state.set(s.id, (st = { p: walker ? 0 : 1, opening: !walker }));
        // Into or out of first person: shut (or open) straight away, without a sound.
        if (was !== walking) {
          st.opening = !walker || near < HATCH_MOTION.openM;
          st.p = st.opening ? 1 : 0;
          setHatch(s.rig, st.p);
          moved = true;
          continue;
        }
        if (walker) {
          const opening = st.opening ? near < HATCH_MOTION.closeM : near < HATCH_MOTION.openM;
          if (opening !== st.opening) {
            st.opening = opening;
            sound(opening);
          }
        }
        const target = st.opening ? 1 : 0;
        if (st.p === target) continue;
        const d = dt / HATCH_MOTION.seconds;
        st.p = target > st.p ? Math.min(1, st.p + d) : Math.max(0, st.p - d);
        setHatch(s.rig, st.p);
        moved = true;
      }
      return moved;
    },
    /** The hatches in the scene (for the dev console). */
    get spots(): readonly HatchSpot[] {
      return spots;
    },
  };
}
