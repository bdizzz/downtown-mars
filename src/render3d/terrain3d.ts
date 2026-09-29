import * as THREE from "three";

// The land around the hole: the ground rolls away from a flat pad at the rim
// (where surface buildings stand) in undulations and ridges, pocked with
// craters and scattered with boulders; on the horizon, a ring of mountains,
// a mesa or two, or low hills, depending on the site. All of it is real
// geometry, so it turns and shifts with the camera. The same site always
// gets the same land.

export type HorizonStyle = "mountains" | "mesas" | "hills";

/** Sizes in metres. */
const LAND = {
  /** Flat around the rim, then easing into the terrain over `blend`. */
  pad: 45,
  blend: 60,
  /** The ground reaches this far out, to meet the horizon. */
  reach: 1700,
  rings: 110,
  segments: 256,
  /** Rolling ground and ridges: heights and sizes. */
  roll: { height: 1.6, size: 70 },
  ridge: { height: 4.5, size: 240 },
  /** The land rises a little toward the horizon. */
  rise: 18,
  craters: { count: 14, min: 5, max: 70, depth: 0.22, rim: 0.08 },
  rocks: { count: 320, min: 0.25, max: 2.2, near: 50, far: 900 },
  /** The horizon ring: where its ridge line runs, and how finely. */
  horizon: { radius: 1500, segments: 720 },
};

const COLORS = { rock: 0x4a2c20, horizon: 0x9a5c44 };

