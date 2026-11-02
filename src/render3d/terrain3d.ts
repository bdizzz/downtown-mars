import * as THREE from "three";
import mapData from "../../data/mars-map.json";

// The land around the hole: the ground rolls away from a flat pad at the rim
// (where surface buildings stand) in undulations and ridges, pocked with
// craters and scattered with boulders; toward the horizon, landforms of their
// own at several distances (mountain massifs, mesas and buttes, plateaus,
// domed hills and the raised rims of big craters) in front of a far ridge of
// mountains, low ground or hills, depending on the site. All of it is real
// geometry, so it turns, shades with the sun and shifts with the camera, and
// the farther it stands the paler and dustier it is. The same site always gets
// the same land.

export type HorizonStyle = "mountains" | "mesas" | "hills";
type LandformKind = "massif" | "mesa" | "butte" | "plateau" | "dome" | "crater";

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
  /** Landforms in front of it, by kind: how far out, how wide (their footprint's radius) and how tall, and how many facets round. */
  landforms: {
    massif: { near: 750, far: 1300, radius: [180, 380], height: [90, 230], segments: 40 },
    mesa: { near: 600, far: 1300, radius: [110, 260], height: [50, 120], segments: 40 },
    butte: { near: 550, far: 1250, radius: [60, 110], height: [45, 95], segments: 28 },
    plateau: { near: 950, far: 1300, radius: [280, 460], height: [35, 75], segments: 48 },
    dome: { near: 700, far: 1300, radius: [200, 400], height: [25, 60], segments: 36 },
    /** A crater's height is its rim's, a share of its radius. */
    crater: { near: 850, far: 1250, radius: [180, 360], height: [0.06, 0.09], segments: 48 },
  },
  /** How many of each a site gets, by its horizon style: [fewest, most]. Every site has a big crater or two, more on flatter land (Bryon, Oct 5). */
  mix: {
    mountains: { massif: [4, 6], plateau: [1, 1], crater: [1, 2] },
    mesas: { mesa: [3, 6], plateau: [1, 1], crater: [2, 3] },
    hills: { dome: [3, 5], plateau: [1, 1], crater: [2, 3] },
  } as Record<HorizonStyle, Partial<Record<LandformKind, [number, number]>>>,
  /** Of the mesas, this share are narrow buttes. */
  buttes: 0.35,
  /** Aerial perspective: the farthest land leans this far toward the dust of the sky at the horizon. */
  haze: { near: 400, far: 1600, most: 0.42 },
};

const COLORS = { rock: 0x4a2c20, horizon: 0x9a5c44, haze: 0xdca77a };
/** The ground's own dust, before a site's soil tints it. */
export const GROUND_BASE = 0x7a3b22;

/**
 * A site's colour on the land (T-073). The ground leans from its base dust toward the map's colour there
 * (`soil`, from the sim's soilAt) by data/mars-map.json's soil strength, so dark lowlands and pale
 * highlands differ but both still read as Mars. Boulders and the horizon shift with it, by as much as
 * they're bright next to the ground (dark rock a little, the pale horizon a little more).
 */
export function soilTint(hex: number, soil: string | null): number {
  if (!soil) return hex;
  const k = mapData.soil.strength;
  const channels = (n: number) => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const lum = (c: number[]) => c[0]! + c[1]! + c[2]!;
  const base = channels(GROUND_BASE);
  const want = channels(parseInt(soil.slice(1), 16));
  const c = channels(hex);
  const share = lum(c) / lum(base);
  const out = c.map((v, i) => Math.min(255, Math.max(0, Math.round(v + (want[i]! - base[i]!) * k * share))));
  return (out[0]! << 16) | (out[1]! << 8) | out[2]!;
}

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
  /** The ground itself. */
  ground: THREE.Mesh;
  style: HorizonStyle;
  /** The ground's height at a point, metres. */
  heightAt: (x: number, z: number) => number;
}

/** The land around a hole of this rim radius, for this site, its boulders and horizon tinted by its soil. */
export function buildTerrain(rim: number, seed: number, groundMaterial: THREE.Material, soil: string | null = null): Terrain {
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
  const rockMat = new THREE.MeshStandardMaterial({ color: soilTint(COLORS.rock, soil), roughness: 1, flatShading: true });
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

  const tint = soilTint(COLORS.horizon, soil);
  group.add(horizon(style, seed, tint));
  for (const m of landforms(style, seed, rim, heightAt, tint)) group.add(m);
  return { group, ground, style, heightAt };
}