/** A small seeded random generator (mulberry32). */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth value noise on a plane, seeded. */
function noise2(seed: number): (x: number, y: number) => number {
  const hash = (i: number, j: number) => {
    let h = (i * 374761393 + j * 668265263 + seed * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const fade = (t: number) => t * t * (3 - 2 * t);
  return (x, y) => {
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fx = fade(x - i);
    const fy = fade(y - j);
    const a = hash(i, j) + (hash(i + 1, j) - hash(i, j)) * fx;
    const b = hash(i, j + 1) + (hash(i + 1, j + 1) - hash(i, j + 1)) * fx;
    return a + (b - a) * fy;
  };
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Which horizon a site has: from where it is, or (before it has a place on the map) its name. */
export function horizonStyle(seed: number): HorizonStyle {
  const r = random(seed ^ 0x9e3779b9)();
  return r < 0.36 ? "mountains" : r < 0.66 ? "mesas" : "hills";
}

/** A seed for a site: its rounded map position, or failing that, its name. */
export function siteSeed(site: { lat: number; lon: number } | null, name: string): number {
  if (site) return (Math.round(site.lat * 10) * 7919 + Math.round(site.lon * 10) * 104729) | 0;
  let h = 2166136261;
  for (const ch of name) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h | 0;
}

export interface Terrain {
  group: THREE.Group;
  /** The ground itself (its material shows through in X-ray). */
  ground: THREE.Mesh;
  style: HorizonStyle;
  /** The ground's height at a point, metres. */
  heightAt: (x: number, z: number) => number;
}

/** The land around a hole of this rim radius, for this site. */
export function buildTerrain(rim: number, seed: number, groundMaterial: THREE.Material): Terrain {
  const style = horizonStyle(seed);
  const rand = random(seed);
  const roll = noise2(seed + 11);
  const ridge = noise2(seed + 23);
  // Craters: a few, of all sizes, clear of the pad.
  const craters = Array.from({ length: LAND.craters.count }, () => {
    const radius = LAND.craters.min + (LAND.craters.max - LAND.craters.min) * rand() ** 2;
    const d = rim + LAND.pad + LAND.blend + radius + rand() * 800;
    const a = rand() * Math.PI * 2;
    return { x: d * Math.cos(a), z: d * Math.sin(a), radius };
  });

  const heightAt = (x: number, z: number): number => {
    const d = Math.hypot(x, z) - rim;
    const away = smoothstep(LAND.pad, LAND.pad + LAND.blend, d);
    if (away <= 0) return 0;
    let h = (roll(x / LAND.roll.size, z / LAND.roll.size) - 0.5) * 2 * LAND.roll.height;
    h += (roll(x / (LAND.roll.size * 0.37), z / (LAND.roll.size * 0.37)) - 0.5) * LAND.roll.height * 0.6;
    // Ridges: the creases of a noise, sharpened.
    const rv = 1 - Math.abs(ridge(x / LAND.ridge.size, z / LAND.ridge.size) * 2 - 1);
    h += rv ** 3 * LAND.ridge.height;
    h += smoothstep(300, LAND.reach, d) * LAND.rise;
    for (const c of craters) {
      const t = Math.hypot(x - c.x, z - c.z) / c.radius;
      if (t > 1.8) continue;
      h += c.radius * LAND.craters.rim * Math.exp(-((t - 1) ** 2) / 0.08);
      if (t < 1) h -= c.radius * LAND.craters.depth * (1 - t * t);
    }
    return h * away;
  };

  const group = new THREE.Group();

  // The ground: rings from the rim out, spaced wider the further they go.
  const pos: number[] = [];
  const index: number[] = [];
  const S = LAND.segments;
  for (let i = 0; i <= LAND.rings; i++) {
    const t = i / LAND.rings;
    const r = rim + (LAND.reach - rim) * t ** 2.2;
    for (let j = 0; j < S; j++) {
      const a = (j / S) * Math.PI * 2;
      const x = r * Math.cos(a);
      const z = r * Math.sin(a);
      pos.push(x, heightAt(x, z), z);
    }
  }
  for (let i = 0; i < LAND.rings; i++) {
    for (let j = 0; j < S; j++) {
      const a = i * S + j;
      const b = i * S + ((j + 1) % S);
      const c = (i + 1) * S + j;
      const d = (i + 1) * S + ((j + 1) % S);
      index.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, groundMaterial);
  group.add(ground);

  // Boulders, sitting a little into the ground.
  const rockMat = new THREE.MeshStandardMaterial({ color: COLORS.rock, roughness: 1, flatShading: true });
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), rockMat, LAND.rocks.count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let k = 0; k < LAND.rocks.count; k++) {
    const d = rim + LAND.rocks.near + (LAND.rocks.far - LAND.rocks.near) * rand() ** 1.6;
    const a = rand() * Math.PI * 2;
    const s = LAND.rocks.min + (LAND.rocks.max - LAND.rocks.min) * rand() ** 3;
    const x = d * Math.cos(a);
    const z = d * Math.sin(a);
    q.setFromEuler(new THREE.Euler(rand() * 3, rand() * 3, rand() * 3));
    m.compose(new THREE.Vector3(x, heightAt(x, z) + s * 0.25, z), q, new THREE.Vector3(s * (0.8 + rand() * 0.6), s * (0.5 + rand() * 0.4), s * (0.8 + rand() * 0.6)));
    rocks.setMatrixAt(k, m);
  }
  group.add(rocks);

  group.add(horizon(style, seed));
  return { group, ground, style, heightAt };
}

/** The skyline's height at an angle, for a style: jagged peaks, flat-topped mesas, or soft hills. */
function skyline(style: HorizonStyle, seed: number): (a: number) => number {
  const n = noise2(seed + 101);
  // Noise round a circle, so the skyline joins up where it started.
  const ring = (a: number, f: number) => n(Math.cos(a) * f + 50, Math.sin(a) * f + 50);
  if (style === "hills") return (a) => 10 + 34 * (ring(a, 2) * 0.7 + ring(a, 5) * 0.3);
  if (style === "mountains") {
    return (a) => {
      let h = 0;
      let amp = 1;
      for (const f of [2.5, 6, 14, 30]) {
        h += (1 - Math.abs(ring(a, f) * 2 - 1)) * amp;
        amp *= 0.45;
      }
      return 30 + 190 * (h / 1.8) ** 2.2;
    };
  }
  const rand = random(seed + 7);
  const mesas = Array.from({ length: 1 + Math.floor(rand() * 2.4) }, () => ({
    at: rand() * Math.PI * 2,
    half: 0.07 + rand() * 0.14,
    height: 60 + rand() * 60,
  }));
  return (a) => {
    let h = 6 + 12 * ring(a, 3);
    for (const m of mesas) {
      const d = Math.abs(Math.atan2(Math.sin(a - m.at), Math.cos(a - m.at)));
      // Steep sides, a flat (slightly worn) top.
      const top = m.height * (0.96 + 0.04 * ring(a, 40));
      h = Math.max(h, top * smoothstep(m.half, m.half * 0.8, d));
    }
    return h;
  };
}

/**
 * The horizon: a ridge all the way round, faceted. Each point on the skyline
 * is a peak with a slope in front and behind, so the light catches it.
 */
function horizon(style: HorizonStyle, seed: number): THREE.Mesh {
  const H = skyline(style, seed);
  const { radius, segments } = LAND.horizon;
  const pos: number[] = [];
  const index: number[] = [];
  for (let j = 0; j < segments; j++) {
    const a = (j / segments) * Math.PI * 2;
    const h = H(a);
    const c = Math.cos(a);
    const s = Math.sin(a);
    // In front (toward the hole), the peak, and behind.
    const front = radius - h * (style === "mesas" ? 0.35 : 1.3);
    const back = radius + h * 1.3;
    pos.push(front * c, -2, front * s, radius * c, h, radius * s, back * c, -2, back * s);
  }
  for (let j = 0; j < segments; j++) {
    const a = j * 3;
    const b = ((j + 1) % segments) * 3;
    index.push(a, a + 1, b, b, a + 1, b + 1, a + 1, a + 2, b + 1, b + 1, a + 2, b + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  const flat = geo.toNonIndexed();
  flat.computeVertexNormals();
  geo.dispose();
  return new THREE.Mesh(flat, new THREE.MeshStandardMaterial({ color: COLORS.horizon, roughness: 1, flatShading: true, side: THREE.DoubleSide }));
}