/** The far skyline's height at an angle, for a style: jagged peaks, low broken ground (behind the mesas), or soft hills. */
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
  // Mesas stand in front as landforms of their own; behind them, low broken ground.
  return (a) => 6 + 14 * (ring(a, 3) * 0.75 + ring(a, 9) * 0.25);
}

/**
 * The horizon: a ridge all the way round, faceted. Each point on the skyline
 * is a peak with a slope in front and behind, so the light catches it.
 */
function horizon(style: HorizonStyle, seed: number, color: number): THREE.Mesh {
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
    const front = radius - h * 1.3;
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
  const mesh = new THREE.Mesh(flat, new THREE.MeshStandardMaterial({ color: hazed(color, radius), roughness: 1, flatShading: true, side: THREE.DoubleSide }));
  mesh.name = "horizon";
  return mesh;
}

/** A colour paled toward the sky's dust by how far off it stands (aerial perspective). */
function hazed(hex: number, distance: number): number {
  const t = LAND.haze.most * smoothstep(LAND.haze.near, LAND.haze.far, distance);
  const mix = (shift: number) => Math.round(((hex >> shift) & 255) * (1 - t) + ((COLORS.haze >> shift) & 255) * t);
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}

/**
 * A landform's cross-section, from its foot to its middle: each step a share of its radius and of its
 * height, how much that ring wanders in and out round the landform, and how much it jags up and down.
 */
type Profile = [r: number, h: number, wander: number, jag: number][];

const between = (rand: () => number, [lo, hi]: number[]) => lo! + (hi! - lo!) * rand();

/** The cross-section for a kind, varied a little per landform. */
function profile(kind: LandformKind, rand: () => number): Profile {
  switch (kind) {
    case "mesa": {
      // A talus slope at the foot, a cliff, a ledge where a softer stratum wore back, a second cliff, and a worn top edge.
      const talus = 0.22 + rand() * 0.12;
      const ledge = talus + (0.95 - talus) * (0.35 + rand() * 0.3);
      const back = 0.05 + rand() * 0.05;
      return [[1, -0.1, 0.06, 0], [0.8, talus, 0.1, 0.06], [0.77, ledge, 0.06, 0], [0.77 - back, ledge + 0.03, 0.08, 0.02], [0.74 - back, 0.96, 0.08, 0], [0.7 - back, 1, 0.14, 0.03], [0, 1, 0, 0]];
    }
    case "butte":
      // Mostly talus, with a narrow cap of hard rock on top.
      return [[1, -0.1, 0.08, 0], [0.62, 0.36 + rand() * 0.1, 0.1, 0.08], [0.52, 0.94, 0.06, 0], [0.47, 1, 0.12, 0.03], [0, 1, 0, 0]];
    case "plateau":
      return [[1, -0.1, 0.05, 0], [0.9, 0.2, 0.08, 0.05], [0.88, 0.5, 0.05, 0], [0.84, 0.54, 0.06, 0.02], [0.82, 0.97, 0.05, 0], [0.79, 1, 0.1, 0.02], [0, 1, 0, 0]];
    case "massif":
      // Spurs and gullies wander most halfway up; the peaks are jagged.
      return [[1, -0.08, 0.12, 0], [0.8, 0.16, 0.22, 0.1], [0.6, 0.38, 0.32, 0.14], [0.42, 0.6, 0.32, 0.16], [0.24, 0.82, 0.28, 0.14], [0.09, 0.96, 0.25, 0.06], [0, 1, 0, 0]];
    case "dome":
      return [[1, -0.08, 0.1, 0], [0.78, 0.26, 0.14, 0.06], [0.54, 0.62, 0.14, 0.06], [0.28, 0.9, 0.1, 0.04], [0, 1, 0, 0]];
    case "crater":
      // A wide apron rising to the rim, then a steeper fall inside to a floor a little above the plain.
      return [[1, -0.15, 0.04, 0], [0.8, 0.25, 0.05, 0.1], [0.67, 0.8, 0.04, 0.1], [0.6, 1, 0.04, 0.12], [0.54, 0.72, 0.04, 0.06], [0.42, 0.18, 0.05, 0.04], [0, 0.12, 0, 0]];
  }
}

/**
 * The landforms toward the horizon for a site: a handful, spread round it at different distances so nearer
 * ones stand in front of farther ones. Each is a faceted solid of its own, so the sun shades its sides
 * differently as the day goes and the camera sees round it as it orbits.
 */
function landforms(style: HorizonStyle, seed: number, rim: number, heightAt: (x: number, z: number) => number, color: number): THREE.Mesh[] {
  const rand = random(seed + 7);
  const kinds: LandformKind[] = [];
  for (const [kind, range] of Object.entries(LAND.mix[style]) as [LandformKind, [number, number]][]) {
    const n = range[0] + Math.floor(rand() * (range[1] - range[0] + 1));
    for (let i = 0; i < n; i++) kinds.push(kind === "mesa" && rand() < LAND.buttes ? "butte" : kind);
  }
  // Shuffled, then each given a share of the circle, so they spread round rather than bunch.
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j]!, kinds[i]!];
  }
  const start = rand() * Math.PI * 2;
  return kinds.map((kind, k) => {
    const spec = LAND.landforms[kind];
    const at = start + ((k + 0.15 + rand() * 0.7) / kinds.length) * Math.PI * 2;
    const distance = rim + between(rand, [spec.near, spec.far]);
    const radius = between(rand, spec.radius);
    const shape = {
      x: distance * Math.cos(at),
      z: distance * Math.sin(at),
      radius,
      height: kind === "crater" ? radius * between(rand, spec.height) : between(rand, spec.height),
      // Stretched one way and turned, so footprints aren't circles; peaks and domes lean off centre.
      stretch: kind === "crater" ? 0.85 + rand() * 0.3 : 0.6 + rand() * 0.8,
      turn: rand() * Math.PI,
      lean: kind === "massif" || kind === "dome" ? [(rand() - 0.5) * 0.5, (rand() - 0.5) * 0.5] : [0, 0],
      segments: spec.segments,
    };
    const mesh = landform(shape, profile(kind, rand), noise2(seed + 211 + k * 31), heightAt, hazed(color, distance));
    mesh.name = "landform";
    return mesh;
  });
}

/** One landform: its profile turned round its middle, wandering by noise, sat on the ground and faceted. */
function landform(
  s: { x: number; z: number; radius: number; height: number; stretch: number; turn: number; lean: number[]; segments: number },
  prof: Profile,
  n: (x: number, y: number) => number,
  heightAt: (x: number, z: number) => number,
  color: number,
): THREE.Mesh {
  const cos = Math.cos(s.turn);
  const sin = Math.sin(s.turn);
  // Its foot sits at the lowest ground under it, so no edge floats.
  let base = heightAt(s.x, s.z);
  for (let j = 0; j < 12; j++) {
    const a = (j / 12) * Math.PI * 2;
    base = Math.min(base, heightAt(s.x + s.radius * Math.cos(a), s.z + s.radius * Math.sin(a)));
  }
  const S = s.segments;
  const pos: number[] = [];
  prof.forEach(([r, h, wander, jag], i) => {
    for (let j = 0; j < S; j++) {
      const a = (j / S) * Math.PI * 2;
      const c = Math.cos(a);
      const si = Math.sin(a);
      // Broad swells and finer gullies round the ring, different on each ring.
      const w = (n(c * 1.6 + 20, si * 1.6 + i * 0.45) - 0.5) * 1.4 + (n(c * 5 + 40, si * 5 + i * 0.7) - 0.5) * 0.8;
      const rr = s.radius * r * (1 + wander * w);
      const lx = rr * c * s.stretch + s.lean[0]! * s.radius * h;
      const lz = rr * si + s.lean[1]! * s.radius * h;
      const y = base + s.height * (h + jag * (n(c * 9 + 60, si * 9 + i * 1.3) - 0.5) * 2);
      pos.push(s.x + lx * cos - lz * sin, y, s.z + lx * sin + lz * cos);
    }
  });
  const index: number[] = [];
  for (let i = 0; i < prof.length - 1; i++) {
    for (let j = 0; j < S; j++) {
      const a = i * S + j;
      const b = i * S + ((j + 1) % S);
      const c = (i + 1) * S + j;
      const d = (i + 1) * S + ((j + 1) % S);
      index.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  const flat = geo.toNonIndexed();
  flat.computeVertexNormals();
  geo.dispose();
  return new THREE.Mesh(flat, new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }));
}
